# -*- coding: utf-8 -*-
"""合并两个视频的关键帧：站立/眨眼/生气(视频2) + 吃/喝/开心(视频1)"""
import cv2, os
from PIL import Image, ImageDraw, ImageFont

BASE = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf"
OUT = os.path.join(BASE, "data", "pet")
os.makedirs(OUT, exist_ok=True)

V1 = os.path.join(os.environ["TEMP"], "petvid.mp4")   # 喝水/吃饭/开心
V2 = os.path.join(os.environ["TEMP"], "petvid2.mp4")  # 站立/眨眼/生气

# name: (视频, 秒, 中心x, 中心y, 边长)
JOBS = {
    "idle":  (V2, 5.6, 360, 640, 720),
    "blink": (V2, 6.8, 360, 640, 720),
    "angry": (V2, 9.6, 360, 640, 720),
    "eat":   (V1, 4.0, 360, 820, 620),
    "drink": (V1, 1.5, 360, 790, 620),
    "happy": (V1, 2.5, 360, 690, 620),
}

made = []
caps = {}
for name, (src, t, cx, cy, side) in JOBS.items():
    if src not in caps:
        caps[src] = cv2.VideoCapture(src)
    cap = caps[src]
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, bgr = cap.read()
    if not ok:
        print("fail", name)
        continue
    H, W = bgr.shape[:2]
    half = side / 2
    l = int(max(0, min(W - side, cx - half)))
    t0 = int(max(0, min(H - side, cy - half)))
    crop = bgr[t0:t0 + int(side), l:l + int(side)]
    crop = cv2.resize(crop, (512, 512), interpolation=cv2.INTER_AREA)
    path = os.path.join(OUT, f"pet-{name}.webp")
    cv2.imwrite(path, crop, [cv2.IMWRITE_WEBP_QUALITY, 86])
    made.append((name, path, os.path.getsize(path)))

for c in caps.values():
    c.release()

for n, p, s in made:
    print(f"{n:6s} {round(s/1024,1):5.1f} KB")

cols = 3
rows = (len(made) + cols - 1) // cols
sheet = Image.new("RGB", (cols * 262, rows * 296), (250, 250, 250))
d = ImageDraw.Draw(sheet)
try:
    f = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 20)
except Exception:
    f = None
for i, (n, p, s) in enumerate(made):
    im = Image.open(p).convert("RGB").resize((250, 250), Image.LANCZOS)
    r, c = divmod(i, cols)
    sheet.paste(im, (c * 262 + 6, r * 296 + 34))
    d.text((c * 262 + 8, r * 296 + 8), n, font=f, fill=(20, 60, 40))
sheet.save(os.path.join(BASE, "docs", "pet-frames.png"), optimize=True)
print("ok")
