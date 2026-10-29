# -*- coding: utf-8 -*-
"""
每日阅读 v3 · 合规版

内容来源（全部合法可再发布）：
  1. VOA Learning English —— 美国政府作品，公有领域，专为学习者撰写
  2. Simple Wikipedia     —— CC BY-SA 4.0，转载需署名
  3. Project Gutenberg    —— 公有领域文学（本地可测，作为兜底）

每条内容都会写入 license / attribution 字段，界面上展示来源与许可。
"""
import asyncio, html, io, json, os, random, re, sys, time, urllib.request
from html import escape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = ROOT if os.path.isdir(os.path.join(ROOT, "data")) else os.path.join(ROOT, "ielts-bookshelf")
OUT_JSON = os.path.join(APP, "data", "reading.json")
ARCHIVE = os.path.join(APP, "data", "reading-archive.json")
AUDIO_DIR = os.path.join(APP, "data", "reading", "audio")
os.makedirs(AUDIO_DIR, exist_ok=True)

MAX_ITEMS = 6
ARCHIVE_KEEP = 60
AUDIO_KEEP_DAYS = 3

VOA_RSS = [
    "https://learningenglish.voanews.com/api/z$-iqqe$myv",
    "https://learningenglish.voanews.com/api/zrqiteu-$myv",
]
WIKI_API = "https://simple.wikipedia.org/api/rest_v1/page/random/summary"

GUTENBERG_BOOKS = [
    ("1342", "Pride and Prejudice", "Jane Austen"),
    ("11", "Alice's Adventures in Wonderland", "Lewis Carroll"),
    ("1661", "The Adventures of Sherlock Holmes", "Arthur Conan Doyle"),
    ("84", "Frankenstein", "Mary Shelley"),
    ("120", "Treasure Island", "Robert Louis Stevenson"),
    ("35", "The Time Machine", "H. G. Wells"),
    ("514", "Little Women", "Louisa May Alcott"),
    ("345", "Dracula", "Bram Stoker"),
]


def http_get(url, timeout=30):
    req = urllib.request.Request(url, headers={
        "User-Agent": "XiaoYueReading/1.0 (educational use)",
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


def _unescape(v):
    if not isinstance(v, str):
        return v
    for _ in range(3):
        nv = html.unescape(v)
        if nv == v:
            break
        v = nv
    return v


def from_voa():
    out = []
    for url in VOA_RSS:
        try:
            xml = http_get(url)
        except Exception:
            continue
        for block in re.findall(r"<item>(.*?)</item>", xml, re.S)[:10]:
            def pick(tag):
                m = re.search(rf"<{tag}[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</{tag}>", block, re.S)
                return _unescape(re.sub(r"<[^>]+>", "", m.group(1)).strip()) if m else ""
            title, link, desc = pick("title"), pick("link"), pick("description")
            if not title or not link:
                continue
            out.append({
                "title": title, "link": link, "summary": desc[:1200],
                "source": "VOA Learning English",
                "license": "公有领域（美国政府作品）",
                "attribution": "VOA Learning English",
                "topic": "新闻英语",
            })
        if out:
            break
    return out


def from_wiki(n=4):
    out = []
    for _ in range(n * 2):
        if len(out) >= n:
            break
        try:
            d = json.loads(http_get(WIKI_API))
        except Exception:
            break
        title = d.get("title") or ""
        extract = d.get("extract") or ""
        if len(extract) < 300:
            continue
        out.append({
            "title": title,
            "link": (d.get("content_urls", {}).get("desktop", {}) or {}).get("page", ""),
            "summary": extract[:1200],
            "source": "Simple Wikipedia",
            "license": "CC BY-SA 4.0",
            "attribution": "Simple English Wikipedia",
            "topic": "百科",
        })
    return out


def _strip_gutenberg(txt):
    start = txt.find("*** START OF")
    end = txt.find("*** END OF")
    if start > 0:
        nl = txt.find("\n", start)
        txt = txt[nl + 1:]
    if end > 0:
        txt = txt[:end]
    return txt


def from_gutenberg(n=6):
    out = []
    for gid, title, author in random.sample(GUTENBERG_BOOKS, min(n, len(GUTENBERG_BOOKS))):
        try:
            raw = http_get(f"https://www.gutenberg.org/cache/epub/{gid}/pg{gid}.txt", timeout=45)
        except Exception:
            continue
        body = _strip_gutenberg(raw)
        paras = [re.sub(r"\s+", " ", p.strip()) for p in re.split(r"\n\s*\n", body)]
        paras = [p for p in paras if 200 < len(p) < 1400]
        if not paras:
            continue
        lo, hi = len(paras) // 4, max(len(paras) // 4 + 1, 3 * len(paras) // 4)
        pick = random.choice(paras[lo:hi] or paras)
        out.append({
            "title": f"{title}（选段）",
            "link": f"https://www.gutenberg.org/ebooks/{gid}",
            "summary": pick[:1400],
            "source": "Project Gutenberg",
            "license": "公有领域",
            "attribution": f"{author} · {title} · Project Gutenberg",
            "topic": "文学",
        })
    return out


def get_key():
    p = os.path.expanduser(r"~\.dsh\credentials\siliconflow.key")
    if os.path.exists(p):
        k = "".join(ch for ch in io.open(p, encoding="utf-8").read()
                    if 32 <= ord(ch) < 127).strip()
        if k:
            return k
    return os.environ.get("SILICONFLOW_KEY", "").strip()


def _ai_one(it, n):
    key = get_key()
    if not key:
        return {}
    payload = {
        "i": n,
        "source": it["source"],
        "title": it["title"],
        "text": (it.get("summary") or "")[:1600],
    }
    prompt = (
        "你是英语学习内容编辑。基于下面这段**合法来源素材**改写成一篇适合中级学习者的短文。\n"
        "输出 JSON 对象（不要数组、不要解释）：\n"
        '{"title_en":"","title_zh":"","sentences":[{"en":"","zh":""}],"glossary":[{"w":"","zh":""}]}\n'
        "要求：\n"
        "1. sentences：8~12 句，总词数 200~300 词；交代清楚背景、经过、结果，"
        "让不懂背景的人也能看懂；B1~B2 难度，单句不超过 25 词；每句配中文翻译；\n"
        "2. glossary：18~22 个值得学的词或短语 + 中文释义；\n"
        "3. title_en / title_zh：给一个清晰的中英标题。\n"
        "不要逐字照搬原文长句，用自己的话组织。\n\n"
        "素材：\n" + json.dumps(payload, ensure_ascii=False)
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
                print(f"    ! 第{n+1}篇 AI 失败: {type(e).__name__}")
                return {}
    return {}


def ai_all(items):
    if not get_key():
        print("  ! 无 SILICONFLOW_KEY，跳过 AI 改写")
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




# ---------------- 朗读合成（Azure 官方 / edge-tts 兜底） ----------------
AZURE_VOICE = "en-US-AriaNeural"


def _azure_cfg():
    key = os.environ.get("AZURE_TTS_KEY", "").strip()
    region = os.environ.get("AZURE_TTS_REGION", "").strip()
    return key, region


def azure_tts(text, path, key, region, voice=AZURE_VOICE):
    """Azure 语音合成 REST 接口，输出 mp3"""
    ssml = (
        '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" '
        'xml:lang="en-US">'
        '<voice name="' + voice + '">'
        '<prosody rate="-4%">'
        + escape(text) +
        '</prosody></voice></speak>'
    )
    req = urllib.request.Request(
        f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
        data=ssml.encode("utf-8"),
        headers={
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
            "User-Agent": "XiaoYueReading/1.0",
        },
    )
    with urllib.request.urlopen(req, timeout=90) as r:
        data = r.read()
    if not data or len(data) < 2048:
        raise RuntimeError("Azure TTS 返回内容过短")
    with open(path, "wb") as f:
        f.write(data)


async def synth(text, path):
    """优先 Azure 官方接口；没配 key 或失败时回退 edge-tts"""
    key, region = _azure_cfg()
    if key and region:
        try:
            azure_tts(text, path, key, region)
            if os.path.getsize(path) > 2048:
                return "azure"
        except Exception as e:
            print(f"    ! Azure TTS 失败（{type(e).__name__}），回退 edge-tts")
    import edge_tts
    await edge_tts.Communicate(text, AZURE_VOICE).save(path)
    return "edge"

async def make_audio(text, path):
    import edge_tts
    await edge_tts.Communicate(text, "en-US-AriaNeural").save(path)


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
    limit = MAX_ITEMS
    if "--limit" in sys.argv:
        try:
            limit = int(sys.argv[sys.argv.index("--limit") + 1])
        except Exception:
            pass

    key0, region0 = _azure_cfg()
    if key0 and region0:
        print(f"  TTS: Azure 官方接口（{region0}）")
    else:
        print("  TTS: edge-tts（未配置 AZURE_TTS_KEY / AZURE_TTS_REGION）")

    pool = []
    for name, fn in (("VOA Learning English", from_voa),
                     ("Simple Wikipedia", lambda: from_wiki(6)),
                     ("Project Gutenberg", lambda: from_gutenberg(8))):
        try:
            got = fn()
            print(f"  {name}: {len(got)} 条")
            pool.extend(got)
        except Exception as e:
            print(f"  {name}: 失败 {type(e).__name__}")

    if not pool:
        print("✗ 所有来源都不可用")
        return 1

    by_src = {}
    for it in pool:
        by_src.setdefault(it["source"], []).append(it)
    picked, seen = [], set()
    while len(picked) < limit and any(by_src.values()):
        for name in list(by_src.keys()):
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

    arts = ai_all(picked)

    items_out = []
    engines = set()
    for n, it in enumerate(picked):
        a = arts[n] or {}
        sents = a.get("sentences") or []
        if not sents:
            txt = it.get("summary") or it["title"]
            sents = [{"en": s.strip(), "zh": ""}
                     for s in re.split(r"(?<=[.!?])\s+", txt) if len(s.strip()) > 15][:12]
        full_en = " ".join(s["en"] for s in sents)
        if not full_en.strip():
            continue

        rid = time.strftime("%Y%m%d") + f"-{n+1}"
        mp3 = os.path.join(AUDIO_DIR, rid + ".mp3")
        try:
            engine = await synth(full_en[:3000], mp3)
            size = os.path.getsize(mp3)
            engines.add(engine)
        except Exception as e:
            print(f"    ! 音频失败: {type(e).__name__}")
            size = 0

        words = sum(len(s["en"].split()) for s in sents)
        items_out.append({
            "id": rid,
            "date": time.strftime("%Y-%m-%d"),
            "source": it["source"],
            "license": it["license"],
            "attribution": it["attribution"],
            "topic": it.get("topic", "阅读"),
            "country": "",
            "countryName": "",
            "title": _unescape(a.get("title_en") or it["title"]),
            "titleZh": _unescape(a.get("title_zh", "")),
            "sentences": [{"en": _unescape(s.get("en", "")), "zh": _unescape(s.get("zh", ""))}
                          for s in sents],
            "glossary": [_unescape(g) for g in (a.get("glossary") or [])],
            "words": words,
            "audio": f"data/reading/audio/{rid}.mp3" if size else "",
            "audioKB": round(size / 1024) if size else 0,
            "link": it["link"],
            "aiAssisted": True,
        })
        print(f"  ✓ {rid} [{it['source']}] {words}词 {len(sents)}句 {size/1024:.0f}KB")

    if not items_out:
        print("✗ 没有生成内容")
        return 1

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
    # 合规：清掉历史里来自非合规来源的旧内容
    arch["items"] = [x for x in arch["items"]
                     if x.get("source") in ("VOA Learning English", "Simple Wikipedia", "Project Gutenberg")]
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
    print(f"\n✓ 今日 {len(items_out)} 篇；归档 {len(arch['items'])} 篇；TTS: {', '.join(sorted(engines)) or '无'}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
