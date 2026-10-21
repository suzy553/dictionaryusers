# -*- coding: utf-8 -*-
"""书架：去掉色块晕染；点击词书继续学新词；复习为空则复习今日新词"""
import io

P = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf\js\app.js"
s = io.open(P, encoding="utf-8").read()

# ---------- 1. 今日已学词 ----------
helper = """function todayLearnedWords() {
  const p = progressOf();
  const t = shiftDay(0);
  return (curBook?.words || []).filter(w => {
    const rec = p[wordKey(w.w)];
    return rec && rec.d === t;
  });
}

function yesterdayWords() {"""
if "function todayLearnedWords" not in s:
    s = s.replace("function yesterdayWords() {", helper, 1)

# ---------- 2. 会话：复习为空时退回今日新词 ----------
old = """  } else if (kind === 'review') {
    queue = dueWords(state.settings.dailyReview).map(w => ({ w, isNew: false }));
  } else {"""
new = """  } else if (kind === 'review') {
    let pool = dueWords(state.settings.dailyReview);
    if (!pool.length) pool = todayLearnedWords();   // 没有到期的，就复习今天刚学的
    queue = pool.map(w => ({ w, isNew: false }));
  } else {"""
if old in s:
    s = s.replace(old, new, 1)
else:
    print("WARN startSession review block")

# ---------- 3. 复习详情：无昨日词则用今日词 ----------
old2 = """  const words = mode === 'wrong' ? wrongWordList() : yesterdayWords();
  if (title) title.textContent = mode === 'wrong' ? '错题复习' : '单词复习';"""
new2 = """  let words = mode === 'wrong' ? wrongWordList() : yesterdayWords();
  let fallbackToday = false;
  if (mode !== 'wrong' && !words.length) {
    words = todayLearnedWords();
    fallbackToday = words.length > 0;
  }
  if (title) {
    title.textContent = mode === 'wrong' ? '错题复习' : (fallbackToday ? '今日新词复习' : '单词复习');
  }"""
if old2 in s:
    s = s.replace(old2, new2, 1)
else:
    print("WARN review detail block")

# 空态文案
old3 = """      : '<div class="empty">昨天还没有背新词<br>今天背完，明天就来这里复习</div>';"""
new3 = """      : '<div class="empty">还没有可复习的词<br>先背几个新词，回来就能复习</div>';"""
if old3 in s:
    s = s.replace(old3, new3, 1)

# ---------- 4. 点击词书：继续学新词 ----------
old4 = """    el.onclick = async () => {
      if (b.id === state.activeBook) return;
      state.activeBook = b.id; saveState();
      await loadBook(b.id);
      renderAll();
      toast(`已切换到《${b.title}》`);
    };"""
new4 = """    el.onclick = async () => {
      const switched = b.id !== state.activeBook;
      if (switched) {
        state.activeBook = b.id; saveState();
        await loadBook(b.id);
        renderAll();
        toast(`已切换到《${b.title}》`);
      }
      // 直接继续学这本的新词
      setTimeout(() => startSession('learn'), switched ? 380 : 80);
    };"""
if old4 in s:
    s = s.replace(old4, new4, 1)
else:
    print("WARN book click block")

io.open(P, "w", encoding="utf-8").write(s)
print("todayLearnedWords:", "function todayLearnedWords" in s)
print("review fallback:", "pool = todayLearnedWords()" in s)
print("book click:", "startSession('learn'), switched" in s)
