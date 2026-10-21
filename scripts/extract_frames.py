# -*- coding: utf-8 -*-
"""从宠物视频里按间隔抽帧，拼成联系表供挑选"""
import cv2, os, math
from PIL import Image, ImageDraw, ImageFont

SRC = os.path.join(os.environ["TEMP"], "petvid.mp4")
OUT_DIR = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf\temp-frames"
SHEET = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf\docs\video-frames.png"
STEP = 0.25          # 每 0.25 秒一张
FONT = r"C:\Windows\Fonts\msyh.ttc"

os.makedirs(OUT_DIR, exist_ok=True)
for f in os.listdir(OUT_DIR):
    os.remove(os.path.join(OUT_DIR, f))

cap = cv2.VideoCapture(SRC)
fps = cap.get(cv2.CAP_PROP_FPS) or 24
total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
dur = total / fps

times = []
t = 0.0
while t < dur - 0.02:
    times.append(round(t, 2))
    t += STEP

frames = []
for idx, tt in enumerate(times):
    cap.set(cv2.CAP_PROP_POS_MSEC, tt * 1000)
    ok, frame = cap.read()
    if not ok:
        continue
    frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    img = Image.fromarray(frame)
    img.thumbnail((260, 460))
    frames.append((idx, tt, img))

cap.release()

COLS = 6
CELL_W, CELL_H = 270, 520
rows = math.ceil(len(frames) / COLS)
sheet = Image.new("RGB", (COLS * CELL_W, rows * CELL_H), (250, 250, 250))
d = ImageDraw.Draw(sheet)
try:
    f_big = ImageFont.truetype(FONT, 22)
    f_sm = ImageFont.truetype(FONT, 18)
except Exception:
    f_big = f_sm = ImageFont.load_default()

for k, (idx, tt, img) in enumerate(frames):
    r, c = divmod(k, COLS)
    x, y = c * CELL_W, r * CELL_H
    sheet.paste(img, (x + 5, y + 42))
    d.rectangle([x, y, x + CELL_W - 1, y + CELL_H - 1], outline=(220, 220, 220))
    d.text((x + 8, y + 8), f"#{idx}  {tt:.2f}s", font=f_big, fill=(20, 60, 40))

sheet.save(SHEET, optimize=True)
print("frames:", len(frames), "sheet:", sheet.size, round(os.path.getsize(SHEET) / 1024), "KB")
