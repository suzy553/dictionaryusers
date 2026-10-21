#!/usr/bin/env node
/**
 * 未定义函数检查
 * 找出「被调用但从未定义」的项目自有函数，防止删代码后留下悬空调用。
 * 有发现即 exit 1。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const files = [];
for (const d of ['js']) {
  const dir = path.join(ROOT, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (f.endsWith('.js') && !f.endsWith('.bak.js')) files.push(path.join(dir, f));
  }
}
const src = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');

// 定义
const defined = new Set();
for (const m of src.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g)) defined.add(m[1]);
for (const m of src.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);
for (const m of src.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) defined.add(m[1]);

// CSS 函数 / 语言关键字 / 浏览器 API（白名单）
const IGNORE = new Set(`
translateY translateX translate scale rotate blur calc var min max clamp rgb rgba
hsl hsla url linear-gradient radial-gradient cubic-bezier inset rgba
if for while switch catch function return typeof instanceof new delete void
Array Object String Number Boolean Math Date JSON Promise Map Set RegExp Error
console document window localStorage sessionStorage navigator location history
setTimeout setInterval clearTimeout clearInterval requestAnimationFrame
parseInt parseFloat isNaN isFinite encodeURIComponent decodeURIComponent
getComputedStyle matchMedia fetch alert confirm prompt
Blob URL FileReader FormData Image Audio AudioContext SpeechSynthesisUtterance
speechSynthesis addEventListener removeEventListener querySelector querySelectorAll
getElementById createElement appendChild createTextNode setAttribute getAttribute
removeAttribute classList contains toggle add remove closest scrollTo scrollIntoView
focus blur click submit preventDefault stopPropagation btoa atob structuredClone
queueMicrotask reportError CustomEvent Event ResizeObserver IntersectionObserver
caches keys matchAll put test exec replace replaceAll padStart padEnd includes
startsWith endsWith toFixed join map filter forEach reduce some every find
sort slice splice concat split trim toLowerCase toUpperCase String Number
requestIdleCallback createImageBitmap OffscreenCanvas CanvasRenderingContext2D
`.split(/\s+/).filter(Boolean));

const problems = [];
for (const m of src.matchAll(/(?<![.\w$])([a-z][A-Za-z0-9_$]{3,})\s*\(/g)) {
  const name = m[1];
  if (defined.has(name) || IGNORE.has(name)) continue;
  // 只关心项目风格命名（含大写字母，或 pet/owl 前缀）
  if (!/[A-Z]/.test(name) && !/^(pet|owl)/.test(name)) continue;
  const line = src.slice(0, m.index).split('\n').length;
  problems.push({ name, line });
}

const uniq = [...new Map(problems.map(p => [p.name, p])).values()];
if (!uniq.length) {
  console.log(`✓ 未定义函数检查通过（${defined.size} 个定义）`);
  process.exit(0);
}
console.error(`✗ 发现 ${uniq.length} 个「被调用但未定义」的函数：`);
for (const p of uniq) console.error(`  ${p.name}()  (≈第 ${p.line} 行)`);
process.exit(1);
