/* ==========================================================================
   小越背单词 · 核心算法（纯函数，无 DOM 依赖）
   —— 可被浏览器直接引入，也可被单元测试 import
   ========================================================================== */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();            // Node / Vitest
  } else {
    root.XYCore = factory();               // 浏览器
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ======================= 间隔重复（Leitner Box） ======================= */
  var BOX_DAYS = [0, 1, 2, 4, 7, 15, 30, 60];
  var MAX_BOX = BOX_DAYS.length - 1;

  /** 答对升一级（封顶），答错直接归零 */
  function bumpBox(box, ok) {
    if (!ok) return 0;
    return Math.min((box || 0) + 1, MAX_BOX);
  }

  /** 该等级下次复习要隔几天 */
  function dueDays(box) {
    var b = Math.max(0, Math.min(box || 0, MAX_BOX));
    return BOX_DAYS[b];
  }

  /* ============================ 工具函数 ============================ */
  function pickN(arr, n) {
    var c = arr.slice(), out = [];
    while (out.length < n && c.length) {
      out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
    }
    return out;
  }

  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function hasSentence(w) {
    return !!(w && w.s && w.w && w.s.toLowerCase().indexOf(w.w.toLowerCase()) >= 0);
  }

  /* ============================ 8 种题型 ============================ */

  /* T1 看词选义（读） */
  function qChoice(word, pool) {
    if (!word.t || !word.t[0]) return null;
    var others = pool.filter(function (w) { return w.w !== word.w && w.t && w.t[0]; });
    var dis = pickN(others, 3);
    if (dis.length < 2) return null;
    return {
      type: 'choice', tag: '选一个正确的释义', dim: '读', word: word,
      prompt: word.w, sub: word.us ? '/' + word.us + '/' : '',
      opts: shuffled([{ text: word.t[0], ok: true }].concat(
        dis.map(function (w) { return { text: w.t[0], ok: false }; })))
    };
  }

  /* T2 看中文选英文（读） */
  function qCnToEn(word, pool) {
    if (!word.t || !word.t[0]) return null;
    /* 中文释义里直接含这个英文词 = 泄题，换别的题 */
    if (String(word.t[0]).toLowerCase().indexOf(String(word.w).toLowerCase()) >= 0) return null;
    var dis = pickN(pool.filter(function (w) { return w.w !== word.w; }), 3);
    if (dis.length < 2) return null;
    return {
      type: 'choice', tag: '选出对应的英文单词', dim: '读', word: word,
      prompt: word.t[0], sub: '看中文，选英文',
      opts: shuffled([{ text: word.w, ok: true }].concat(
        dis.map(function (w) { return { text: w.w, ok: false }; })))
    };
  }

  /* T3 例句填空（读+写） */
  function qCloze(word, pool) {
    if (!hasSentence(word)) return null;
    var esc = word.w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    var blank = word.s.replace(new RegExp('\\b' + esc + '\\b', 'i'), '______');
    if (blank === word.s) return null;       // 没替换成功就不出题
    var dis = pickN(pool.filter(function (w) { return w.w !== word.w; }), 3);
    if (dis.length < 2) return null;
    return {
      type: 'choice', tag: '把句子补完整', dim: '读', word: word,
      prompt: blank, sub: word.sz || '',
      opts: shuffled([{ text: word.w, ok: true }].concat(
        dis.map(function (w) { return { text: w.w, ok: false }; })))
    };
  }

  /* T4 听音选词（听） */
  function qListen(word, pool) {
    var near = pool.filter(function (w) {
      return w.w !== word.w && Math.abs(w.w.length - word.w.length) <= 3;
    });
    var dis = pickN(near.length >= 3 ? near : pool.filter(function (w) { return w.w !== word.w; }), 3);
    if (dis.length < 2) return null;
    return {
      type: 'listen', tag: '听发音，选出这个单词', dim: '听', word: word,
      prompt: '🔊', sub: '点喇叭再听一次',
      opts: shuffled([{ text: word.w, ok: true }].concat(
        dis.map(function (w) { return { text: w.w, ok: false }; })))
    };
  }

  /* T5 词义配对（读） */
  function qMatch(word, pool) {
    if (!word.t || !word.t[0]) return null;
    var others = pickN(pool.filter(function (w) {
      return w.w !== word.w && w.t && w.t[0];
    }), 3);
    if (others.length < 3) return null;
    var group = [word].concat(others);
    return {
      type: 'match', tag: '把单词和释义配对', dim: '读', word: word,
      prompt: '4 组配对', sub: '点左边一个词，再点右边的释义',
      left: shuffled(group.map(function (w, i) { return { id: i, text: w.w }; })),
      right: shuffled(group.map(function (w, i) { return { id: i, text: w.t[0] }; }))
    };
  }

  /* T6 听写（听+写）：点字母拼词，不用键盘 */
  function qSpell(word, pool) {
    if (!/^[a-zA-Z]{3,12}$/.test(word.w)) return null;
    var letters = word.w.split('');
    var alphabet = 'abcdefghijklmnopqrstuvwxyz';
    var filler = [];
    for (var i = 0; i < 4; i++) filler.push(alphabet[Math.floor(Math.random() * 26)]);
    var tiles = shuffled(letters.map(function (ch) { return { ch: ch }; })
      .concat(filler.map(function (ch) { return { ch: ch }; })));
    return {
      type: 'spell', tag: '听发音，按顺序点出单词', dim: '听+写', word: word,
      prompt: '🔊', sub: '点错的可以撤销',
      tiles: tiles, answer: word.w
    };
  }

  /* T7 句子排序（写） */
  function qOrder(word, pool) {
    if (!hasSentence(word)) return null;
    var raw = word.s.replace(/[.!?]+$/, '').trim();
    var tokens = raw.split(/\s+/);
    if (tokens.length < 4 || tokens.length > 9) return null;
    return {
      type: 'order', tag: '把单词按顺序排成句子', dim: '写', word: word,
      prompt: word.sz || '按正确语序排列',
      sub: '按顺序点下面的单词',
      tiles: shuffled(tokens.map(function (t, i) { return { text: t, i: i }; })),
      answer: tokens.join(' ')
    };
  }

  /* T8 判断正误（读） */
  function qTrueFalse(word, pool) {
    if (!word.t || !word.t[0]) return null;
    var useRight = Math.random() < 0.5;
    var shown = word.t[0];
    if (!useRight) {
      var other = pickN(pool.filter(function (w) {
        return w.w !== word.w && w.t && w.t[0];
      }), 1)[0];
      if (!other) return null;
      shown = other.t[0];
    }
    return {
      type: 'tf', tag: '这个释义对吗？', dim: '读', word: word,
      prompt: word.w, sub: shown, shownOk: useRight
    };
  }

  /* ============================ 出题调度 ============================ */
  var GEN = {
    choice: qChoice, cn2en: qCnToEn, cloze: qCloze, listen: qListen,
    match: qMatch, spell: qSpell, order: qOrder, tf: qTrueFalse
  };

  /**
   * 按优先级依次尝试题型，第一个能出题的就用
   * @param {object} word 目标词
   * @param {Array}  pool 同一本词书的所有词
   * @param {Array}  wanted 题型优先级，如 ['order','choice']
   */
  function buildQuestion(word, pool, wanted) {
    for (var i = 0; i < wanted.length; i++) {
      var fn = GEN[wanted[i]];
      if (!fn) continue;
      var q = null;
      try { q = fn(word, pool); } catch (e) { q = null; }
      if (q && q.prompt != null && q.prompt !== '') return q;
    }
    return qChoice(word, pool);
  }

  return {
    BOX_DAYS: BOX_DAYS, MAX_BOX: MAX_BOX,
    bumpBox: bumpBox, dueDays: dueDays,
    pickN: pickN, shuffled: shuffled, hasSentence: hasSentence,
    qChoice: qChoice, qCnToEn: qCnToEn, qCloze: qCloze, qListen: qListen,
    qMatch: qMatch, qSpell: qSpell, qOrder: qOrder, qTrueFalse: qTrueFalse,
    buildQuestion: buildQuestion, GEN: GEN
  };
});
