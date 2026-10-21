# -*- coding: utf-8 -*-
"""统一用视频1（同一机位）导出：idle 序列 + 每个动作 3 帧过渡"""
import cv2, os

BASE = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf"
PET = os.path.join(BASE, "data", "pet")
IDLE = os.path.join(PET, "idle")
ACT = os.path.join(PET, "act")
os.makedirs(IDLE, exist_ok=True)
os.makedirs(ACT, exist_ok=True)
for d in (IDLE, ACT):
    for f in os.listdir(d):
        os.remove(os.path.join(d, f))

SRC = os.path.join(os.environ["TEMP"], "petvid.mp4")   # 动作素材（近景）
W, H = 270, 480                                        # 9:16

cap = cv2.VideoCapture(SRC)

def grab(t):
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, bgr = cap.read()
    if not ok:
        return None
    return cv2.resize(bgr, (W, H), interpolation=cv2.INTER_AREA)

# ---- idle：视频2 的 2.6~5.0s（纯站立呼吸，无道具）----
cap2 = cv2.VideoCapture(os.path.join(os.environ["TEMP"], "petvid2.mp4"))
N = 20
for i in range(N):
    t = 2.6 + 2.4 * i / N
    cap2.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, bgr = cap2.read()
    if ok:
        f = cv2.resize(bgr, (W, H), interpolation=cv2.INTER_AREA)
        cv2.imwrite(os.path.join(IDLE, f"{i:02d}.webp"), f, [cv2.IMWRITE_WEBP_QUALITY, 82])
cap2.release()

# ---- 动作：每个 3 帧，制造过程感 ----
ACTIONS = {
    "drink": [1.30, 1.55, 1.80],
    "eat":   [3.80, 4.05, 4.30],
    "happy": [2.30, 2.55, 2.80],
    "angry": [6.60, 7.00, 7.40],
    "blink": [0.45, 0.55, 0.65],
}
for name, times in ACTIONS.items():
    for i, t in enumerate(times):
        f = grab(t)
        if f is not None:
            cv2.imwrite(os.path.join(ACT, f"{name}-{i}.webp"), f, [cv2.IMWRITE_WEBP_QUALITY, 84])

cap.release()

def kb(d):
    return round(sum(os.path.getsize(os.path.join(d, f)) for f in os.listdir(d)) / 1024, 1)

print("idle KB:", kb(IDLE))
print("act  KB:", kb(ACT))
print("act files:", sorted(os.listdir(ACT)))
