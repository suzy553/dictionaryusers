# -*- coding: utf-8 -*-
"""重建 COUNTRIES（只保留有图国家） + 背单词页模糊背景"""
import re, io

PATH = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf\js\app.js"
src = io.open(PATH, encoding="utf-8").read()

NEW = """const COUNTRIES = [
  { name: '中国', emoji: '🏯', tag: '汉字之城', img: 'cn', sky: ['#fff1e0', '#ffd9b8'] },
  { name: '日本', emoji: '⛩️', tag: '樱花小径', img: 'jp', sky: ['#ffe9f0', '#ffc9dd'] },
  { name: '泰国', emoji: '🐘', tag: '雨林之国', img: 'th', sky: ['#eafaf0', '#bff0d0'] },
  { name: '印度', emoji: '🕌', tag: '香料集市', img: 'in', sky: ['#fff6dd', '#ffe2a3'] },
  { name: '希腊', emoji: '🏛️', tag: '爱琴海边', img: 'gr', sky: ['#e9f7ff', '#c4e9ff'] },
  { name: '意大利', emoji: '🍕', tag: '水城威尼斯', img: 'it', sky: ['#fff0e6', '#ffd2b3'] },
  { name: '法国', emoji: '🗼', tag: '塞纳河畔', img: 'fr', sky: ['#f2ecff', '#d9c8ff'] },
  { name: '英国', emoji: '🎡', tag: '伦敦雾', img: 'gb', sky: ['#eef2ff', '#cfd9ff'] },
  { name: '挪威', emoji: '🏔️', tag: '峡湾深处', img: 'no', sky: ['#eaf4ff', '#c6dfff'] },
  { name: '瑞士', emoji: '🏔️', tag: '阿尔卑斯', img: 'ch', sky: ['#eef8ee', '#c8ecc8'] },
  { name: '荷兰', emoji: '🌷', tag: '风车与运河', img: 'nl', sky: ['#eef6ff', '#cfe6ff'] },
  { name: '西班牙', emoji: '🏰', tag: '巴塞罗那', img: 'es', sky: ['#fff2e2', '#ffd2a0'] },
  { name: '俄罗斯', emoji: '🪆', tag: '红场雪夜', img: 'ru', sky: ['#f0f4ff', '#cdd8ff'] },
  { name: '德国', emoji: '🏰', tag: '新天鹅堡', img: 'de', sky: ['#eef6ee', '#c9e6c9'] },
  { name: '美国', emoji: '🗽', tag: '自由之城', img: 'us', sky: ['#eef4ff', '#c9d8ff'] },
  { name: '加拿大', emoji: '🍁', tag: '枫叶之国', img: 'ca', sky: ['#fff0ee', '#ffd0c9'] },
  { name: '澳洲', emoji: '🦘', tag: '悉尼港湾', img: 'au', sky: ['#eaf6ff', '#c2e0ff'] },
  { name: '新西兰', emoji: '🐑', tag: '中土世界', img: 'nz', sky: ['#eefaf4', '#c6f0dd'] },
  { name: '韩国', emoji: '🏮', tag: '首尔街头', img: 'kr', sky: ['#fdeeff', '#f0c8ff'] },
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
    raise SystemExit("COUNTRIES not found")
src = pattern.sub(NEW, src, count=1)

# 开始关卡时，把国家图设为背单词页背景
old = """function startNodeSession(info) {
  const p = progressOf();
  const fresh = info.ws.filter(w => !p[wordKey(w.w)]);
  startSession('node', fresh.length ? fresh : info.ws);
}"""
new = """function startNodeSession(info) {
  const p = progressOf();
  const fresh = info.ws.filter(w => !p[wordKey(w.w)]);
  // 关卡所属国家 -> 背单词页模糊背景
  const country = COUNTRIES[Math.floor(info.n / NODES_PER_CHAPTER) % COUNTRIES.length];
  const url = country && country.img ? `url('data/countries/${country.img}.jpg')` : 'none';
  document.documentElement.style.setProperty('--study-bg', url);
  startSession('node', fresh.length ? fresh : info.ws);
}"""
if old in src:
    src = src.replace(old, new)
else:
    print("WARN startNodeSession pattern not found")

io.open(PATH, "w", encoding="utf-8").write(src)
print("countries:", len(re.findall(r"\{ name:", src)))
