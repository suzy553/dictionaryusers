# -*- coding: utf-8 -*-
"""导入第二批国家图（裁掉底部标题 + 水印）"""
import os
from PIL import Image

ATT = r"C:\Users\su'su\.dsh\attachments\v1\objects"
OUT = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf\data\countries"

MAP = {
    "nz": r"fd\fdff38823029f0540a3d541926d9e20cd2cc5ff442be6438420884872fceb467",
    "it": r"60\60741f8eeba7e3833906a567ae57719bff3fe1fd3a15eef02e7d4f96d06ccf01",
    "jp": r"30\3009b972dc2d072b4480452eb94c45d4f47f9464358602dfc9c9b815653f5d82",
    "fr": r"cf\cfe28aac9a20ef311f0b6d63af7a9c5548ff17165ad34599b8b11966af08b2c1",
    "no": r"9d\9de1e23851cafc47c2eb6452350898fef79cf683fceaaf2f5eabe550182b3a0f",
    "ch": r"31\31f3ca34b6df183ec9194aae261bef018797a7a46730cd0be5eae70659c5b311",
    "nl": r"36\360de957cabc2872b49ead7023fded3575ff430c21fcc072018c8e6ed791c1e2",
    "es": r"eb\eb6edad6023f0b3f4007b6c67ae8cfc2beea7c120877cc66807382ece7333548",
    "ru": r"94\94952baa7c0c74cce190a62ff474ac5a2747aa3a32a69cfc602df1146532b466",
    "gb": r"ff\ff62fdc90e081f8186b1b3ee5c8e6516fc8063e428090d8d6e435c932b1eda85",
    "kr": r"dd\dde56565836d0b14100dff847aa0e02bbe9df32ed196bf8d35e8f69a547c26ed",
    "us": r"d1\d1425d303e6906161f17cc5549c4380a7663a2b2bf6e799f19538397d73bdb4d",
    "de": r"1d\1dc6cb4796ff3e3e38cdf3bb2026453020a9e9e91a9545d71ecf21534fbf252d",
    "au": r"d1\d1c6d1d6389eb7fa3b675b9da882b04cff201499abe49bc55d7458463302e339",
    "ca": r"8d\8df396e89eb8efa3190fa7ac3c1cf3f0ddc947c075a8a6ea81fa5fe8fb79e033",
}

ok = 0
for code, rel in MAP.items():
    src = os.path.join(ATT, rel)
    if not os.path.exists(src):
        print("missing", code)
        continue
    im = Image.open(src).convert("RGB")
    w, h = im.size
    im = im.crop((0, 0, w, int(h * 0.855)))
    im = im.resize((720, int(720 * im.height / w)), Image.LANCZOS)
    ch = int(720 * 9 / 16)
    if im.height > ch:
        top = max(0, (im.height - ch) // 2)
        im = im.crop((0, top, 720, top + ch))
    im.save(os.path.join(OUT, f"{code}.jpg"), "JPEG", quality=82, optimize=True)
    ok += 1

total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print("new:", ok, "all:", len(os.listdir(OUT)), "KB:", round(total / 1024))
print(sorted(os.listdir(OUT)))
