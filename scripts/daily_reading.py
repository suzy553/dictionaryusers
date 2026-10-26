# -*- coding: utf-8 -*-
"""
每日阅读流水线：抓轻松题材 → 翻译中文 → 生成朗读 mp3 → 写 data/reading.json
用法：
    python scripts/daily_reading.py            # 正常跑（需要 SILICONFLOW_KEY）
    python scripts/daily_reading.py --no-ai    # 不翻译，仅抓取+音频（调试）
"""
import asyncio, io, json, os, re, sys, time, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 兼容两种布局：仓库根就是应用目录 / 应用在子目录
APP = ROOT if os.path.isdir(os.path.join(ROOT, "data")) else os.path.join(ROOT, "ielts-bookshelf")
OUT_JSON = os.path.join(APP, "data", "reading.json")
AUDIO_DIR = os.path.join(APP, "data", "reading", "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

# 轻松题材来源（实测可访问）
FEEDS = [
    ("BBC Culture", "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml"),
    ("NPR Arts",    "https://feeds.npr.org/1008/rss.xml"),
    ("NPR Tech",    "https://feeds.npr.org/1019/rss.xml"),
]
MAX_ITEMS = 6

# 关键词 → 国家（对齐 30 国 img 字段）
COUNTRY_HINTS = [
    (r"\b(?:France|Paris|French)\b", "fr", "法国"),
    (r"\b(?:Japan|Tokyo|Japanese)\b", "jp", "日本"),
    (r"\b(?:China|Beijing|Shanghai|Chinese)\b", "cn", "中国"),
    (r"\b(?:Korea|Seoul|Korean)\b", "kr", "韩国"),
    (r"\b(?:India|Mumbai|Delhi|Indian)\b", "in", "印度"),
    (r"\b(?:Italy|Rome|Milan|Italian)\b", "it", "意大利"),
    (r"\b(?:Spain|Madrid|Barcelona|Spanish)\b", "es", "西班牙"),
    (r"\b(?:Germany|Berlin|German)\b", "de", "德国"),
    (r"\b(?:UK|Britain|London|British)\b", "gb", "英国"),
    (r"\b(?:Canada|Toronto|Canadian)\b", "ca", "加拿大"),
    (r"\b(?:Australia|Sydney|Australian)\b", "au", "澳洲"),
    (r"\b(?:Thailand|Bangkok|Thai)\b", "th", "泰国"),
    (r"\b(?:Turkey|Istanbul|Turkish)\b", "tr", "土耳其"),
    (r"\b(?:Russia|Moscow|Russian)\b", "ru", "俄罗斯"),
    (r"\b(?:Egypt|Cairo|Egyptian)\b", "eg", "埃及"),
    (r"\b(?:Greece|Athens|Greek)\b", "gr", "希腊"),
    (r"\b(?:Netherlands|Amsterdam|Dutch)\b", "nl", "荷兰"),
    (r"\b(?:Swiss|Switzerland|Zurich)\b", "ch", "瑞士"),
    (r"\bNorway|Oslo|Norwegian\b", "no", "挪威"),
    (r"\bSweden|Stockholm|Swedish\b", "se", "瑞典"),
    (r"\bDenmark|Copenhagen|Danish\b", "dk", "丹麦"),
    (r"\bFinland|Helsinki|Finnish\b", "fi", "芬兰"),
    (r"\bAustria|Vienna|Austrian\b", "at", "奥地利"),
    (r"\bSingapore\b", "sg", "新加坡"),
    (r"\bMalaysia|Kuala Lumpur\b", "my", "马来西亚"),
    (r"\bIndonesia|Jakarta|Bali\b", "id", "印度尼西亚"),
    (r"\bPhilippines|Manila\b", "ph", "菲律宾"),
    (r"\bVietnam|Hanoi|Vietnamese\b", "vn", "越南"),
    (r"\bNew Zealand\b", "nz", "新西兰"),
]
FALLBACK = [("us", "美国"), ("gb", "英国"), ("fr", "法国"), ("jp", "日本"), ("de", "德国"), ("it", "意大利")]


def fetch(url, timeout=25):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36"
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def parse_rss(xml, source):
    """从 RSS 里抽 title/link/description/pubDate"""
    items = []
    for block in re.findall(r"<item>(.*?)</item>", xml, re.S)[:12]:
        def pick(tag):
            m = re.search(rf"<{tag}[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</{tag}>", block, re.S)
            return re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else ""
        title = pick("title")
        desc = pick("description")
        link = pick("link")
        date = pick("pubDate")
        if not title:
            continue
        # RSS 日期 → YYYY-MM-DD
        m = re.search(r"(\d{1,2}) (\w{3}) (\d{4})", date)
        if m:
            try:
                date = time.strftime("%Y-%m-%d", time.strptime(" ".join(m.groups()), "%d %b %Y"))
            except Exception:
                date = time.strftime("%Y-%m-%d")
        else:
            date = time.strftime("%Y-%m-%d")
        desc = re.sub(r"\s+", " ", desc)[:400]
        items.append({"source": source, "title": title, "summary": desc, "link": link, "date": date})
    return items


TOPIC = {"BBC Culture": "文化", "NPR Arts": "艺术", "NPR Tech": "科技"}


def guess_country(text):
    """只在明确提到某国时返回国家；否则返回 (None, None)，由 UI 显示题材标签"""
    for pat, code, name in COUNTRY_HINTS:
        if re.search(pat, text, re.I):
            return code, name
    return None, None


def get_key():
    p = os.path.expanduser(r"~\.dsh\credentials\siliconflow.key")
    if os.path.exists(p):
        k = io.open(p, encoding="utf-8").read()
        k = k.replace("\ufeff", "").strip()
        k = "".join(ch for ch in k if 32 <= ord(ch) < 127)
        if k:
            return k
    return os.environ.get("SILICONFLOW_KEY", "").strip()


def translate(items):
    """一次请求批量翻译，返回 [{titleZh, bodyZh, words}]"""
    key = get_key()
    if not key:
        print("  ! 没有 SILICONFLOW_KEY，跳过翻译")
        return [{} for _ in items]

    payload = [{"i": n, "title": it["title"], "summary": it["summary"]} for n, it in enumerate(items)]
    prompt = (
        "你是英语学习内容编辑。把下面每条新闻改写为适合中级学习者的版本，输出 JSON 数组。\n"
        "要求：\n"
        "1. body：把 summary 改写成 2~3 句、不超过 60 词的英文，用词简单，保留关键信息；\n"
        "2. titleZh：标题的中文翻译（自然、口语化）；\n"
        "3. bodyZh：body 的中文翻译；\n"
        "4. words：从 body 里挑 3 个值得学的词或短语，给中文释义；\n"
        '输出格式：[{"i":0,"body":"...","titleZh":"...","bodyZh":"...","words":[{"w":"...","zh":"..."}]}]\n'
        "只输出 JSON，不要解释。\n\n输入：\n" + json.dumps(payload, ensure_ascii=False)
    )

    body = json.dumps({
        "model": "deepseek-ai/DeepSeek-V4.1-Flash",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.4,
        "max_tokens": 2600,
    }).encode()

    req = urllib.request.Request(
        "https://api.siliconflow.cn/v1/chat/completions",
        data=body,
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read().decode())
        txt = data["choices"][0]["message"]["content"].strip()
        txt = re.sub(r"^```(?:json)?|```$", "", txt, flags=re.M).strip()
        arr = json.loads(txt)
        out = [{} for _ in items]
        for o in arr:
            i = int(o.get("i", -1))
            if 0 <= i < len(out):
                out[i] = o
        print(f"  ✓ 翻译完成 {sum(1 for x in out if x)}/{len(items)}")
        return out
    except Exception as e:
        print(f"  ! 翻译失败: {type(e).__name__} {str(e)[:160]}")
        return [{} for _ in items]


async def make_audio(text, path, voice="en-US-AriaNeural"):
    import edge_tts
    await edge_tts.Communicate(text, voice).save(path)


async def main():
    no_ai = "--no-ai" in sys.argv
    raw = []
    for name, url in FEEDS:
        try:
            items = parse_rss(fetch(url), name)
            print(f"  {name}: {len(items)} 条")
            raw.extend(items)
        except Exception as e:
            print(f"  {name}: 失败 {type(e).__name__}")

    # 按来源轮询，保证题材混合（文化/艺术/科技都有）
    by_src = {}
    for it in raw:
        by_src.setdefault(it["source"], []).append(it)
    seen, picked = set(), []
    while len(picked) < MAX_ITEMS and any(by_src.values()):
        for name, _ in FEEDS:
            bucket = by_src.get(name) or []
            while bucket:
                it = bucket.pop(0)
                k = it["title"].lower()[:60]
                if k in seen:
                    continue
                seen.add(k)
                picked.append(it)
                break
            if len(picked) >= MAX_ITEMS:
                break

    if not picked:
        print("✗ 没有抓到内容")
        return 1

    tr = [{} for _ in picked] if no_ai else translate(picked)

    out = []
    for n, it in enumerate(picked):
        t = tr[n] or {}
        body = (t.get("body") or it["summary"] or it["title"]).strip()
        code, cname = guess_country(it["title"] + " " + body)
        topic = TOPIC.get(it["source"], "阅读")
        aid = f"r{n+1}"
        mp3 = os.path.join(AUDIO_DIR, aid + ".mp3")
        try:
            await make_audio((it["title"] + ". " + body)[:600], mp3)
            size = os.path.getsize(mp3)
        except Exception as e:
            print(f"  ! {aid} 音频失败: {e}")
            size = 0

        out.append({
            "id": aid,
            "country": code or "",
            "countryName": cname or "",
            "topic": topic,
            "source": it["source"],
            "date": it["date"],
            "title": it["title"],
            "titleZh": t.get("titleZh", ""),
            "body": body,
            "bodyZh": t.get("bodyZh", ""),
            "words": (t.get("words") or [])[:3],
            "audio": f"data/reading/audio/{aid}.mp3" if size else "",
            "audioKB": round(size / 1024) if size else 0,
            "link": it["link"],
        })
        print(f"  ✓ {aid} [{cname}] {it['title'][:44]}  {size/1024:.0f}KB")

    # 清理多余音频
    keep = {x["id"] + ".mp3" for x in out}
    for f in os.listdir(AUDIO_DIR):
        if f.endswith(".mp3") and f not in keep:
            os.remove(os.path.join(AUDIO_DIR, f))

    data = {
        "updated": time.strftime("%Y-%m-%d %H:%M"),
        "date": time.strftime("%Y-%m-%d"),
        "source": " / ".join(sorted({x["source"] for x in out})),
        "items": out,
    }
    io.open(OUT_JSON, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=1))
    total = sum(x["audioKB"] for x in out)
    print(f"\n✓ 写入 {OUT_JSON}：{len(out)} 篇，音频 {total}KB")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
