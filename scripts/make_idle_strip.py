# -*- coding: utf-8 -*-
"""把视频抽成横向精灵图（idle 循环），配合 JS 逐帧播放"""
import cv2, os
from PIL import Image

BASE = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf"
OUT = os.path.join(BASE, "data", "pet")
os.makedirs(OUT, exist_ok=True)

SRC = os.path.join(os.environ["TEMP"], "petvid.mp4")   # 视频1：站立+眨眼
START = 0.0
DUR = 2.0
N = 20                 # 20 帧
CELL_W, CELL_H = 240, 300   # 4:5，与场景比例一致

cap = cv2.VideoCapture(SRC)
frames = []
for i in range(N):
    t = START + DUR * i / N
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, bgr = cap.read()
    if not ok:
        break
    H, W = bgr.shape[:2]
    cw, ch = 720, 900
    cx, cy = 360, 700
    l = int(max(0, min(W - cw, cx - cw / 2)))
    t0 = int(max(0, min(H - ch, cy - ch / 2)))
    crop = bgr[t0:t0 + ch, l:l + cw]
    crop = cv2.resize(crop, (CELL_W, CELL_H), interpolation=cv2.INTER_AREA)
    frames.append(Image.fromarray(cv2.cvtColor(crop, cv2.COLOR_BGR2RGB)))
cap.release()

print("frames:", len(frames))

strip = Image.new("RGB", (CELL_W * len(frames), CELL_H), (240, 245, 240))
for i, im in enumerate(frames):
    strip.paste(im, (i * CELL_W, 0))

path = os.path.join(OUT, "idle-strip.webp")
strip.save(path, "WEBP", quality=80, method=6)
print("strip:", strip.size, round(os.path.getsize(path) / 1024, 1), "KB")
