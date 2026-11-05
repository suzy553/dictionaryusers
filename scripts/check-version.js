#!/usr/bin/env node
/* 校验版本号在 VERSION / sw.js / index.html 里一致，防止“改了版本号但没生效” */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

let version;
try {
  version = read('VERSION').trim();
} catch {
  console.error('✗ 缺少 VERSION 文件');
  process.exit(1);
}

const errors = [];
if (!/^\d+$/.test(version)) errors.push(`VERSION 不是纯数字：${version}`);

const sw = read('sw.js');
const swMatch = sw.match(/xiaoyue-v(\d+)/);
if (!swMatch) errors.push('sw.js 里找不到 xiaoyue-vN');
else if (swMatch[1] !== version) errors.push(`sw.js 是 v${swMatch[1]}，VERSION 是 v${version}`);

const html = read('index.html');
const assetVersions = [...html.matchAll(/\?v=(\d+)/g)].map((m) => m[1]);
if (!assetVersions.length) errors.push('index.html 里没有任何 ?v= 资源版本');
for (const v of new Set(assetVersions)) {
  if (v !== version) errors.push(`index.html 资源版本是 v${v}，VERSION 是 v${version}`);
}

const meta = html.match(/name="app-version"\s+content="(\d+)"/);
if (!meta) errors.push('index.html 缺少 <meta name="app-version">');
else if (meta[1] !== version) errors.push(`meta app-version 是 v${meta[1]}，VERSION 是 v${version}`);

const stat = html.match(/id="appVerStatic">版本 v(\d+)/);
if (!stat) errors.push('index.html 缺少静态版本号 appVerStatic');
else if (stat[1] !== version) errors.push(`appVerStatic 是 v${stat[1]}，VERSION 是 v${version}`);

if (errors.length) {
  console.error('✗ 版本号不一致：');
  for (const e of errors) console.error('  - ' + e);
  console.error('\n运行 node scripts/bump-version.js <新版本> 一次性改齐。');
  process.exit(1);
}

console.log(`✓ 版本一致：v${version}（${assetVersions.length} 个资源引用）`);
