# -*- coding: utf-8 -*-
"""从原始附件重新裁 1080x608 高清国家图（原图 1280 宽，缩小更锐利）"""
import os, shutil
from PIL import Image

ATT = r"C:\Users\su'su\.dsh\attachments\v1\objects"
OUT = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf\data\countries"
HI = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf\data\countries-hd"

MAP = {
    "cn": r"e1\e16b6a3b6bf710265fb6efbcd38b0b2cde5b3d7b84aaca2b35104c02fd906906",
    "id": r"6a\6ae84cee2fbb4aed4ae47e1eda7f43abc7eff91273179eb0b0591bf7b8509eb3",
    "ph": r"60\6088f7b26d47edbc1c12dbf8801f2e79aca9660b9dfe74524de4825639185d52",
    "vn": r"98\98bf942bdddddd61e97b751725c2861e99196fe90e1db71eddabbcfc9e4088d9",
    "my": r"10\106e640e65b2b910fc67ef55c337bd8283d1b9c7d05ac6387e253bf2fb2b5bce",
    "sg": r"b7\b72d5fb7c2adf1eb0165b6db3aadb26b213d827028f76da0524428021bb51d6c",
    "th": r"a1\a1438039c11ec5f2c6765a1997c726dfa6ef6556601dc26becb080263848291f",
    "in": r"7f\7fddfe878119620b03540955293cae96511772c319d39e7a04f6259dd5469987",
    "ae": r"db\db82c0fee8863b13b90197f3303c676ee28fca877a9537dad2f2d4b07b2e073f",
    "tr": r"d8\d8ea01157eba50d656d71858d7292d538b20e604cf15895d05b702c753f17ef5",
    "gr": r"c9\c9e116e85cf8b7e710c015cbdef71b01a821e6cdd56ef1ee5437ca8aaed7f779",
    "at": r"84\84ef1ceb1925e8c4381e63dd52bddc564d1cb2add6b98c64b97bfbfea0d35591",
    "fi": r"fc\fcf2622c39aa46b01e61a87ba2f2ae4144edefcc2f8611ed942d8bfe9f09efb1",
    "dk": r"fa\faff2ee34b5b4390fe6e85d8318391e75016886c5a49d00ff0e801667430d157",
    "se": r"3e\3e2dd843bb7bf577938a26312bbc51ad704e1bb5d16e79c5f084ac5cfe6abd06",
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

if os.path.isdir(HI):
    shutil.rmtree(HI)
os.makedirs(HI, exist_ok=True)

ok = 0
for code, rel in MAP.items():
    src = os.path.join(ATT, rel)
    if not os.path.exists(src):
        print("missing", code)
        continue
    im = Image.open(src).convert("RGB")
    w, h = im.size
    im = im.crop((0, 0, w, int(h * 0.855)))          # 去掉标题条 + 水印
    # 目标 1080x608，保持比例裁切
    target_ar = 16 / 9
    cur_ar = im.width / im.height
    if cur_ar > target_ar:                            # 太宽，切两侧
        nw = int(im.height * target_ar)
        left = (im.width - nw) // 2
        im = im.crop((left, 0, left + nw, im.height))
    else:                                             # 太高，切上下（保留上部主体）
        nh = int(im.width / target_ar)
        top = max(0, int((im.height - nh) * 0.42))
        im = im.crop((0, top, im.width, top + nh))
    im = im.resize((1080, 608), Image.LANCZOS)
    im.save(os.path.join(HI, f"{code}.jpg"), "JPEG", quality=84, optimize=True)
    ok += 1

total = sum(os.path.getsize(os.path.join(HI, f)) for f in os.listdir(HI)) / 1024
print("hd:", ok, "KB:", round(total))
