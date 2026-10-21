# -*- coding: utf-8 -*-
"""六段动作视频：参数 + 每段 8 帧联系表（合并成一张图）"""
import cv2, os, shutil
from PIL import Image, ImageDraw, ImageFont

DIR = r"D:\xwechat_files\wxid_h7yc0hrrudw521_2145\temp\RWTemp\2026-10\a443df26aa7bc12d97a4c923cc3e6598"
FILES = [
    "27476410d7e20e0d82fca7fbe55544a2.mp4",
    "9bea44b0927c265972a184eefb4c4c5e.mp4",
    "1ebfecdc1a6b4a0a2e5604d078d40a63.mp4",
    "8a132f9dd264a7f6f2e2a5acc795ffd9.mp4",
    "77e0373b679f323850d1820f8cf97e56.mp4",
    "147b4891681f4cc29597a7c40282432f.mp4",
]
BASE = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf"
TMP = os.environ["TEMP"]
FONT = r"C:\Windows\Fonts\msyh.ttc"
COLS, TW, TH = 8, 150, 290

rows = []
for i, name in enumerate(FILES, 1):
    src = os.path.join(DIR, name)
    if not os.path.exists(src):
        print(f"act{i}: MISSING")
        continue
    dst = os.path.join(TMP, f"act{i}.mp4")
    if not os.path.exists(dst):
        shutil.copyfile(src, dst)

    cap = cv2.VideoCapture(dst)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    dur = n / max(fps, 1)
    print(f"act{i}: {w}x{h} fps={fps:.0f} frames={n} dur={dur:.2f}s")

    thumbs = []
    for k in range(COLS):
        t = dur * (k + 0.5) / COLS
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, bgr = cap.read()
        if not ok:
            continue
        im = Image.fromarray(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
        im.thumbnail((TW - 6, TH - 30))
        thumbs.append((t, im))
    cap.release()
    rows.append((i, dur, thumbs))

sheet = Image.new("RGB", (COLS * TW, len(rows) * TH), (245, 245, 245))
d = ImageDraw.Draw(sheet)
try:
    f = ImageFont.truetype(FONT, 16)
except Exception:
    f = None
for r, (idx, dur, thumbs) in enumerate(rows):
    d.text((6, r * TH + 4), f"act{idx}  {dur:.1f}s", font=f, fill=(20, 60, 40))
    for c, (t, im) in enumerate(thumbs):
        sheet.paste(im, (c * TW + 3, r * TH + 26))
        d.text((c * TW + 6, r * TH + 26 + (TH - 34)), f"{t:.1f}s", font=f, fill=(90, 110, 100))

out = os.path.join(BASE, "docs", "actions-sheet.png")
sheet.save(out, optimize=True)
print("sheet:", sheet.size)
