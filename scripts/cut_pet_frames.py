# -*- coding: utf-8 -*-
"""固定机位：按动作微调取景中心，统一裁切 512x512"""
import cv2, os
from PIL import Image, ImageDraw, ImageFont

SRC = os.path.join(os.environ["TEMP"], "petvid.mp4")
BASE = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf"
OUT = os.path.join(BASE, "data", "pet")
os.makedirs(OUT, exist_ok=True)

# 名字 -> (秒, 中心x, 中心y, 边长)
FRAMES = {
    "idle":  (0.00, 360, 700, 620),
    "blink": (0.50, 360, 700, 620),
    "drink": (1.50, 360, 790, 620),
    "eat":   (4.00, 360, 820, 620),
    "happy": (2.50, 360, 690, 620),
    "angry": (7.00, 360, 760, 660),
}

cap = cv2.VideoCapture(SRC)
H = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
W = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
made = []

for name, (t, cx, cy, side) in FRAMES.items():
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, bgr = cap.read()
    if not ok:
        continue
    half = side / 2
    l = int(max(0, min(W - side, cx - half)))
    t0 = int(max(0, min(H - side, cy - half)))
    crop = bgr[t0:t0 + int(side), l:l + int(side)]
    crop = cv2.resize(crop, (512, 512), interpolation=cv2.INTER_AREA)
    path = os.path.join(OUT, f"pet-{name}.webp")
    cv2.imwrite(path, crop, [cv2.IMWRITE_WEBP_QUALITY, 88])
    made.append((name, path, os.path.getsize(path)))

cap.release()

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
