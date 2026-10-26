# -*- coding: utf-8 -*-
"""
每日阅读 v2 流水线
  抓 RSS → 抓正文 → AI 精简改写为 200~350 词长文（逐句英文+中文）
  → 全篇词汇表（点词查义） → 生成整篇朗读 mp3 → 写入 reading.json + 归档

用法：
    python scripts/daily_reading.py
    python scripts/daily_reading.py --no-ai      # 不调 AI，仅抓取（调试）
    python scripts/daily_reading.py --limit 3    # 只做 3 篇
"""
import asyncio, html, io, json, os, re, sys, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = ROOT if os.path.isdir(os.path.join(ROOT, "data")) else os.path.join(ROOT, "ielts-bookshelf")
OUT_JSON = os.path.join(APP, "data", "reading.json")
ARCHIVE = os.path.join(APP, "data", "reading-archive.json")
AUDIO_DIR = os.path.join(APP, "data", "reading", "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

FEEDS = [
    ("BBC Culture", "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", "文化"),
    ("NPR Arts",    "https://feeds.npr.org/1008/rss.xml", "艺术"),
    ("NPR Tech",    "https://feeds.npr.org/1019/rss.xml", "科技"),
]
MAX_ITEMS = 6
ARCHIVE_KEEP = 60       # 归档保留篇数
AUDIO_KEEP_DAYS = 3     # 只保留最近 3 天的音频

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
    (r"\b(?:Greece|Athens|Greek)\b", "gr", "希腊"),
    (r"\b(?:Netherlands|Amsterdam|Dutch)\b", "nl", "荷兰"),
    (r"\b(?:Switzerland|Zurich|Swiss)\b", "ch", "瑞士"),
    (r"\b(?:Norway|Oslo|Norwegian)\b", "no", "挪威"),
    (r"\b(?:Sweden|Stockholm|Swedish)\b", "se", "瑞典"),
    (r"\b(?:Denmark|Copenhagen|Danish)\b", "dk", "丹麦"),
    (r"\b(?:Finland|Helsinki|Finnish)\b", "fi", "芬兰"),
    (r"\b(?:Austria|Vienna|Austrian)\b", "at", "奥地利"),
    (r"\bSingapore\b", "sg", "新加坡"),
    (r"\b(?:Malaysia|Kuala Lumpur)\b", "my", "马来西亚"),
    (r"\b(?:Indonesia|Jakarta|Bali)\b", "id", "印度尼西亚"),
    (r"\b(?:Philippines|Manila)\b", "ph", "菲律宾"),
    (r"\b(?:Vietnam|Hanoi|Vietnamese)\b", "vn", "越南"),
    (r"\bNew Zealand\b", "nz", "新西兰"),
]




def _unescape(v):
    """RSS 里的 &apos; &amp; 等实体解码"""
    if not isinstance(v, str):
        return v
    for _ in range(3):
        nv = html.unescape(v)
        if nv == v:
            break
        v = nv
    return v

def http_get(url, timeout=25):
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        ctype = r.headers.get("Content-Type", "")
    enc = "utf-8"
    m = re.search(r"charset=([\w-]+)", ctype, re.I)
    if m:
        enc = m.group(1)
    return raw.decode(enc, "replace")


def parse_rss(xml, source, topic):
    out = []
    for block in re.findall(r"<item>(.*?)</item>", xml, re.S)[:10]:
        def pick(tag):
            m = re.search(rf"<{tag}[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</{tag}>", block, re.S)
            return re.sub(r"<[^>]+>", "", m.group(1)).strip() if m else ""
        title, link, desc, date = pick("title"), pick("link"), pick("description"), pick("pubDate")
        if not title or not link:
            continue
        m = re.search(r"(\d{1,2}) (\w{3}) (\d{4})", date)
        if m:
            try:
                date = time.strftime("%Y-%m-%d", time.strptime(" ".join(m.groups()), "%d %b %Y"))
            except Exception:
                date = time.strftime("%Y-%m-%d")
        else:
            date = time.strftime("%Y-%m-%d")
        out.append({"source": source, "topic": topic, "title": title, "link": link,
                    "summary": re.sub(r"\s+", " ", desc)[:500], "date": date})
    return out


def fetch_body(url):
    """从文章页抽正文段落（启发式：取较长的 <p> 集合）"""
    try:
        html = http_get(url)
    except Exception:
        return ""
    html = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html)
    paras = re.findall(r"(?is)<p[^>]*>(.*?)</p>", html)
    clean = []
    for p in paras:
        t = re.sub(r"<[^>]+>", " ", p)
        t = re.sub(r"&#\d+;|&\w+;", " ", t)
        t = re.sub(r"\s+", " ", t).strip()
        if len(t) < 60:
            continue
        if re.search(r"(?i)subscribe|cookie|sign up|newsletter|all rights reserved|follow us", t):
            continue
        clean.append(t)
    return " ".join(clean)[:4000]


def get_key():
    p = os.path.expanduser(r"~\.dsh\credentials\siliconflow.key")
    if os.path.exists(p):
        k = "".join(ch for ch in io.open(p, encoding="utf-8").read()
                    if 32 <= ord(ch) < 127).strip()
        if k:
            return k
    return os.environ.get("SILICONFLOW_KEY", "").strip()


def _ai_one(it, n):
    """单篇改写：避免一次请求 6 篇导致超时"""
    import concurrent.futures  # noqa
    key = get_key()
    payload = {
        "i": n,
        "title": it["title"],
        "summary": it["summary"],
        "body": (it.get("fulltext") or "")[:1600],
    }
    prompt = (
        "把下面这条英文新闻改写成适合中级学习者的短文，输出 JSON 对象（不要数组、不要解释）：\n"
        "{\"title_en\":\"\",\"title_zh\":\"\",\"country\":\"\","
        "\"sentences\":[{\"en\":\"\",\"zh\":\"\"}],\"glossary\":[{\"w\":\"\",\"zh\":\"\"}]}\n"
        "要求：\n"
        "1. sentences：8~12 句，总词数 200~300 词；交代清楚背景（谁/何时/为什么）、"
        "事件经过、影响或后续，让不懂背景的人也能看懂；B1~B2 难度，单句 ≤25 词；每句配中文翻译 sentence_zh；\n"
        "2. glossary：18~22 个值得学的词或短语 + 中文释义；\n"
        "3. country：明确属于某国时填英文国名，否则空字符串。\n\n"
        "输入：\n" + json.dumps(payload, ensure_ascii=False)
    )
    body = json.dumps({
        "model": "deepseek-ai/DeepSeek-V4.1-Flash",
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.5,
        "max_tokens": 3000,
    }).encode()
    req = urllib.request.Request(
        "https://api.siliconflow.cn/v1/chat/completions",
        data=body,
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"},
    )
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=150) as r:
                data = json.loads(r.read().decode())
            txt = data["choices"][0]["message"]["content"].strip()
            txt = re.sub(r"^```(?:json)?\s*|\s*```$", "", txt)
            m = re.search(r"\{[\s\S]*\}", txt)
            return json.loads(m.group(0) if m else txt)
        except Exception as e:
            if attempt == 1:
                print(f"    ! 第{n+1}篇 AI 失败: {type(e).__name__} {str(e)[:120]}")
                return {}
    return {}


def ai_article(items):
    key = get_key()
    if not key:
        print("  ! 无 SILICONFLOW_KEY，跳过 AI")
        return [{} for _ in items]
    import concurrent.futures as cf
    out = [{} for _ in items]
    with cf.ThreadPoolExecutor(max_workers=3) as pool:
        futs = {pool.submit(_ai_one, it, n): n for n, it in enumerate(items)}
        for f in cf.as_completed(futs):
            n = futs[f]
            try:
                out[n] = f.result() or {}
            except Exception:
                out[n] = {}
    print(f"  ✓ AI 改写 {sum(1 for x in out if x)}/{len(items)}")
    return out


def guess_country(text, given):
    if given:
        for pat, code, name in COUNTRY_HINTS:
            if re.search(pat, " " + given + " ", re.I):
                return code, name
    for pat, code, name in COUNTRY_HINTS:
        if re.search(pat, text, re.I):
            return code, name
    return "", ""


async def make_audio(text, path, voice="en-US-AriaNeural"):
    import edge_tts
    await edge_tts.Communicate(text, voice).save(path)


def prune_audio():
    now = time.time()
    for f in os.listdir(AUDIO_DIR):
        if not f.endswith(".mp3"):
            continue
        p = os.path.join(AUDIO_DIR, f)
        if now - os.path.getmtime(p) > AUDIO_KEEP_DAYS * 86400:
            try:
                os.remove(p)
            except Exception:
                pass


async def main():
    no_ai = "--no-ai" in sys.argv
    limit = MAX_ITEMS
    if "--limit" in sys.argv:
        try:
            limit = int(sys.argv[sys.argv.index("--limit") + 1])
        except Exception:
            pass

    # 1) 抓列表
    raw = []
    for name, url, topic in FEEDS:
        try:
            items = parse_rss(http_get(url), name, topic)
            print(f"  {name}: {len(items)} 条")
            raw.extend(items)
        except Exception as e:
            print(f"  {name}: 失败 {type(e).__name__}")

    # 2) 按来源轮询取稿
    by_src = {}
    for it in raw:
        by_src.setdefault(it["source"], []).append(it)
    picked, seen = [], set()
    while len(picked) < limit and any(by_src.values()):
        for name, _, _ in FEEDS:
            bucket = by_src.get(name) or []
            while bucket:
                it = bucket.pop(0)
                k = it["title"].lower()[:50]
                if k in seen:
                    continue
                seen.add(k)
                picked.append(it)
                break
            if len(picked) >= limit:
                break

    if not picked:
        print("✗ 没有抓到内容")
        return 1

    # 3) 抓正文
    for it in picked:
        it["fulltext"] = fetch_body(it["link"])
        print(f"    {'正文' if len(it['fulltext']) > 400 else '仅摘要'}: {it['title'][:46]}")

    # 4) AI 改写
    arts = [{} for _ in picked] if no_ai else ai_article(picked)

    # 5) 组装 + 音频
    items_out = []
    for n, it in enumerate(picked):
        a = arts[n] or {}
        sents = a.get("sentences") or []
        if not sents:
            txt = it["summary"] or it["title"]
            sents = [{"en": s.strip(), "zh": ""}
                     for s in re.split(r"(?<=[.!?])\s+", txt) if len(s.strip()) > 15]

        full_en = " ".join(s["en"] for s in sents)
        if not full_en.strip():
            continue

        rid = time.strftime("%Y%m%d") + f"-{n+1}"
        mp3 = os.path.join(AUDIO_DIR, rid + ".mp3")
        try:
            await make_audio(full_en[:3000], mp3)
            size = os.path.getsize(mp3)
        except Exception as e:
            print(f"  ! {rid} 音频失败: {e}")
            size = 0

        code, cname = guess_country(it["title"] + " " + full_en, a.get("country") or "")
        words = sum(len(s["en"].split()) for s in sents)

        def _u(x):
            return _unescape(x)

        items_out.append({
            "id": rid,
            "date": it["date"],
            "source": it["source"],
            "topic": it["topic"],
            "country": code,
            "countryName": cname,
            "title": _unescape(a.get("title_en") or it["title"]),
            "titleZh": _unescape(a.get("title_zh", "")),
            "sentences": sents,
            "glossary": a.get("glossary") or [],
            "words": words,
            "audio": f"data/reading/audio/{rid}.mp3" if size else "",
            "audioKB": round(size / 1024) if size else 0,
            "link": it["link"],
        })
        print(f"  ✓ {rid} [{cname or it['topic']}] {words}词/{len(sents)}句 {size/1024:.0f}KB")

    if not items_out:
        print("✗ 没有生成任何文章")
        return 1

    # 6) 写今日 + 归档
    data = {
        "updated": time.strftime("%Y-%m-%d %H:%M"),
        "date": time.strftime("%Y-%m-%d"),
        "source": " / ".join(sorted({x["source"] for x in items_out})),
        "items": items_out,
    }
    io.open(OUT_JSON, "w", encoding="utf-8").write(json.dumps(data, ensure_ascii=False, indent=1))

    arch = {"items": []}
    if os.path.exists(ARCHIVE):
        try:
            arch = json.load(io.open(ARCHIVE, encoding="utf-8"))
        except Exception:
            arch = {"items": []}
    today = time.strftime("%Y-%m-%d")
    arch["items"] = [x for x in arch.get("items", []) if x.get("date") != today]
    for x in items_out:
        y = dict(x)
        y.pop("audio", None)
        y.pop("audioKB", None)
        arch["items"].append(y)
    arch["items"].sort(key=lambda x: (x.get("date", ""), x.get("id", "")), reverse=True)
    arch["items"] = arch["items"][:ARCHIVE_KEEP]
    arch["updated"] = time.strftime("%Y-%m-%d %H:%M")
    io.open(ARCHIVE, "w", encoding="utf-8").write(json.dumps(arch, ensure_ascii=False, indent=1))

    prune_audio()
    print(f"\n✓ 今日 {len(items_out)} 篇；归档共 {len(arch['items'])} 篇")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
