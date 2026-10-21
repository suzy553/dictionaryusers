# -*- coding: utf-8 -*-
"""从视频2截取待机呼吸循环（20帧），并生成预览条"""
import cv2, os
from PIL import Image

BASE = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf"
OUT = os.path.join(BASE, "data", "pet", "idle")
os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT):
    os.remove(os.path.join(OUT, f))

SRC = os.path.join(os.environ["TEMP"], "petvid2.mp4")   # 站立+呼吸+眨眼
START, DUR = 5.2, 3.0
N, CW, CH = 20, 220, 275
# 4:5 裁切窗
CROP_W, CROP_H = 720, 900
CX, CY = 360, 640

cap = cv2.VideoCapture(SRC)
thumbs = []
for i in range(N):
    t = START + DUR * i / N
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, bgr = cap.read()
    if not ok:
        break
    H, W = bgr.shape[:2]
    l = int(max(0, min(W - CROP_W, CX - CROP_W / 2)))
    t0 = int(max(0, min(H - CROP_H, CY - CROP_H / 2)))
    crop = bgr[t0:t0 + CROP_H, l:l + CROP_W]
    small = cv2.resize(crop, (CW, CH), interpolation=cv2.INTER_AREA)
    p = os.path.join(OUT, f"{i:02d}.webp")
    cv2.imwrite(p, small, [cv2.IMWRITE_WEBP_QUALITY, 82])
    thumbs.append(Image.fromarray(cv2.cvtColor(small, cv2.COLOR_BGR2RGB)))
cap.release()

total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print("frames:", len(thumbs), "KB:", round(total / 1024, 1))

# 预览条（10 帧一格）
show = thumbs[::2]
cols = 5
rows = (len(show) + cols - 1) // cols
sheet = Image.new("RGB", (cols * 150, rows * 190), (245, 245, 245))
for i, im in enumerate(show):
    r, c = divmod(i, cols)
    sheet.paste(im.resize((144, 180), Image.LANCZOS), (c * 150 + 3, r * 190 + 5))
sheet.save(os.path.join(BASE, "docs", "idle-preview.png"), optimize=True)
print("preview ok")
