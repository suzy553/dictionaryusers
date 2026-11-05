#!/usr/bin/env node
/* 一次性改齐所有版本号：VERSION / sw.js / index.html 资源查询串 / meta */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const v = process.argv[2];
if (!/^\d+$/.test(v || '')) {
  console.error('用法：node scripts/bump-version.js 332');
  process.exit(1);
}

const root = path.join(__dirname, '..');
const file = (p) => path.join(root, p);
const read = (p) => fs.readFileSync(file(p), 'utf8');
const write = (p, s) => fs.writeFileSync(file(p), s, 'utf8');

write('VERSION', v);

let sw = read('sw.js');
if (!/xiaoyue-v\d+/.test(sw)) throw new Error('sw.js 里找不到 xiaoyue-vN');
write('sw.js', sw.replace(/xiaoyue-v\d+/, 'xiaoyue-v' + v));

let html = read('index.html');
html = html.replace(/\?v=\d+/g, '?v=' + v);
if (/name="app-version"/.test(html)) {
  html = html.replace(/name="app-version"\s+content="\d+"/, 'name="app-version" content="' + v + '"');
} else {
  html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="app-version" content="' + v + '">');
}
write('index.html', html);

console.log(`✓ 版本已统一为 v${v}（VERSION / sw.js / 资源查询串 / meta）`);
