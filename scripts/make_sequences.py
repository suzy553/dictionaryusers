# -*- coding: utf-8 -*-
"""六段动作 → 统一 9:16 序列帧"""
import cv2, os

BASE = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf"
SEQ = os.path.join(BASE, "data", "pet", "seq")
TMP = os.environ["TEMP"]
W, H = 270, 480

# 名称 -> (视频, 帧数, 起始秒, 结束秒)
PLAN = {
    "idle":  ("act4.mp4", 24, 0.1, 3.1),
    "eat":   ("act2.mp4", 20, 0.2, 2.4),
    "drink": ("act1.mp4", 20, 0.2, 2.6),
    "angry": ("act6.mp4", 20, 0.1, 2.5),
    "happy": ("act1.mp4", 10, 2.0, 2.9),
    "back":  ("act3.mp4", 12, 0.1, 1.9),
}

if os.path.isdir(SEQ):
    import shutil
    shutil.rmtree(SEQ)
os.makedirs(SEQ, exist_ok=True)

summary = []
for name, (fname, count, t0, t1) in PLAN.items():
    src = os.path.join(TMP, fname)
    if not os.path.exists(src):
        print("missing", fname)
        continue
    out = os.path.join(SEQ, name)
    os.makedirs(out, exist_ok=True)
    cap = cv2.VideoCapture(src)
    total = 0
    for i in range(count):
        t = t0 + (t1 - t0) * i / max(count - 1, 1)
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, bgr = cap.read()
        if not ok:
            continue
        img = cv2.resize(bgr, (W, H), interpolation=cv2.INTER_AREA)
        p = os.path.join(out, f"{i:02d}.webp")
        cv2.imwrite(p, img, [cv2.IMWRITE_WEBP_QUALITY, 78])
        total += os.path.getsize(p)
    cap.release()
    summary.append((name, count, round(total / 1024, 1)))

for s in summary:
    print(f"{s[0]:6s} {s[1]:3d} 帧  {s[2]:6.1f} KB")

allkb = sum(os.path.getsize(os.path.join(dp, f))
            for dp, _, fs in os.walk(SEQ) for f in fs) / 1024
print("TOTAL KB:", round(allkb, 1))
