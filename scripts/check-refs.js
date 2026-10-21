#!/usr/bin/env node
/**
 * 静态资源引用检查
 * 扫描 JS / HTML / CSS 里引用的本地文件，验证是否真实存在。
 * 有缺失就以非 0 退出，让 CI 变红。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN = ['js', 'css'];
const EXT = ['.js', '.html', '.css'];

const files = [];
for (const d of SCAN) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (EXT.includes(path.extname(f))) files.push(path.join(dir, f));
  }
}
files.push(path.join(ROOT, 'index.html'));
files.push(path.join(ROOT, 'sw.js'));

// 只关心 data/ 和 fonts/ icons/ 下的资源
const RE = /['"(](?:\.\/)?((?:data|fonts|icons|css|js)\/[A-Za-z0-9_\-\/\.%${}]+)['")]/g;
// 含模板变量的路径跳过（运行期才确定）
const SKIP_TPL = /\$\{|\+ *'|%20/;

const missing = new Map();
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = RE.exec(src))) {
    let p = m[1];
    if (SKIP_TPL.test(p)) continue;
    if (p.includes('*')) continue;
    const abs = path.join(ROOT, p);
    if (!fs.existsSync(abs)) {
      if (!missing.has(p)) missing.set(p, new Set());
      missing.get(p).add(path.relative(ROOT, file));
    }
  }
}

if (missing.size === 0) {
  console.log(`✓ 资源引用检查通过（扫描 ${files.length} 个文件）`);
  process.exit(0);
}

console.error(`✗ 发现 ${missing.size} 个不存在的资源引用：\n`);
for (const [p, where] of [...missing].sort()) {
  console.error(`  ${p}`);
  for (const w of where) console.error(`      ← ${w}`);
}
process.exit(1);
