# -*- coding: utf-8 -*-
"""把系统里的行楷字体裁成只含「小越背单词」五个字的小体积 woff2"""
import os
from fontTools import subset
from fontTools.ttLib import TTFont

SRC = r"C:\Windows\Fonts\STXINGKA.TTF"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "fonts", "xiaoyue-hand.woff2")
TEXT = "\u5c0f\u8d8a\u80cc\u5355\u8bcd"  # 小越背单词

os.makedirs(os.path.dirname(OUT), exist_ok=True)

opts = subset.Options()
opts.flavor = "woff2"
opts.layout_features = ["*"]
opts.name_IDs = ["*"]
opts.notdef_outline = True
opts.recalc_bounds = True

font = TTFont(SRC)
sub = subset.Subsetter(opts)
sub.populate(text=TEXT)
sub.subset(font)
font.save(OUT)

print("out:", OUT)
print("kb:", round(os.path.getsize(OUT) / 1024, 1))
