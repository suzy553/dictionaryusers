/* ==========================================================================
   跟读练习：逐句录音 → 语音识别 → 与原文比对 → 标出错词
   局限说明：比对的是「识别文本」而不是音素，属于近似评测
   ========================================================================== */
(function () {
  'use strict';

  var panel = null;
  var cur = null;          // 当前文章
  var recog = null;        // SpeechRecognition 实例
  var recorder = null;     // MediaRecorder
  var chunks = [];
  var stream = null;
  var activeIdx = -1;
  var lastUrl = null;

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function toastMsg(t) {
    try { if (typeof toast === 'function') toast(t, 2400); } catch (e) { }
  }

  function Recognition() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  /* ---------- 文本比对 ---------- */
  function normWords(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[’']/g, "'")
      .replace(/[^a-z0-9'\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);
  }

  /* 词级编辑距离对齐，返回 {score, matched, total, diff:[{type,word,target}]} */
  function compare(target, heard) {
    var a = normWords(target), b = normWords(heard);
    var n = a.length, m = b.length;
    var dp = [];
    for (var i = 0; i <= n; i++) { dp[i] = [i]; }
    for (var j = 0; j <= m; j++) { dp[0][j] = j; }
    for (i = 1; i <= n; i++) {
      for (j = 1; j <= m; j++) {
        var cost = (a[i - 1] === b[j - 1]) ? 0 : 1;
        dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      }
    }
    /* 回溯找出差异 */
    var diff = [];
    i = n; j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
        i--; j--;
      } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
        diff.push({ type: 'miss', word: a[i - 1] });   // 漏读
        i--;
      } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
        diff.push({ type: 'extra', word: b[j - 1] });  // 多读/识别成别的
        j--;
      } else {
        diff.push({ type: 'wrong', word: a[i - 1], heard: b[j - 1] }); // 读错
        i--; j--;
      }
    }
    diff.reverse();
    var matched = Math.max(0, n - diff.filter(function (d) { return d.type !== 'extra'; }).length);
    var score = n ? Math.round(matched / n * 100) : 0;
    return { score: score, matched: matched, total: n, diff: diff };
  }

  /* ---------- 渲染 ---------- */
  function render() {
    if (!panel || !cur) return;
    var sents = cur.sentences || [];
    var body = sents.map(function (s, i) {
      return '<div class="sh-row" data-i="' + i + '">' +
        '<div class="sh-en">' + esc(s.en) + '</div>' +
        '<div class="sh-zh">' + esc(s.zh || '') + '</div>' +
        '<div class="sh-acts">' +
          '<button class="sh-btn" data-act="listen" data-i="' + i + '">▶ 听原句</button>' +
          '<button class="sh-btn sh-rec" data-act="rec" data-i="' + i + '">● 录音</button>' +
          '<button class="sh-btn" data-act="playback" data-i="' + i + '" disabled>↺ 回放</button>' +
        '</div>' +
        '<div class="sh-out" id="shOut' + i + '"></div>' +
      '</div>';
    }).join('');

    el('shList').innerHTML = body || '<div class="sh-empty">这篇文章没有可练习的句子</div>';
    el('shTitle').textContent = cur.titleZh || cur.title || '';
  }

  /* ---------- 句子朗读（系统 TTS） ---------- */
  function speak(text) {
    try {
      if (!('speechSynthesis' in window)) { toastMsg('这台设备不支持朗读'); return; }
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.9;
      speechSynthesis.speak(u);
    } catch (e) { toastMsg('朗读失败'); }
  }

  /* ---------- 录音 ---------- */
  async function startRec(i) {
    var row = panel.querySelector('.sh-row[data-i="' + i + '"]');
    var btn = row && row.querySelector('[data-act="rec"]');
    if (!btn) return;

    /* 正在录 → 停止 */
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toastMsg('这台设备不支持录音');
      return;
    }

    activeIdx = i;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      toastMsg('麦克风权限被拒绝');
      return;
    }

    chunks = [];
    try {
      recorder = new MediaRecorder(stream);
    } catch (e) {
      toastMsg('录音功能不可用');
      return;
    }
    recorder.ondataavailable = function (ev) { if (ev.data.size) chunks.push(ev.data); };
    recorder.onstop = function () {
      try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { }
      if (lastUrl) { try { URL.revokeObjectURL(lastUrl); } catch (e) { } }
      lastUrl = URL.createObjectURL(new Blob(chunks, { type: 'audio/webm' }));
      var pb = row.querySelector('[data-act="playback"]');
      if (pb) { pb.disabled = false; pb.dataset.url = lastUrl; }
      evaluate(i, lastUrl);
    };
    recorder.start();
    btn.classList.add('is-rec');
    btn.textContent = '■ 停止';
    sentenceRecog(i);
  }

  /* ---------- 语音识别 ---------- */
  function sentenceRecog(i) {
    var Rec = Recognition();
    if (!Rec) { return; }
    try {
      recog = new Rec();
      recog.lang = 'en-US';
      recog.interimResults = false;
      recog.maxAlternatives = 1;
      recog.onresult = function (e) {
        var heard = '';
        for (var k = 0; k < e.results.length; k++) heard += e.results[k][0].transcript + ' ';
        var out = el('shOut' + i);
        if (out) out.dataset.heard = heard.trim();
      };
      recog.onerror = function (e) {
        var out = el('shOut' + i);
        if (out) out.dataset.err = e.error || 'error';
      };
      recog.start();
    } catch (e) { }
  }

  /* ---------- 评分 ---------- */
  function evaluate(i, url) {
    var row = panel.querySelector('.sh-row[data-i="' + i + '"]');
    var out = el('shOut' + i);
    var btn = row && row.querySelector('[data-act="rec"]');
    if (btn) { btn.classList.remove('is-rec'); btn.textContent = '● 录音'; }
    if (!out) return;

    setTimeout(function () {
      var heard = (out.dataset.heard || '').trim();
      var err = out.dataset.err || '';
      var sent = ((cur.sentences || [])[i] || {}).en || '';

      if (!heard) {
        out.innerHTML = '<div class="sh-warn">' +
          (Recognition()
            ? '没有识别到内容（可能太轻、环境吵，或浏览器不支持识别）：已保留录音，可先回放对比'
            : '这台浏览器不支持语音识别，无法自动评分：已保留录音，可先回放对比') +
          '</div>';
        return;
      }

      var r = compare(sent, heard);
      var color = r.score >= 85 ? 'good' : (r.score >= 60 ? 'mid' : 'bad');
      var detail = r.diff.length
        ? '<div class="sh-diff">' + r.diff.map(function (d) {
            if (d.type === 'miss') return '<span class="sh-tag miss">漏读 ' + esc(d.word) + '</span>';
            if (d.type === 'extra') return '<span class="sh-tag extra">多读 ' + esc(d.word) + '</span>';
            return '<span class="sh-tag wrong">' + esc(d.word) + ' → ' + esc(d.heard) + '</span>';
          }).join('') + '</div>'
        : '<div class="sh-ok">整句都读到了</div>';

      out.innerHTML =
        '<div class="sh-score ' + color + '">' + r.score + '<i>分</i>' +
          '<span>' + r.matched + '/' + r.total + ' 词命中</span></div>' +
        detail +
        '<div class="sh-heard">识别为：' + esc(heard) + '</div>' +
        '<div class="sh-note">按识别文本比对，非专业音素评测</div>';
    }, 600);
  }

  /* ---------- 打开 / 关闭 ---------- */
  function open(item) {
    panel = el('shadowing');
    if (!panel) return;
    cur = item;
    render();
    panel.classList.add('is-open');
    document.documentElement.classList.add('overlay-open');
  }

  function close() {
    panel = el('shadowing');
    if (panel) panel.classList.remove('is-open');
    document.documentElement.classList.remove('overlay-open');
    try { if (recorder && recorder.state === 'recording') recorder.stop(); } catch (e) { }
    try { if (recog) recog.abort(); } catch (e) { }
    try { if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { }
    try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) { }
  }

  /* ---------- 事件 ---------- */
  function bind() {
    panel = el('shadowing');
    if (panel && !panel.dataset.b) {
      panel.dataset.b = '1';
      panel.addEventListener('click', function (e) {
        var act = e.target.closest('[data-act]');
        if (!act) return;
        var a = act.dataset.act;
        var i = Number(act.dataset.i);
        if (a === 'close') { close(); return; }
        if (a === 'listen') { speak(((cur.sentences || [])[i] || {}).en || ''); return; }
        if (a === 'rec') { startRec(i); return; }
        if (a === 'playback') {
          var u = act.dataset.url;
          if (!u) return;
          var au = new Audio(u);
          au.play().catch(function () { toastMsg('回放失败'); });
          return;
        }
      });
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();


  if (new URLSearchParams(location.search).get('dbgsh') === '1') {
    setTimeout(function () {
      try {
        var items = (window.__FEED_ITEMS || []);
        if (!window.XYReading) { document.title = 'NO-READING'; return; }
        window.XYReading.open().then(function () {
          setTimeout(function () {
            var btn = document.querySelector('[data-act="shadow"]');
            if (!btn) { document.title = 'NO-SHADOW-BTN'; return; }
            btn.click();
            setTimeout(function () {
              var rows = document.querySelectorAll('#shadowing .sh-row');
              var open = document.getElementById('shadowing').classList.contains('is-open');
              document.title = 'open=' + open + ' rows=' + rows.length +
                ' recogAvail=' + (!!(window.SpeechRecognition || window.webkitSpeechRecognition)) +
                ' mediaRec=' + (typeof MediaRecorder !== 'undefined');
            }, 600);
          }, 900);
        });
      } catch (e) { document.title = 'ERR:' + e.message; }
    }, 2200);
  }


  if (new URLSearchParams(location.search).get('dbgcmp') === '1') {
   setTimeout(function () {
    var T = 'NPR is a weekly radio game with host Ayesha Rascoe.';
    var cases = [
      ['完全正确', T],
      ['漏三个词', 'NPR is a weekly game with Ayesha Rascoe'],
      ['错一个词', 'NPR is a weekly radio game with host Ayesha Rasko'],
      ['多一个词', 'NPR is a weekly radio game with host Ayesha Rascoe today'],
      ['空', '']
    ];
    var out = cases.map(function (c) {
      var r = compare(T, c[1]);
      return c[0] + '=' + r.score + '%(' + r.matched + '/' + r.total + ', diff ' + r.diff.length + ')';
    });
    document.title = out.join(' | ');
   }, 2600);
  }

  window.XYShadowing = {
    compare: compare,
    open: open,
    close: close,
    hasRecog: function () { return !!Recognition(); }
  };
})();
