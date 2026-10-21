# -*- coding: utf-8 -*-
"""哄睡视频 → idle 风格的 9:16 序列帧"""
import cv2, os, shutil

BASE = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf"
OUT = os.path.join(BASE, "data", "pet", "seq", "sleep")
SRC = os.path.join(os.environ["TEMP"], "sleep.mp4")
W, H, N = 270, 480, 20

if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(OUT, exist_ok=True)

cap = cv2.VideoCapture(SRC)
fps = cap.get(cv2.CAP_PROP_FPS) or 30
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
dur = total / fps
t0, t1 = 0.0, dur

total_kb = 0
for i in range(N):
    t = t0 + (t1 - t0) * i / max(N - 1, 1)
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, bgr = cap.read()
    if not ok:
        continue
    img = cv2.resize(bgr, (W, H), interpolation=cv2.INTER_AREA)
    p = os.path.join(OUT, f"{i:02d}.webp")
    cv2.imwrite(p, img, [cv2.IMWRITE_WEBP_QUALITY, 78])
    total_kb += os.path.getsize(p)
cap.release()
print("sleep frames:", N, "KB:", round(total_kb / 1024, 1))
