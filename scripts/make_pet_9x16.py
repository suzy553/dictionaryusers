# -*- coding: utf-8 -*-
"""全部按 9:16 原画面导出：idle 序列 + 5 个动作帧"""
import cv2, os
from PIL import Image

BASE = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf"
PET = os.path.join(BASE, "data", "pet")
IDLE = os.path.join(PET, "idle")
os.makedirs(IDLE, exist_ok=True)
for f in os.listdir(IDLE):
    os.remove(os.path.join(IDLE, f))

V1 = os.path.join(os.environ["TEMP"], "petvid.mp4")    # 喝水/吃饭/开心
V2 = os.path.join(os.environ["TEMP"], "petvid2.mp4")   # 站立/眨眼/生气/呼吸

W, H = 270, 480          # 9:16

def grab(cap, t):
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, bgr = cap.read()
    if not ok:
        return None
    return cv2.resize(bgr, (W, H), interpolation=cv2.INTER_AREA)

# ---- idle 序列：视频2 站立呼吸段（3.0~5.0s，未推镜）----
cap2 = cv2.VideoCapture(V2)
N = 20
START, DUR = 2.6, 2.4
for i in range(N):
    f = grab(cap2, START + DUR * i / N)
    if f is not None:
        cv2.imwrite(os.path.join(IDLE, f"{i:02d}.webp"), f, [cv2.IMWRITE_WEBP_QUALITY, 82])

# ---- 动作帧 ----
JOBS = {
    "idle":  (V2, 3.4),
    "blink": (V2, 6.8),
    "angry": (V2, 9.6),
    "eat":   (V1, 4.0),
    "drink": (V1, 1.5),
    "happy": (V1, 2.5),
}
caps = {}
for name, (src, t) in JOBS.items():
    if src not in caps:
        caps[src] = cv2.VideoCapture(src)
    f = grab(caps[src], t)
    if f is not None:
        cv2.imwrite(os.path.join(PET, f"pet-{name}.webp"), f, [cv2.IMWRITE_WEBP_QUALITY, 84])

for c in caps.values():
    c.release()
cap2.release()

idle_kb = sum(os.path.getsize(os.path.join(IDLE, f)) for f in os.listdir(IDLE)) / 1024
print("idle frames KB:", round(idle_kb, 1))
print("done")

# 预览
thumbs = [Image.open(os.path.join(IDLE, f"{i:02d}.webp")) for i in range(0, 20, 4)]
sheet = Image.new("RGB", (len(thumbs) * 140, 250), (245, 245, 245))
for i, im in enumerate(thumbs):
    sheet.paste(im.resize((135, 240), Image.LANCZOS), (i * 140 + 2, 5))
sheet.save(os.path.join(BASE, "docs", "idle-preview.png"), optimize=True)
