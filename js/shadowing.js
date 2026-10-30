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
        '<div class="sh-en" data-raw="' + esc(s.en) + '">' + esc(s.en) + '</div>' +
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

  /* ---------- 录音 / 识别 ---------- */
  /* 关键：麦克风通常只能被一个组件占用。
     MediaRecorder 先启动会导致 SpeechRecognition 拿不到音频（audio-capture）。
     所以：有识别器 → 只跑识别器；没有识别器 → 只录音回放。 */
  var activeRecog = null;
  var recogTimer = null;
  var recogHeard = '';
  var recogErr = '';

  function errText(code) {
    var m = {
      'not-allowed': '麦克风权限被拒绝：请在浏览器设置里允许本网站使用麦克风',
      'service-not-allowed': '系统禁止了语音识别服务',
      'audio-capture': '麦克风被其他程序占用（比如正在录音的另一个页面）',
      'no-speech': '没有听到声音：请靠近麦克风、大声一点再读一次',
      'network': '识别服务需要联网，当前网络不可用',
      'aborted': '识别被中断',
      'language-not-supported': '这台设备不支持英语识别'
    };
    return m[code] || ('识别失败：' + code);
  }

  function setRecUI(row, on, label) {
    var btn = row && row.querySelector('[data-act="rec"]');
    if (!btn) return;
    if (on) { btn.classList.add('is-rec'); btn.textContent = label || '■ 停止'; }
    else { btn.classList.remove('is-rec'); btn.textContent = label || '● 录音'; }
  }

  function outBox(i) { return el('shOut' + i); }

  function showStatus(i, text, kind) {
    var out = outBox(i);
    if (!out) return;
    out.innerHTML = '<div class="sh-' + (kind || 'warn') + '">' + text + '</div>';
  }

  async function startRec(i) {
    var row = panel.querySelector('.sh-row[data-i="' + i + '"]');
    if (!row) return;

    /* 已在识别/录音中 → 停止 */
    if (activeRecog) { stopRecog(); return; }
    if (recorder && recorder.state === 'recording') { recorder.stop(); return; }

    activeIdx = i;
    recogHeard = '';
    recogErr = '';

    if (Recognition()) {
      startRecogOnly(i, row);
    } else {
      startRecorderOnly(i, row);
    }
  }

  /* --- A. 有语音识别：只用识别器（评分）--- */
  function startRecogOnly(i, row) {
    var Rec = Recognition();
    try {
      activeRecog = new Rec();
    } catch (e) {
      showStatus(i, '无法启动语音识别：' + e.message, 'warn');
      return;
    }
    activeRecog.lang = 'en-US';
    activeRecog.interimResults = false;
    activeRecog.maxAlternatives = 1;
    activeRecog.continuous = false;

    showStatus(i, '正在听…请把这句话读一遍', 'listening');
    setRecUI(row, true);

    activeRecog.onresult = function (e) {
      var heard = '';
      for (var k = 0; k < e.results.length; k++) heard += e.results[k][0].transcript + ' ';
      recogHeard = heard.trim();
    };
    activeRecog.onerror = function (e) {
      recogErr = e.error || 'error';
    };
    activeRecog.onend = function () {
      clearTimeout(recogTimer);
      activeRecog = null;
      setRecUI(row, false);
      finishRecog(i, row);
    };

    try {
      activeRecog.start();
    } catch (e) {
      activeRecog = null;
      setRecUI(row, false);
      showStatus(i, '识别启动失败：' + e.message + '（如果是重复点击，请稍等一秒）', 'warn');
      return;
    }

    /* 最长 10 秒自动停止；再等 2 秒仍无回调就强制收尾，避免卡在「正在听」 */
    clearTimeout(recogTimer);
    recogTimer = setTimeout(function () {
      if (activeRecog) { try { activeRecog.stop(); } catch (e) { } }
      setTimeout(function () {
        if (activeRecog) {
          activeRecog = null;
          setRecUI(row, false);
          showStatus(i, '识别超时：没有收到结果。请确认麦克风权限已开、网络正常，然后重试', 'warn');
        }
      }, 2000);
    }, 10000);
  }

  function stopRecog() {
    if (!activeRecog) return;
    try { activeRecog.stop(); } catch (e) { }
  }

  function finishRecog(i, row) {
    var out = outBox(i);
    if (!out) return;
    if (!recogHeard) {
      showStatus(i, errText(recogErr || 'no-speech'), 'warn');
      return;
    }
    evaluateWith(i, row, recogHeard);
  }

  /* --- B. 没有识别器：只录音，供回放对比 --- */
  async function startRecorderOnly(i, row) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showStatus(i, '这台设备既不支持语音识别，也不支持录音', 'warn');
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      showStatus(i, '麦克风权限被拒绝，无法录音', 'warn');
      return;
    }
    chunks = [];
    try {
      recorder = new MediaRecorder(stream);
    } catch (e) {
      showStatus(i, '录音功能不可用', 'warn');
      return;
    }
    recorder.ondataavailable = function (ev) { if (ev.data.size) chunks.push(ev.data); };
    recorder.onstop = function () {
      try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { }
      if (lastUrl) { try { URL.revokeObjectURL(lastUrl); } catch (e) { } }
      lastUrl = URL.createObjectURL(new Blob(chunks, { type: 'audio/webm' }));
      var pb = row.querySelector('[data-act="playback"]');
      if (pb) { pb.disabled = false; pb.dataset.url = lastUrl; }
      setRecUI(row, false);
      showStatus(i, '已录音。这台浏览器不支持语音识别，请点「回放」自己对比原句。', 'warn');
    };
    recorder.start();
    setRecUI(row, true);
    showStatus(i, '正在录音…点「停止」结束', 'listening');
  }

  /* 在原文句子里标注读错/漏读的词 */
  function markSentence(row, sent, diff) {
    var en = row && row.querySelector('.sh-en');
    if (!en) return;
    /* 每个待标记词按出现顺序排队 */
    var queue = {};
    diff.forEach(function (d) {
      if (d.type === 'extra') return;
      var k = String(d.word || '').toLowerCase();
      if (!k) return;
      (queue[k] = queue[k] || []).push(d.type);
    });

    var out = '';
    var re = /[A-Za-z][A-Za-z'’-]*/g;
    var last = 0;
    var m;
    while ((m = re.exec(sent)) !== null) {
      out += esc(sent.slice(last, m.index));
      var w = m[0];
      var k = w.toLowerCase().replace(/[^a-z'’-]/g, '');
      var kinds = queue[k];
      if (kinds && kinds.length) {
        var type = kinds.shift();
        out += '<mark class="sh-mk ' + type + '">' + esc(w) + '</mark>';
      } else {
        out += esc(w);
      }
      last = m.index + w.length;
    }
    out += esc(sent.slice(last));
    en.innerHTML = out;
  }

  /* ---------- 评分 ---------- */
  function evaluateWith(i, row, heard) {
    var out = el('shOut' + i);
    if (!out) return;
    setRecUI(row, false);

    (function () {
      var sent = ((cur.sentences || [])[i] || {}).en || '';
      if (!heard) {
        showStatus(i, '没有识别到内容，请再读一次', 'warn');
        return;
      }

      var r = compare(sent, heard);
      markSentence(row, sent, r.diff);
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
    })();
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
    try { if (activeRecog) activeRecog.abort(); } catch (e) { }
    clearTimeout(recogTimer);
    activeRecog = null;
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


  if (new URLSearchParams(location.search).get('dbgrec') === '1') {
    setTimeout(function () {
      try {
        var btn = document.querySelector('[data-act="shadow"]');
        if (!btn) { document.title = 'NO-SHADOW'; return; }
        btn.click();
        setTimeout(function () {
          var rec = document.querySelector('#shadowing [data-act="rec"]');
          if (!rec) { document.title = 'NO-REC-BTN'; return; }
          rec.click();
          setTimeout(function () {
            var out = document.getElementById('shOut0');
            var hasRecog = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
            var html = out ? out.innerHTML : '';
            document.title = 'recog=' + hasRecog + ' len=' + html.length + ' html=' + html.slice(0, 60).replace(/</g, '(') + ' btn=' + (rec.textContent || '').slice(0, 6);
          }, 13000);
        }, 900);
      } catch (e) { document.title = 'ERR:' + e.message; }
    }, 2600);
  }

  window.XYShadowing = {
    compare: compare,
    open: open,
    close: close,
    hasRecog: function () { return !!Recognition(); }
  };
})();
