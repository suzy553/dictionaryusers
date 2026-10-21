# -*- coding: utf-8 -*-
"""已学 = 全部学过的词（跨词书去重）；复习页实时同步今日新学"""
import io

P = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf\js\app.js"
s = io.open(P, encoding="utf-8").read()

# ---------- 1. 全局已学词（跨词书去重） ----------
helper = """function totalLearnedWords() {
  const set = new Set();
  const all = state.progress || {};
  for (const bid in all) {
    const p = all[bid] || {};
    for (const k in p) set.add(k);
  }
  return set.size;
}

function reviewPool() {
  const y = yesterdayWords();
  if (y.length) return { words: y, kind: 'yesterday' };
  const t = todayLearnedWords();
  if (t.length) return { words: t, kind: 'today' };
  const d = dueWords(999);
  if (d.length) return { words: d, kind: 'due' };
  return { words: [], kind: 'none' };
}

function renderReview() {"""
if "function totalLearnedWords" not in s:
    s = s.replace("function renderReview() {", helper, 1)
    print("helpers added")

# ---------- 2. 首页「已学」显示总词数 ----------
old = """  const learned = Object.keys(progressOf()).length;"""
new = """  const learned = Object.keys(progressOf()).length;
  const totalLearned = totalLearnedWords();"""
if old in s:
    s = s.replace(old, new, 1)

s = s.replace("taskRevNum', `…", "taskRevNum', `…")  # no-op guard
old_tile = "setT('#taskRevNum', hasRev ? `${rec.r}/${revGoal}` : `${learnedCount} 词 ›`);"
if old_tile in s:
    s = s.replace(old_tile, "setT('#taskRevNum', `${totalLearned} 词 ›`);", 1)
    print("home tile updated")
else:
    # 兜底：直接找 taskRevNum 那行
    import re
    s2 = re.sub(r"setT\('#taskRevNum'[^\n]*\)", "setT('#taskRevNum', `${totalLearned} 词 ›`);", s, count=1)
    if s2 != s:
        s = s2
        print("home tile updated (regex)")
    else:
        print("WARN home tile")

# ---------- 3. 复习页数字 = 可复习词数 ----------
old3 = """  const due = dueWords(999);
  const yWords = yesterdayWords();
  const wrongs = wrongWordList();

  const setT = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
  setT('#rvWordCount', yWords.length);
  setT('#rvWrongCount', wrongs.length);"""
new3 = """  const due = dueWords(999);
  const pool = reviewPool();
  const wrongs = wrongWordList();

  const setT = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
  setT('#rvWordCount', pool.words.length || wrongs.length ? (pool.words.length || 0) : 0);
  setT('#rvWrongCount', wrongs.length);"""
if old3 in s:
    s = s.replace(old3, new3, 1)
    print("review counts updated")
else:
    print("WARN review counts")

# 复习页图例：已学用总数
s = s.replace("<span class=\"legend-chip\">已学 ${Object.keys(p).length} 词</span>",
              "<span class=\"legend-chip\">已学 ${totalLearnedWords()} 词</span>")

# ---------- 4. 复习详情：使用统一池 + 标题 ----------
old4 = """  let words = mode === 'wrong' ? wrongWordList() : yesterdayWords();
  let fallbackToday = false;
  if (mode !== 'wrong' && !words.length) {
    words = todayLearnedWords();
    fallbackToday = words.length > 0;
  }
  if (title) {
    title.textContent = mode === 'wrong' ? '错题复习' : (fallbackToday ? '今日新词复习' : '单词复习');
  }"""
new4 = """  let words, poolKind = 'none';
  if (mode === 'wrong') {
    words = wrongWordList();
  } else {
    const pool = reviewPool();
    words = pool.words;
    poolKind = pool.kind;
  }
  if (title) {
    title.textContent = mode === 'wrong' ? '错题复习'
      : poolKind === 'today' ? '今日新词复习'
      : poolKind === 'due' ? '到期复习'
      : '单词复习';
  }"""
if old4 in s:
    s = s.replace(old4, new4, 1)
    print("review detail updated")
else:
    print("WARN review detail")

io.open(P, "w", encoding="utf-8").write(s)
