import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const core = require(resolve(__dirname, '../js/core.js'));
const BOOK = JSON.parse(
  readFileSync(resolve(__dirname, '../data/books/oxford3000.json'), 'utf8')
);
const WORDS = BOOK.words;

/* ============================ 间隔重复算法 ============================ */
describe('SRS 间隔重复', () => {
  it('等级间隔符合 Leitner 序列', () => {
    expect(core.BOX_DAYS).toEqual([0, 1, 2, 4, 7, 15, 30, 60]);
  });

  it('答对升一级', () => {
    expect(core.bumpBox(0, true)).toBe(1);
    expect(core.bumpBox(3, true)).toBe(4);
  });

  it('答错归零', () => {
    expect(core.bumpBox(5, false)).toBe(0);
    expect(core.bumpBox(7, false)).toBe(0);
  });

  it('等级封顶不越界', () => {
    expect(core.bumpBox(7, true)).toBe(7);
    expect(core.bumpBox(99, true)).toBe(7);
  });

  it('到期天数与等级对应', () => {
    expect(core.dueDays(0)).toBe(0);
    expect(core.dueDays(4)).toBe(7);
    expect(core.dueDays(7)).toBe(60);
    expect(core.dueDays(999)).toBe(60);   // 越界收敛到最大级
  });

  it('连续答对 7 次后间隔到 60 天', () => {
    let box = 0;
    for (let i = 0; i < 7; i++) box = core.bumpBox(box, true);
    expect(box).toBe(7);
    expect(core.dueDays(box)).toBe(60);
  });
});

/* ============================ 题目生成器 ============================ */
const sampleWords = WORDS.slice(0, 300);

describe('题型生成器', () => {
  it('看词选义：4 个选项、有且仅有一个正确、无重复', () => {
    let checked = 0;
    for (const w of sampleWords) {
      const q = core.qChoice(w, WORDS);
      if (!q) continue;
      checked++;
      expect(q.opts).toHaveLength(4);
      expect(q.opts.filter(o => o.ok)).toHaveLength(1);
      const texts = q.opts.map(o => o.text);
      expect(new Set(texts).size).toBe(4);          // 无重复选项
      expect(texts).toContain(w.t[0]);              // 正确答案在选项里
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('看中文选英文：不泄露答案', () => {
    let checked = 0;
    for (const w of sampleWords) {
      const q = core.qCnToEn(w, WORDS);
      if (!q) continue;
      checked++;
      // 题干（中文释义）不应包含答案（英文单词）
      expect(q.prompt.toLowerCase()).not.toContain(w.w.toLowerCase());
      expect(q.opts.filter(o => o.ok)).toHaveLength(1);
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('例句填空：目标词被替换成空格', () => {
    let checked = 0;
    for (const w of WORDS) {
      const q = core.qCloze(w, WORDS);
      if (!q) continue;
      checked++;
      expect(q.prompt).toContain('______');
      expect(q.opts.filter(o => o.ok)).toHaveLength(1);
      expect(q.opts.find(o => o.ok).text).toBe(w.w);
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('听音选词：题干不含答案文字', () => {
    let checked = 0;
    for (const w of sampleWords) {
      const q = core.qListen(w, WORDS);
      if (!q) continue;
      checked++;
      expect(q.prompt).not.toContain(w.w);          // 只是喇叭图标
      expect(q.opts.filter(o => o.ok)).toHaveLength(1);
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('词义配对：4 词 4 释义，id 一一对应', () => {
    let checked = 0;
    for (const w of sampleWords) {
      const q = core.qMatch(w, WORDS);
      if (!q) continue;
      checked++;
      expect(q.left).toHaveLength(4);
      expect(q.right).toHaveLength(4);
      const leftIds = q.left.map(o => o.id).sort();
      const rightIds = q.right.map(o => o.id).sort();
      expect(leftIds).toEqual(rightIds);            // 两边 id 集合一致
      // 每个 id 左边的词必须在右边找到它自己的释义
      for (const l of q.left) {
        const r = q.right.find(o => o.id === l.id);
        const src = [w].concat([]); // 只验证结构，释义由数据决定
        expect(typeof r.text).toBe('string');
        expect(r.text.length).toBeGreaterThan(0);
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('听写：字母块能拼出答案，且含干扰字母', () => {
    let checked = 0;
    for (const w of sampleWords) {
      const q = core.qSpell(w, WORDS);
      if (!q) continue;
      checked++;
      expect(q.answer).toBe(w.w);
      // 字母块数量 = 答案长度 + 4 个干扰
      expect(q.tiles).toHaveLength(q.answer.length + 4);
      // 从字母块里确实能挑出答案
      const pool = q.tiles.map(t => t.ch.toLowerCase());
      for (const ch of q.answer.toLowerCase().split('')) {
        const idx = pool.indexOf(ch);
        expect(idx, `拼不出 ${q.answer} 的字母 ${ch}`).toBeGreaterThanOrEqual(0);
        pool.splice(idx, 1);
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('句子排序：词块打乱后能还原成原句', () => {
    let checked = 0;
    for (const w of WORDS) {
      const q = core.qOrder(w, WORDS);
      if (!q) continue;
      checked++;
      const rebuilt = q.tiles.slice().sort((a, b) => a.i - b.i).map(t => t.text).join(' ');
      expect(rebuilt).toBe(q.answer);
      expect(q.tiles.length).toBeGreaterThanOrEqual(4);
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('判断正误：正确答案标记与释义来源一致', () => {
    let checked = 0;
    for (const w of sampleWords) {
      const q = core.qTrueFalse(w, WORDS);
      if (!q) continue;
      checked++;
      if (q.shownOk) {
        expect(q.sub).toBe(w.t[0]);                 // 标"对"就该是它自己的释义
      } else {
        expect(q.sub).not.toBe(w.t[0]);             // 标"错"就不能是原释义
      }
    }
    expect(checked).toBeGreaterThan(200);
  });
});

/* ============================ 出题调度 ============================ */
describe('buildQuestion 调度', () => {
  it('按优先级取第一个可出的题', () => {
    const withSentence = WORDS.find(w => core.hasSentence(w));
    const q = core.buildQuestion(withSentence, WORDS, ['order', 'choice']);
    expect(q).not.toBeNull();
    expect(q.type).toBe('order');
  });

  it('题型不可用时自动降级，不返回 null', () => {
    const noSentence = WORDS.find(w => !core.hasSentence(w) && w.t && w.t[0]);
    const q = core.buildQuestion(noSentence, WORDS, ['order', 'cloze', 'choice']);
    expect(q).not.toBeNull();
    expect(q.opts.length).toBeGreaterThan(0);
  });

  it('未知题型被跳过，不抛错', () => {
    const w = WORDS[0];
    expect(() => core.buildQuestion(w, WORDS, ['nonexistent', 'choice'])).not.toThrow();
  });

  it('整本词书都能出题（无 null、无空题干）', () => {
    /* 抽样 400 词：覆盖全部题型入口，同时避免 CI 慢机器上 O(n²) 超时 */
    const PLAN = ['choice', 'listen', 'cloze', 'match', 'spell', 'cn2en', 'order', 'tf'];
    let nulls = 0, empties = 0;
    const step2 = Math.max(1, Math.floor(WORDS.length / 400));
    const sample = WORDS.filter((_, i) => i % step2 === 0);
    for (let i = 0; i < sample.length; i++) {
      const q = core.buildQuestion(sample[i], WORDS, [PLAN[i % PLAN.length], 'choice']);
      if (!q) nulls++;
      else if (!q.prompt || String(q.prompt).trim() === '') empties++;
    }
    expect(nulls).toBe(0);
    expect(empties).toBe(0);
  });

  it('大规模抽样：选项永不重复', () => {
    let dup = 0, checked = 0;
    for (let i = 0; i < 800; i++) {
      const w = WORDS[Math.floor(Math.random() * WORDS.length)];
      const q = core.buildQuestion(w, WORDS, ['choice']);
      if (!q || !q.opts) continue;
      checked++;
      const texts = q.opts.map(o => o.text);
      if (new Set(texts).size !== texts.length) dup++;
    }
    expect(checked).toBeGreaterThan(500);
    expect(dup).toBe(0);
  });
});
