import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const core = require(resolve(__dirname, '../js/core.js'));

/* 词条形状：{ b: 记忆等级, d: 到期日, r: 复习次数, w: 错误次数, last: 最后复习时间 } */
const rec = (b, r, last = 0) => ({ b, r, w: 0, last, d: 100 });

describe('备份合并 mergeProgress', () => {
  it('空对空', () => {
    const out = core.mergeProgress({}, {});
    expect(out.merged).toEqual({});
    expect(out.added).toBe(0);
  });

  it('当前为空 → 全部新增', () => {
    const out = core.mergeProgress({}, { a: rec(2, 3) });
    expect(out.added).toBe(1);
    expect(out.merged.a.r).toBe(3);
  });

  it('导入为空 → 全部保留', () => {
    const out = core.mergeProgress({ a: rec(2, 3) }, {});
    expect(out.merged.a.r).toBe(3);
    expect(out.added).toBe(0);
  });

  it('复习次数多的胜出', () => {
    const out = core.mergeProgress({ a: rec(1, 2) }, { a: rec(5, 9) });
    expect(out.merged.a.r).toBe(9);
    expect(out.updated).toBe(1);
  });

  it('复习次数相同时，等级高的胜出', () => {
    const out = core.mergeProgress({ a: rec(2, 4) }, { a: rec(6, 4) });
    expect(out.merged.a.b).toBe(6);
  });

  it('次数与等级都相同时，取最近复习的', () => {
    const out = core.mergeProgress({ a: rec(3, 4, 100) }, { a: rec(3, 4, 900) });
    expect(out.merged.a.last).toBe(900);
  });

  it('当前记录更优时不倒退', () => {
    const out = core.mergeProgress({ a: rec(7, 20) }, { a: rec(1, 1) });
    expect(out.merged.a.b).toBe(7);
    expect(out.merged.a.r).toBe(20);
    expect(out.kept).toBe(1);
    expect(out.updated).toBe(0);
  });

  it('不修改传入对象（纯函数）', () => {
    const cur = { a: rec(1, 1) };
    const inc = { b: rec(2, 2) };
    core.mergeProgress(cur, inc);
    expect(Object.keys(cur)).toEqual(['a']);
    expect(Object.keys(inc)).toEqual(['b']);
  });

  it('混合场景：新增 + 更新 + 保留', () => {
    const cur = { keep: rec(7, 20), upd: rec(1, 1) };
    const inc = { upd: rec(2, 5), add: rec(1, 1) };
    const out = core.mergeProgress(cur, inc);
    expect(out.added).toBe(1);    // add 是新的
    expect(out.updated).toBe(1);  // upd 被导入版本胜出
    expect(out.kept).toBe(0);     // keep 不在导入文件里，不参与比较
    expect(Object.keys(out.merged).sort()).toEqual(['add', 'keep', 'upd']);
    expect(out.merged.upd.r).toBe(5);
  });

  it('大规模合并不丢词', () => {
    const cur = {}, inc = {};
    for (let i = 0; i < 500; i++) cur['w' + i] = rec(1, i % 7);
    for (let i = 250; i < 750; i++) inc['w' + i] = rec(2, (i % 5));
    const out = core.mergeProgress(cur, inc);
    expect(Object.keys(out.merged)).toHaveLength(750);
    expect(out.added).toBe(250);   // w250~w749 中 cur 没有的
  });
});
