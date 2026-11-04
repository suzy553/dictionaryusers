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
          '<button class="sh-btn" data-act="slow" data-i="' + i + '">🐢 慢速</button>' +
          '<button class="sh-btn sh-rec" data-act="rec" data-i="' + i + '">● 录音</button>' +
          '<button class="sh-btn" data-act="playback" data-i="' + i + '" disabled>↺ 回放</button>' +
        '</div>' +
        '<div class="sh-out" id="shOut' + i + '"></div>' +
      '</div>';
    }).join('');

    el('shList').innerHTML = body || '<div class="sh-empty">这篇文章没有可练习的句子</div>';
    el('shTitle').textContent = cur.titleZh || cur.title || '';
    updateProgress();
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

  function speakSlow(text) {
    try {
      if (!('speechSynthesis' in window)) { toastMsg('这台设备不支持朗读'); return; }
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.55;
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
  var asrBroken = false;   /* 识别服务不可用（多半是网络到不了 Google）*/

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


  /* 模式开关：识别（自动评分） / 录音（只回放对比） */
  function syncModeBtn() {
    var b = el('shMode');
    if (!b) return;
    b.textContent = asrBroken ? '模式：录音' : '模式：识别';
    b.classList.toggle('is-rec-mode', !!asrBroken);
  }

  function toggleMode() {
    asrBroken = !asrBroken;
    try {
      if (asrBroken) localStorage.setItem('shadow.asrBroken', '1');
      else localStorage.removeItem('shadow.asrBroken');
    } catch (e) { }
    syncModeBtn();
    toastMsg(asrBroken
      ? '已切到录音模式：录完点「回放」自己对比'
      : '已切到识别模式：读一句自动打分');
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
    if (activeStop) { var f = activeStop; activeStop = null; try { f(); } catch (e) { } return; }
    if (activeRecog) { stopRecog(); return; }
    if (recorder && recorder.state === 'recording') { recorder.stop(); return; }

    activeIdx = i;
    recogHeard = '';
    recogErr = '';

    if (window.XYISE && window.XYISE.available()) {
      startISE(i, row);
    } else if (Recognition() && !asrBroken) {
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
      var code = recogErr || 'no-speech';
      /* 服务不可用类错误：权限没问题，是国内网络到不了识别服务 */
      if (code === 'network' || code === 'not-allowed' || code === 'service-not-allowed') {
        asrBroken = true;
        try { localStorage.setItem('shadow.asrBroken', '1'); } catch (e) { }
        showStatus(i,
          '语音识别服务连不上（浏览器识别要走境外服务器，国内网络常被拦）。' +
          '已自动改为「录音回放」模式：点下面「● 录音」录下来，再点「↺ 回放」自己对比原句。<br>' +
          '<button class="sh-retry" data-act="retryAsr" data-i="' + i + '">再试一次识别</button>', 'warn');
        return;
      }
      showStatus(i, errText(code), 'warn');
      return;
    }
    evaluateWith(i, row, recogHeard);
  }


  /* --- C. 讯飞评测（最准，需要配置 Worker 地址）--- */
  async function startISE(i, row) {
    var sent = ((cur.sentences || [])[i] || {}).en || '';
    if (!sent) { showStatus(i, '这句没有原文', 'warn'); return; }
    setRecUI(row, true, '■ 停止');
    showStatus(i, '正在听…读完点「停止」出分', 'listening');

    /* 实时电平条，避免“没录到声音”却不知道 */
    var meter = document.createElement('div');
    meter.className = 'sh-level';
    meter.innerHTML = '<i></i>';
    row.appendChild(meter);
    var lvTimer = setInterval(function () {
      var lv = (window.XYISE && window.XYISE.level) ? window.XYISE.level() : 0;
      var bar = meter.firstChild;
      if (bar) bar.style.width = Math.round(lv * 100) + '%';
    }, 100);
    function stopMeter() {
      clearInterval(lvTimer);
      if (meter.parentNode) meter.parentNode.removeChild(meter);
    }

    var last = cur.__last || (cur.__last = {});
    var passed = cur.__passed || (cur.__passed = {});
    var prev = last[i];

    var mr = null;
    var mrChunks = [];
    var mrClosed = false;

    /* 停止按钮：结束录音并让服务端收尾 */
    activeStop = function () {
      if (window.XYISE && window.XYISE._stop) window.XYISE._stop();
    };

    try {
      var r = await window.XYISE.evaluate(sent, function (partial) {
        /* 中途结果先展示分数 */
        if (partial && partial.total) {
          showStatus(i, '已听 ' + (partial.words || []).length + ' 个词…', 'listening');
        }
      }, {
        /* 同一路麦克风再录一份，用于回放对比 */
        onStream: function (stream) {
          try {
            mr = new MediaRecorder(stream);
            mr.ondataavailable = function (ev) {
              if (ev.data && ev.data.size) mrChunks.push(ev.data);
            };
            mr.onstop = function () {
              mrClosed = true;
              if (!mrChunks.length) return;
              try {
                var url = URL.createObjectURL(new Blob(mrChunks, { type: mr.mimeType || 'audio/webm' }));
                var pb = row.querySelector('[data-act="playback"]');
                if (pb) { pb.disabled = false; pb.dataset.url = url; pb.textContent = '↺ 回放'; }
              } catch (e) { }
            };
            mr.start();
          } catch (e) { }
        },
        onStop: function () {
          if (mr && !mrClosed && mr.state !== 'inactive') {
            try { mr.stop(); } catch (e) { }
          }
        }
      });

      setRecUI(row, false);
      stopMeter();

      var delta = (typeof prev === 'number' && isFinite(prev))
        ? Math.round(r.total - prev) : null;
      last[i] = Math.round(r.total);
      if (r.total >= 85) passed[i] = true;

      renderISEResult(i, row, sent, r, delta);
      updateProgress();
    } catch (e) {
      stopMeter();
      setRecUI(row, false);
      showStatus(i, '评测失败：' + (e && e.message ? e.message : e) +
        '<br>可切换顶部「模式：录音」先练录音回放', 'warn');
    }
  }

  /* 整篇达标进度 */
  function updateProgress() {
    var sents = (cur && cur.sentences) || [];
    if (!sents.length) return;
    var p = cur.__passed || {};
    var n = 0;
    for (var k = 0; k < sents.length; k++) if (p[k]) n++;
    var t = cur.titleZh || cur.title || '';
    var box = el('shTitle');
    if (box) box.textContent = t + ' · 达标 ' + n + '/' + sents.length;
  }

  var reports = {};

  function renderISEResult(i, row, sent, r, delta) {
    var out = el('shOut' + i);
    if (!out) return;
    var a = window.XYISE.analyze(r);
    reports[i] = { r: r, a: a, sent: sent };

    /* 原文按词标注 */
    markSentence(row, sent, (r.words || []).map(function (w) {
      return { type: w.error === 'miss' ? 'miss' : (w.error === 'wrong' ? 'wrong' : 'extra'), word: w.word };
    }));

    var enBox = row && row.querySelector('.sh-en');
    if (enBox) {
      enBox.onclick = function (e) {
        var mk = e.target && e.target.closest ? e.target.closest('mark[data-w]') : null;
        if (mk) openWordByName(i, mk.getAttribute('data-w'));
      };
    }

    var color = r.total >= 85 ? 'good' : (r.total >= 60 ? 'mid' : 'bad');
    var dimNames = { accuracy: '准确', fluency: '流畅', integrity: '完整' };
    var dimKeys = ['accuracy', 'fluency', 'integrity'];

    var html = '<div class="sh-score ' + color + '">' + Math.round(r.total) + '<i>分</i></div>';
    html += r.total >= 85
      ? '<span class="sh-pass">✓ 达标</span>'
      : '<span class="sh-goal">目标 85</span>';
    if (typeof delta === 'number' && delta !== 0) {
      html += '<span class="sh-delta ' + (delta > 0 ? 'up' : 'down') + '">' +
        (delta > 0 ? '↑ +' + delta : '↓ ' + Math.abs(delta)) + ' 分</span>';
    }
    html += '<div class="sh-dims">' + dimKeys.map(function (k) {
      return '<button type="button" class="sh-dim" data-dim="' + k + '">' +
        dimNames[k] + ' ' + Math.round(r[k] || 0) + '</button>';
    }).join('') +
      '<button type="button" class="sh-again" data-act="rhythm">节奏</button>' +
      '<button type="button" class="sh-again" data-act="again">↻ 再读一次</button>' +
      '</div>';

    if (r.audioSeconds !== undefined && r.audioSeconds < 0.3) {
      html += '<div class="sh-warn">这次几乎没有录到声音（约 ' + (r.audioSeconds || 0).toFixed(1) +
        ' 秒）。检查麦克风权限，读完再点「停止」。</div>';
    }

    html += '<div class="sh-verdict">' + esc(a.verdict) + '</div>';

    var chunks = chunkSentence(sent);
    if (chunks.length > 1 && (r.words || []).length > 12) {
      html += '<div class="sh-chunks">' + chunks.map(function (c) {
        return '<button type="button" class="sh-chunk" data-act="chunk" data-chunk="' +
          esc(c) + '">' + esc(c) + '</button>';
      }).join('') + '</div>';
    }

    if (a.issues.length) {
      html += '<div class="sh-issues">' + a.issues.map(function (x, idx) {
        return '<button type="button" class="sh-issue ' + x.type + '" data-issue="' + idx + '">' +
          '<b>' + esc(x.word) + '</b><em>' + esc(x.title) +
          (x.score ? ' · ' + Math.round(x.score) + ' 分' : '') + '</em></button>';
      }).join('') + '</div>';
    } else {
      html += '<div class="sh-ok">整句发音很稳，没有明显问题</div>';
    }

    html += '<div class="sh-note">讯飞语音评测' +
      (r.audioSeconds ? ' · 已录 ' + r.audioSeconds.toFixed(1) + ' 秒' : '') +
      ' · 点分数看失分分析，点单词看怎么读</div>';
    out.innerHTML = html;

    out.onclick = function (e) {
      var btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!btn) return;
      if (btn.dataset.act === 'again') { startISE(i, row); return; }
      if (btn.dataset.act === 'rhythm') {
        if (window.XYPronLab && reports[i]) window.XYPronLab.openRhythm(reports[i].r, sent);
        return;
      }
      if (btn.dataset.act === 'chunk') { speakSlow(btn.getAttribute('data-chunk')); return; }
      if (btn.dataset.dim) openDimSheet(i, btn.dataset.dim);
      else if (btn.dataset.issue != null) openWordSheet(i, Number(btn.dataset.issue));
    };

    noteMistakes(i, r, sent);
  }

  /* ---------- 分析弹层 ---------- */
  var sheetEl = null;

  function closeSheet() {
    if (sheetEl && sheetEl.parentNode) sheetEl.parentNode.removeChild(sheetEl);
    sheetEl = null;
  }

  function openSheet(html) {
    closeSheet();
    sheetEl = document.createElement('div');
    sheetEl.className = 'sh-sheet';
    sheetEl.innerHTML = '<div class="sh-sheet-card" role="dialog" aria-modal="true">' +
      '<button class="sh-sheet-x" type="button" aria-label="关闭">×</button>' + html + '</div>';
    document.body.appendChild(sheetEl);
    sheetEl.addEventListener('click', function (e) {
      if (e.target === sheetEl || (e.target.classList && e.target.classList.contains('sh-sheet-x'))) closeSheet();
    });
    return sheetEl;
  }

  function openDimSheet(i, dim) {
    var rep = reports[i];
    if (!rep) return;
    var d = rep.a.dims[dim];
    if (!d) return;
    var title = { accuracy: '准确度', fluency: '流畅度', integrity: '完整度' }[dim] || dim;

    var chips = '';
    if (dim === 'integrity' && rep.a.misses.length) {
      chips = '<div class="shm-chips">' + rep.a.misses.map(function (w) {
        return '<span class="shm-chip miss">' + esc(w.word) + '</span>';
      }).join('') + '</div>';
    }

    openSheet(
      '<div class="shm-title">' + title + '<span class="shm-score">' + Math.round(d.score) + ' 分</span></div>' +
      '<p class="shm-p">' + esc(d.text) + '</p>' +
      chips +
      '<div class="shm-tip">' + esc(d.tip) + '</div>'
    );
  }

  function openWordSheet(i, idx) {
    var rep = reports[i];
    if (!rep) return;
    var x = rep.a.issues[idx];
    if (!x) return;
    showWordIssue(x);
  }

  /* 点原文里标红的词，也能看发音建议 */
  function openWordByName(i, name) {
    var rep = reports[i];
    if (!rep) return;
    var k = String(name || '').toLowerCase();
    var list = rep.r.words || [];
    var w = null;
    for (var j = 0; j < list.length; j++) {
      if (String(list[j].word).toLowerCase() === k) { w = list[j]; break; }
    }
    if (!w) return;

    var info = window.XYISE.wordInfo(w);
    var miss = w.dp === 16;
    showWordIssue({
      word: w.word,
      type: miss ? 'miss' : 'pron',
      score: w.score,
      ipa: info.ipa,
      text: miss ? '这个词没读出来，或者声音太小被吞掉了。'
        : (w.dp === 128 ? '引擎听到的是另一个词，通常是漏掉或读错了某个音节。'
          : '这个词 ' + Math.round(w.score) + ' 分。'),
      tip: info.tip
    });
  }

  function showWordIssue(x) {
    var sheet = openSheet(
      '<div class="shm-title">' + esc(x.word) +
        '<span class="shm-score">' + (x.type === 'miss' ? '漏读' : Math.round(x.score) + ' 分') + '</span></div>' +
      (x.ipa ? '<div class="shm-ipa">' + esc(x.ipa) + '</div>' : '') +
      '<p class="shm-p">' + esc(x.text) + '</p>' +
      '<div class="shm-tip">怎么读：' + esc(x.tip) + '</div>' +
      '<div class="shm-acts">' +
        '<button type="button" class="shm-btn" data-act="say">🔊 标准</button>' +
        '<button type="button" class="shm-btn ghost" data-act="slow">🐢 慢速</button>' +
        '<button type="button" class="shm-btn ghost" data-act="collect">＋ 生词本</button>' +
      '</div>'
    );

    sheet.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!b || !b.dataset.act) return;
      if (b.dataset.act === 'say') speak(x.word);
      else if (b.dataset.act === 'slow') speakSlow(x.word);
      else if (b.dataset.act === 'collect') {
        var ok = collectPronWord(x.word, { ipa: x.ipa, tip: x.tip });
        if (ok) { b.textContent = '已在生词本'; b.disabled = true; toastMsg('已加入生词本：' + x.word); }
        else toastMsg('已经在生词本里了');
      }
    });
  }

  /* ---------- 发音错词本 ---------- */
  var MISTAKE_KEY = 'ise.mistakes.v1';

  function loadMistakes() {
    try { return JSON.parse(localStorage.getItem(MISTAKE_KEY) || '{}') || {}; } catch (e) { return {}; }
  }
  function saveMistakes(m) {
    try { localStorage.setItem(MISTAKE_KEY, JSON.stringify(m)); } catch (e) { }
  }

  function todayKey() {
    try { if (typeof dateKey === 'function') return dateKey(); } catch (e) { }
    var d = new Date();
    return d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' +
      String(d.getDate()).padStart(2, '0');
  }

  function collectPronWord(word, info) {
    if (typeof state !== 'object' || !state) return false;
    var k = String(word || '').toLowerCase();
    if (!k) return false;
    state.readingWords = state.readingWords || {};
    var rec = state.readingWords[k];
    if (!rec) {
      state.readingWords[k] = { w: word, zh: '', at: Date.now(), date: todayKey(), pron: info || {} };
    } else {
      rec.pron = info || {};
    }
    state.progress = state.progress || {};
    state.progress.__reading__ = state.progress.__reading__ || {};
    if (!state.progress.__reading__[k]) {
      state.progress.__reading__[k] = {
        b: 0, d: todayKey(), r: 0, w: 0, last: '', dt: todayKey(), src: 'pron'
      };
    }
    try { if (typeof saveState === 'function') saveState(); } catch (e) { }
    return true;
  }

  function noteMistakes(i, r, sent) {
    var m = loadMistakes();
    var touched = [];

    (r.words || []).forEach(function (w) {
      var bad = w.dp === 16 || w.dp === 128 || (w.dp === 0 && w.score > 0 && w.score < 60);
      if (!bad) return;
      var k = String(w.word || '').toLowerCase();
      if (!k || k === 'sil' || k === 'fil') return;
      var rec = m[k] || { count: 0, added: false };
      rec.w = w.word;
      rec.count += 1;
      rec.score = Math.round(w.score || 0);
      rec.ts = Date.now();
      rec.sent = sent;
      var info = window.XYISE.wordInfo(w);
      rec.ipa = info.ipa;
      rec.tip = info.tip;
      m[k] = rec;
      touched.push(k);
    });

    var added = [];
    touched.forEach(function (k) {
      var rec = m[k];
      if (!rec || rec.added || rec.count < 2) return;
      if (collectPronWord(k, { ipa: rec.ipa, tip: rec.tip })) {
        rec.added = true;
        added.push(k);
      }
    });

    saveMistakes(m);

    if (added.length) toastMsg('已加入生词本（发音）：' + added.join('、'));
    if (window.XYPronLab && window.XYPronLab.note) window.XYPronLab.note(r, sent);
  }

  var activeStop = null;

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
  /* 长句按标点切成意群 */
  function chunkSentence(sent) {
    var out = [], buf = '';
    for (var i = 0; i < sent.length; i++) {
      var ch = sent.charAt(i);
      buf += ch;
      if (/[,;:.!?]/.test(ch)) { out.push(buf.trim()); buf = ''; }
    }
    if (buf.trim()) out.push(buf.trim());
    return out.filter(function (x) { return x.length > 0; });
  }

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
        out += '<mark class="sh-mk ' + type + '" data-w="' + esc(w) + '">' + esc(w) + '</mark>';
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
    try { asrBroken = localStorage.getItem('shadow.asrBroken') === '1'; } catch (e) { }
    panel = el('shadowing');
    if (!panel) return;
    cur = item;
    render();
    syncModeBtn();
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
    var lab = el('shLab');
    if (lab && !lab.dataset.b) {
      lab.dataset.b = '1';
      lab.addEventListener('click', function (e) {
        var b = e.target.closest('[data-lab]');
        if (!b || !window.XYPronLab) return;
        window.XYPronLab.open(b.dataset.lab);
      });
    }
    var modeBtn = el('shMode');
    if (modeBtn && !modeBtn.dataset.b) {
      modeBtn.dataset.b = '1';
      modeBtn.addEventListener('click', toggleMode);
      syncModeBtn();
    }
    if (panel && !panel.dataset.b) {
      panel.dataset.b = '1';
      panel.addEventListener('click', function (e) {
        var act = e.target.closest('[data-act]');
        if (!act) return;
        var a = act.dataset.act;
        var i = Number(act.dataset.i);
        if (a === 'close') { close(); return; }
        if (a === 'mode') { toggleMode(); return; }
        if (a === 'listen') { speak(((cur.sentences || [])[i] || {}).en || ''); return; }
        if (a === 'slow') { speakSlow(((cur.sentences || [])[i] || {}).en || ''); return; }
        if (a === 'rec') { startRec(i); return; }
        if (a === 'retryAsr') {
          asrBroken = false;
          try { localStorage.removeItem('shadow.asrBroken'); } catch (e) { }
          var rRow = panel.querySelector('.sh-row[data-i="' + i + '"]');
          var rBtn = rRow && rRow.querySelector('[data-act="rec"]');
          if (rBtn && rBtn.dataset.url) { rBtn.dataset.url = ''; }
          startRecogOnly(i, rRow);
          return;
        }
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
