#!/usr/bin/env python3
"""把开源词表归一化成书架用的数据文件。

来源：RealKai42/qwerty-learner（MIT）的 public/dicts 目录。
输出：data/books/<id>.json（按需加载）+ data/books/index.json（书架元数据）
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

SRC = Path(os.environ.get("DICT_SRC", Path(os.environ["TEMP"]) / "dict-src"))
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "books"

# (id, 源文件, 书名, 副标题, 分类)
BOOKS = [
    ("ielts",        "IELTS_3_T.json",                          "雅思核心词汇",  "剑桥雅思高频词",       "雅思"),
    ("ielts7000",    "IELTS_XDF_7000.json",                     "雅思 7000",   "完整覆盖版",           "雅思"),
    ("toefl",        "TOEFL_3_T.json",                          "托福核心词汇",  "TOEFL 高频",           "托福"),
    ("kaoyan",       "KaoYan_3_T.json",                         "考研词汇",    "考研英语大纲词",         "考研"),
    ("cet6",         "CET6_T.json",                             "六级词汇",    "大学英语六级",           "四六级"),
    ("cet4",         "CET4_T.json",                             "四级词汇",    "大学英语四级",           "四六级"),
    ("gre",          "GRE_3_T.json",                            "GRE 词汇",    "GRE 高频难词",          "GRE"),
    ("oxford3000",   "Oxford3000.json",                         "牛津 3000",   "英语核心基础词",         "基础"),
    ("voa",          "voa.json",                                "VOA 新闻英语", "新闻高频 · 配合每日新闻", "新闻"),
]

SENTENCE_SRC = "4000_Essential_English_Words-sentence.json"
MEANING_SRC = "4000_Essential_English_Words-meaning.json"
# ManyThings 双语例句（Tatoeba 导出）：英文 \t 中文 \t 出处
BILINGUAL = Path(os.environ.get("TEMP", "/tmp")) / "cmn-eng" / "cmn.txt"

CJK = re.compile(r"[\u4e00-\u9fff]")
WORD_OK = re.compile(r"^[A-Za-z][A-Za-z'\-\. ]{0,40}$")
TOKEN = re.compile(r"[a-zA-Z][a-zA-Z'\-]*")


def load(path: Path):
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = data.get("data") or []
    return data


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", str(s)).strip()


def looks_like_sentence(s: str) -> bool:
    return len(s) > 25 and " " in s and not CJK.search(s) and s.rstrip()[-1:] in ".!?\"'"


def build_pools():
    sentences: dict[str, str] = {}
    for item in load(SRC / SENTENCE_SRC):
        w = clean(item.get("name", "")).lower()
        for t in item.get("trans") or []:
            t = clean(t)
            if w and looks_like_sentence(t):
                sentences.setdefault(w, t)
                break

    meanings: dict[str, str] = {}
    for item in load(SRC / MEANING_SRC):
        w = clean(item.get("name", "")).lower()
        for t in item.get("trans") or []:
            t = clean(t)
            if w and t and not CJK.search(t) and 8 < len(t) < 200:
                meanings.setdefault(w, t)
                break
    return sentences, meanings


def build_bilingual() -> dict[str, tuple[str, str]]:
    """从双语语料里给每个词挑一条最合适的例句，附带中文翻译。"""
    if not BILINGUAL.exists():
        print(f"  (跳过双语例句：{BILINGUAL} 不存在)")
        return {}

    best: dict[str, tuple[float, str, str]] = {}
    with BILINGUAL.open(encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 2:
                continue
            en, zh = clean(parts[0]), clean(parts[1])
            if not en or not zh or not CJK.search(zh):
                continue
            if not 15 <= len(en) <= 130:
                continue
            zh = re.sub(r"\s+", "", zh)
            score = -abs(len(en) - 75)  # 长度越接近 75 字符越好
            for tok in set(TOKEN.findall(en.lower())):
                prev = best.get(tok)
                if prev is None or score > prev[0]:
                    best[tok] = (score, en, zh)
    return {k: (v[1], v[2]) for k, v in best.items()}


def build_book(bid, filename, sentences, meanings, bilingual):
    src = SRC / filename
    if not src.exists():
        print(f"  !! 缺少源文件 {filename}")
        return None

    seen: set[str] = set()
    words = []
    for item in load(src):
        w = clean(item.get("name", ""))
        if not w or not WORD_OK.match(w):
            continue
        key = w.lower()
        if key in seen:
            continue
        raw_trans = item.get("trans") or []
        if isinstance(raw_trans, str):          # 有些词表把 trans 写成字符串，别逐字拆
            raw_trans = [raw_trans]
        trans = [clean(t) for t in raw_trans if clean(t)]
        if not trans:
            continue
        # 兜底：如果整条释义被拆成了单字（每项长度都是 1），合并回一行
        if len(trans) > 3 and all(len(t) <= 1 for t in trans):
            trans = ["".join(trans)]
        seen.add(key)
        entry = {"w": w, "t": trans}
        us = clean(item.get("usphone") or "").strip("/ ")
        uk = clean(item.get("ukphone") or "").strip("/ ")
        if us:
            entry["us"] = us
        if uk:
            entry["uk"] = uk
        if key in bilingual:
            entry["s"], entry["sz"] = bilingual[key]
        elif key in sentences:
            entry["s"] = sentences[key]
        if key in meanings:
            entry["d"] = meanings[key]
        words.append(entry)

    out = OUT / f"{bid}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8") as f:
        json.dump({"id": bid, "words": words}, f, ensure_ascii=False, separators=(",", ":"))
    return words


def main() -> int:
    if not SRC.exists():
        print(f"源目录不存在: {SRC}")
        return 1

    print("构建跨词书句子池 / 英英释义池 / 双语例句池 ...")
    sentences, meanings = build_pools()
    bilingual = build_bilingual()
    print(f"  英文例句 {len(sentences)} 条，英英释义 {len(meanings)} 条，双语例句 {len(bilingual)} 条\n")

    index = []
    for bid, filename, title, subtitle, tag in BOOKS:
        words = build_book(bid, filename, sentences, meanings, bilingual)
        if not words:
            continue
        with_sentence = sum(1 for w in words if "s" in w)
        size_kb = round((OUT / f"{bid}.json").stat().st_size / 1024)
        index.append({
            "id": bid, "title": title, "subtitle": subtitle, "tag": tag,
            "count": len(words), "sizeKB": size_kb,
        })
        cover = with_sentence / len(words) * 100
        print(f"  {bid:12s} {len(words):5d} 词  {size_kb:5d}KB  例句覆盖 {cover:5.1f}%")

    index.sort(key=lambda b: b["count"])
    with (OUT / "index.json").open("w", encoding="utf-8") as f:
        json.dump({"books": index}, f, ensure_ascii=False, indent=1)

    total = sum(b["sizeKB"] for b in index)
    print(f"\n共 {len(index)} 本，合计 {total} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
