# -*- coding: utf-8 -*-
"""导入国家风景图：裁掉底部标题条与豆包水印，统一成 16:9 卡片"""
import os
from PIL import Image

ATT = r"C:\Users\su'su\.dsh\attachments\v1\objects"
BASE = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf"
OUT = os.path.join(BASE, "data", "countries")
os.makedirs(OUT, exist_ok=True)

MAP = {
    "cn": ("中国", r"e1\e16b6a3b6bf710265fb6efbcd38b0b2cde5b3d7b84aaca2b35104c02fd906906"),
    "id": ("印度尼西亚", r"6a\6ae84cee2fbb4aed4ae47e1eda7f43abc7eff91273179eb0b0591bf7b8509eb3"),
    "ph": ("菲律宾", r"60\6088f7b26d47edbc1c12dbf8801f2e79aca9660b9dfe74524de4825639185d52"),
    "vn": ("越南", r"98\98bf942bdddddd61e97b751725c2861e99196fe90e1db71eddabbcfc9e4088d9"),
    "my": ("马来西亚", r"10\106e640e65b2b910fc67ef55c337bd8283d1b9c7d05ac6387e253bf2fb2b5bce"),
    "sg": ("新加坡", r"b7\b72d5fb7c2adf1eb0165b6db3aadb26b213d827028f76da0524428021bb51d6c"),
    "th": ("泰国", r"a1\a1438039c11ec5f2c6765a1997c726dfa6ef6556601dc26becb080263848291f"),
    "in": ("印度", r"7f\7fddfe878119620b03540955293cae96511772c319d39e7a04f6259dd5469987"),
    "ae": ("阿联酋", r"db\db82c0fee8863b13b90197f3303c676ee28fca877a9537dad2f2d4b07b2e073f"),
    "tr": ("土耳其", r"d8\d8ea01157eba50d656d71858d7292d538b20e604cf15895d05b702c753f17ef5"),
    "gr": ("希腊", r"c9\c9e116e85cf8b7e710c015cbdef71b01a821e6cdd56ef1ee5437ca8aaed7f779"),
    "at": ("奥地利", r"84\84ef1ceb1925e8c4381e63dd52bddc564d1cb2add6b98c64b97bfbfea0d35591"),
    "fi": ("芬兰", r"fc\fcf2622c39aa46b01e61a87ba2f2ae4144edefcc2f8611ed942d8bfe9f09efb1"),
    "dk": ("丹麦", r"fa\faff2ee34b5b4390fe6e85d8318391e75016886c5a49d00ff0e801667430d157"),
    "se": ("瑞典", r"3e\3e2dd843bb7bf577938a26312bbc51ad704e1bb5d16e79c5f084ac5cfe6abd06"),
}

ok = 0
for code, (name, rel) in MAP.items():
    src = os.path.join(ATT, rel)
    if not os.path.exists(src):
        print("missing", name, src)
        continue
    im = Image.open(src).convert("RGB")
    w, h = im.size
    # 原图 1280x2278，底部约 290px 是标题+水印，再留一点余量
    crop_h = int(h * 0.855)
    im = im.crop((0, 0, w, crop_h))
    # 缩到宽 720，再裁 16:9
    im = im.resize((720, int(720 * crop_h / w)), Image.LANCZOS)
    ch = int(720 * 9 / 16)
    if im.height > ch:
        top = max(0, (im.height - ch) // 2)
        im = im.crop((0, top, 720, top + ch))
    im.save(os.path.join(OUT, f"{code}.jpg"), "JPEG", quality=82, optimize=True)
    ok += 1

total = sum(os.path.getsize(os.path.join(OUT, f)) for f in os.listdir(OUT))
print("saved:", ok, "total KB:", round(total / 1024, 1))
print(sorted(os.listdir(OUT)))
