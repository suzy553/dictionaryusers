#!/usr/bin/env python3
"""抓取英文新闻 RSS，生成 data/news.json 供 App 显示。

只依赖 Python 标准库。供 GitHub Actions 每天定时执行，也可在本机手动跑。
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "news.json"

FEEDS = [
    ("BBC Learning English", "https://feeds.bbci.co.uk/learningenglish/rss.xml"),
    ("VOA Learning English", "https://learningenglish.voanews.com/api/zl-vomqeu"),
    ("BBC World", "https://feeds.bbci.co.uk/news/world/rss.xml"),
    ("The Guardian", "https://www.theguardian.com/world/rss"),
    ("NPR World", "https://feeds.npr.org/1004/rss.xml"),
    ("China Daily", "https://www.chinadaily.com.cn/rss/world_rss.xml"),
]

UA = "Mozilla/5.0 (compatible; XiaoYueVocabBot/1.0)"
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


def clean(s: str, limit: int = 180) -> str:
    s = TAG_RE.sub(" ", s or "")
    s = WS_RE.sub(" ", s).strip()
    return s[:limit].rstrip() + ("…" if len(s) > limit else "")


def norm_date(raw: str) -> str:
    """把 RFC822 / ISO 日期统一成 YYYY-MM-DD。"""
    raw = (raw or "").strip()
    if not raw:
        return ""
    try:
        return parsedate_to_datetime(raw).strftime("%Y-%m-%d")
    except Exception:
        pass
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).strftime("%Y-%m-%d")
    except Exception:
        return raw[:10] if len(raw) >= 10 else raw


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/rss+xml,application/xml,*/*"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read()


def parse(raw: bytes) -> list[dict]:
    root = ET.fromstring(raw)
    items = []

    for it in root.iter("item"):          # RSS 2.0
        items.append({
            "title": clean(it.findtext("title") or "", 120),
            "link": (it.findtext("link") or "").strip(),
            "summary": clean(it.findtext("description") or ""),
            "date": norm_date(it.findtext("pubDate") or ""),
        })

    if not items:                          # Atom
        ns = {"a": "http://www.w3.org/2005/Atom"}
        for it in root.iter("{http://www.w3.org/2005/Atom}entry"):
            link = ""
            for l in it.findall("a:link", ns):
                if l.get("rel", "alternate") == "alternate":
                    link = l.get("href", "")
                    break
            items.append({
                "title": clean(it.findtext("a:title", default="", namespaces=ns), 120),
                "link": link,
                "summary": clean(it.findtext("a:summary", default="", namespaces=ns)),
                "date": norm_date(it.findtext("a:updated", default="", namespaces=ns)),
            })
    return [i for i in items if i["title"] and i["link"]]


def main() -> int:
    items, source_used = [], ""
    for name, url in FEEDS:
        try:
            got = parse(fetch(url))
        except Exception as e:                       # noqa: BLE001
            print(f"  跳过 {name}: {e}")
            continue
        if len(got) >= 2:
            for g in got[:6]:
                g["source"] = name
            items.extend(got[:6])
            source_used = name
            print(f"  {name}: {len(got)} 条")
            if len(items) >= 6:
                break

    now = datetime.now(timezone(timedelta(hours=8)))
    payload = {
        "updated": now.strftime("%Y-%m-%d %H:%M"),
        "date": now.strftime("%Y-%m-%d"),
        "source": source_used,
        "items": items[:6],
    }

    if not items:
        print("没有抓到任何新闻，保留旧文件")
        return 1

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"写入 {OUT}（{len(items)} 条）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
