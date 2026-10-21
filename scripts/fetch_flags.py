# -*- coding: utf-8 -*-
"""下载 20 个国家的国旗（flagcdn，免费可商用），压成小 webp"""
import os, urllib.request, io
from PIL import Image

BASE = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf"
OUT = os.path.join(BASE, "data", "flags")
os.makedirs(OUT, exist_ok=True)

# 国家名 -> ISO 代码
FLAGS = {
    "中国": "cn", "日本": "jp", "泰国": "th", "印度": "in",
    "埃及": "eg", "希腊": "gr", "意大利": "it", "法国": "fr",
    "英国": "gb", "冰岛": "is", "挪威": "no", "俄罗斯": "ru",
    "美国": "us", "加拿大": "ca", "巴西": "br", "澳洲": "au",
    "新西兰": "nz", "韩国": "kr", "越南": "vn", "土耳其": "tr",
}

ok, fail = 0, 0
for name, code in FLAGS.items():
    url = f"https://flagcdn.com/w320/{code}.png"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        raw = urllib.request.urlopen(req, timeout=15).read()
        im = Image.open(io.BytesIO(raw)).convert("RGBA")
        im.thumbnail((160, 160), Image.LANCZOS)
        path = os.path.join(OUT, f"{code}.webp")
        im.save(path, "WEBP", quality=90, method=6)
        ok += 1
    except Exception as e:
        print("fail", code, str(e)[:50])
        fail += 1

print(f"ok={ok} fail={fail}")
total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print("total KB:", round(total / 1024, 1))
