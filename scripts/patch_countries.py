# -*- coding: utf-8 -*-
"""替换 COUNTRIES 数组：加入图片字段 + 9 个新国家"""
import re, io, os

PATH = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf\js\app.js"
src = io.open(PATH, encoding="utf-8").read()

NEW = """const COUNTRIES = [
  { name: '中国', emoji: '🏯', tag: '汉字之城', img: 'cn', sky: ['#fff1e0', '#ffd9b8'] },
  { name: '日本', emoji: '⛩️', tag: '樱花小径', sky: ['#ffe9f0', '#ffc9dd'] },
  { name: '泰国', emoji: '🐘', tag: '雨林之国', img: 'th', sky: ['#eafaf0', '#bff0d0'] },
  { name: '印度', emoji: '🕌', tag: '香料集市', img: 'in', sky: ['#fff6dd', '#ffe2a3'] },
  { name: '埃及', emoji: '🐫', tag: '金字塔下', sky: ['#fff3d6', '#ffdf9e'] },
  { name: '希腊', emoji: '🏛️', tag: '爱琴海边', img: 'gr', sky: ['#e9f7ff', '#c4e9ff'] },
  { name: '意大利', emoji: '🍕', tag: '托斯卡纳', sky: ['#fff0e6', '#ffd2b3'] },
  { name: '法国', emoji: '🗼', tag: '塞纳河畔', sky: ['#f2ecff', '#d9c8ff'] },
  { name: '英国', emoji: '🎡', tag: '伦敦雾', sky: ['#eef2ff', '#cfd9ff'] },
  { name: '冰岛', emoji: '🌋', tag: '极光之地', sky: ['#e8f6ff', '#bfe6ff'] },
  { name: '挪威', emoji: '🏔️', tag: '峡湾深处', sky: ['#eaf4ff', '#c6dfff'] },
  { name: '俄罗斯', emoji: '🪆', tag: '红场雪夜', sky: ['#f0f4ff', '#cdd8ff'] },
  { name: '美国', emoji: '🗽', tag: '自由之城', sky: ['#eef4ff', '#c9d8ff'] },
  { name: '加拿大', emoji: '🍁', tag: '枫叶之国', sky: ['#fff0ee', '#ffd0c9'] },
  { name: '巴西', emoji: '🌴', tag: '亚马逊', sky: ['#eefaf0', '#c3f0cd'] },
  { name: '澳洲', emoji: '🦘', tag: '红土内陆', sky: ['#fff3e6', '#ffd9b3'] },
  { name: '新西兰', emoji: '🐑', tag: '中土世界', sky: ['#eefaf4', '#c6f0dd'] },
  { name: '韩国', emoji: '🏮', tag: '首尔街头', sky: ['#fdeeff', '#f0c8ff'] },
  { name: '越南', emoji: '⛵', tag: '下龙湾', img: 'vn', sky: ['#e9faf6', '#b9efe0'] },
  { name: '土耳其', emoji: '🕌', tag: '博斯普鲁斯', img: 'tr', sky: ['#fff2e8', '#ffd4b8'] },
  { name: '印度尼西亚', emoji: '🌺', tag: '千岛之国', img: 'id', sky: ['#fff1e3', '#ffd0a8'] },
  { name: '菲律宾', emoji: '🏝️', tag: '七千岛屿', img: 'ph', sky: ['#fff4e2', '#ffd9a8'] },
  { name: '马来西亚', emoji: '🏙️', tag: '双子塔', img: 'my', sky: ['#eef0ff', '#c8cfff'] },
  { name: '新加坡', emoji: '🦁', tag: '狮城夜色', img: 'sg', sky: ['#eaf2ff', '#c2d4ff'] },
  { name: '阿联酋', emoji: '🏗️', tag: '沙漠之城', img: 'ae', sky: ['#fff3dd', '#ffd79a'] },
  { name: '奥地利', emoji: '🎻', tag: '音乐之都', img: 'at', sky: ['#f5fae8', '#dcf0b8'] },
  { name: '芬兰', emoji: '🌌', tag: '极光玻璃屋', img: 'fi', sky: ['#e9f0ff', '#c0d4ff'] },
  { name: '丹麦', emoji: '⛵', tag: '新港彩屋', img: 'dk', sky: ['#fff2e6', '#ffd6b0'] },
  { name: '瑞典', emoji: '🏰', tag: '斯德哥尔摩', img: 'se', sky: ['#fff4e8', '#ffd8b8'] }
];"""

pattern = re.compile(r"const COUNTRIES = \[.*?\n\];", re.S)
if not pattern.search(src):
    raise SystemExit("COUNTRIES block not found")
src = pattern.sub(NEW, src, count=1)

# 章节头：有图片就用图片
old_head = '<header class="chapter-head" style="--sky1:${country.sky[0]};--sky2:${country.sky[1]};background-image:${sceneURL(country, c)}">'
new_head = '<header class="chapter-head" style="--sky1:${country.sky[0]};--sky2:${country.sky[1]};background-image:${country.img ? `url(\'data/countries/${country.img}.jpg\')` : sceneURL(country, c)}">'
if old_head in src:
    src = src.replace(old_head, new_head)
else:
    print("WARN header pattern not found")

io.open(PATH, "w", encoding="utf-8").write(src)
print("countries:", src.count("{ name:"))
print("img fields:", src.count("img: '"))
