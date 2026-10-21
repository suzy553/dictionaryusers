# -*- coding: utf-8 -*-
"""为第二个宠物视频生成联系表"""
import cv2, os, math
from PIL import Image, ImageDraw, ImageFont

SRC = os.path.join(os.environ["TEMP"], "petvid2.mp4")
BASE = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf"
SHEET = os.path.join(BASE, "docs", "video2-frames.png")
STEP = 0.4

cap = cv2.VideoCapture(SRC)
fps = cap.get(cv2.CAP_PROP_FPS) or 24
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
dur = total / fps

frames = []
t = 0.0
idx = 0
while t < dur - 0.02:
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, bgr = cap.read()
    if ok:
        img = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
        img.thumbnail((230, 410))
        frames.append((idx, t, img))
    t += STEP
    idx += 1
cap.release()

COLS = 6
CW, CH = 240, 460
rows = math.ceil(len(frames) / COLS)
sheet = Image.new("RGB", (COLS * CW, rows * CH), (250, 250, 250))
d = ImageDraw.Draw(sheet)
try:
    f = ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", 20)
except Exception:
    f = None
for k, (i, tt, img) in enumerate(frames):
    r, c = divmod(k, COLS)
    x, y = c * CW, r * CH
    sheet.paste(img, (x + 5, y + 34))
    d.text((x + 8, y + 6), f"#{i} {tt:.1f}s", font=f, fill=(20, 60, 40))
sheet.save(SHEET, optimize=True)
print("frames:", len(frames), sheet.size)
