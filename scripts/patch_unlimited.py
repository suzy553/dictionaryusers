# -*- coding: utf-8 -*-
"""去掉每日上限：可以一直学；学完整本推荐下一本"""
import io

P = r"C:\Users\su'su\Documents\deepseek-harness\default-workspace\ielts-bookshelf\js\app.js"
s = io.open(P, encoding="utf-8").read()

# ---------- 1. 剩余新词不再受每日上限限制 ----------
old = """function newWords(limit) {
  if (limit <= 0) return [];"""
new = """function newWords(limit) {
  if (limit <= 0) return [];"""
# 保留原样（limit 仍用于批量大小）

# ---------- 2. startSession：额度用完也继续给新词；整本学完则推荐下一本 ----------
old2 = """  } else {
    const rev = dueWords(remainingReview()).map(w => ({ w, isNew: false }));
    const nw = newWords(remainingNew()).map(w => ({ w, isNew: true }));
    queue = [...rev, ...nw];
  }

  if (!queue.length) {
    if (kind === 'review') toast('今天没有到期要复习的词');
    else if (remainingNew() <= 0) toast('今天的新词已经学完了 🎉');
    else toast('这本词书已经背完啦');
    return;
  }"""
new2 = """  } else {
    const rev = dueWords(remainingReview()).map(w => ({ w, isNew: false }));
    // 每日额度用完也继续给新词：一次再来一批，学到不想学为止
    const quota = remainingNew();
    const batch = quota > 0 ? quota : Math.max(state.settings.dailyNew || 20, 10);
    const nw = newWords(batch).map(w => ({ w, isNew: true }));
    queue = [...rev, ...nw];
  }

  if (!queue.length) {
    if (kind === 'review') toast('暂无到期要复习的词');
    else if (!newWords(1).length) suggestNextBook();
    else toast('这本词书已经背完啦');
    return;
  }"""
if old2 in s:
    s = s.replace(old2, new2, 1)
    print("startSession unlimited ok")
else:
    print("WARN startSession block")

# ---------- 3. 推荐下一本 ----------
helper = """function suggestNextBook() {
  const others = bookIndex.filter(b => b.id !== state.activeBook).sort((a, b) => a.count - b.count);
  const next = others[0];
  const done = bookIndex.find(b => b.id === state.activeBook);
  if (!next) {
    toast('所有词书都背完啦，太厉害了 🎉', 2600);
    return;
  }
  const msg = `${done ? `《${done.title}》全书背完啦 🎉 推荐接着背《${next.title}》` : `推荐背《${next.title}》`}`;
  toast(msg, 3200);
  go('books');
  setTimeout(() => {
    const cards = document.querySelectorAll('.book-card');
    for (const c of cards) {
      if (c.textContent.includes(next.title)) {
        c.classList.add('is-suggest');
        c.scrollIntoView({ block: 'center', behavior: 'smooth' });
        break;
      }
    }
  }, 420);
}

function startSession(kind, override) {"""
if "function suggestNextBook" not in s:
    s = s.replace("function startSession(kind, override) {", helper, 1)
    print("suggestNextBook added")

io.open(P, "w", encoding="utf-8").write(s)
