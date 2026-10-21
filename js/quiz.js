/* ==========================================================================
   闯关模式 v2 —— 6 种题型，覆盖听说读写
   一关 20 词：前 6 词速览，后 14 题混合题型
   ========================================================================== */
(function () {
  'use strict';

  var CARD_N = 6;
  var PASS_RATIO = 0.7;
  var REWARD_XP = 40;
  var REWARD_HEARTS = 3;
  var REWARD_FOOD = 0;   /* 爱宠模块已下架 */

  var quiz = null;
  function el(id) { return document.getElementById(id); }

  /* 音效：复用 app.js 的 beep，失败静默 */

  /* iOS 首次手势解锁：静音播一次 TTS + 唤醒 AudioContext */
  var _audioUnlocked = false;
  function unlockAudio() {
    if (_audioUnlocked) return;
    _audioUnlocked = true;
    try {
      if ('speechSynthesis' in window) {
        var u = new SpeechSynthesisUtterance('a');
        u.lang = 'en-US';
        u.volume = 0.01;      /* 极小但不为 0，iOS 才认为真的播过 */
        u.rate = 2;
        window.speechSynthesis.speak(u);
      }
    } catch (e) { }
    try { if (typeof beep === 'function') beep('mid'); } catch (e) { }
  }

  function sfx(kind) {
    try { if (typeof beep === 'function') beep(kind); } catch (e) { }
  }


  function pickN(arr, n) {
    var c = arr.slice(), out = [];
    while (out.length < n && c.length) out.push(c.splice(Math.floor(Math.random() * c.length), 1)[0]);
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
  function hasSentence(w) { return !!(w.s && w.s.toLowerCase().indexOf(w.w.toLowerCase()) >= 0); }

  /* 优先在线音频（保证有声），TTS 兜底 */
  var _phon = null;
  function speak(text, rate) {
    var _lg = (typeof bookAudioLang === 'function') ? bookAudioLang() : '';
    var url = _lg
      ? 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(text) + '&le=' + _lg
      : 'https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(text) + '&type=2';
    try {
      if (!_phon) _phon = new Audio();
      _phon.onerror = function () { ttsSpeak(text, rate); };
      _phon.src = url;
      var p = _phon.play();
      if (p && p.catch) p.catch(function () { ttsSpeak(text, rate); });
      return true;
    } catch (e) { return ttsSpeak(text, rate); }
  }

  function ttsSpeak(text, rate) {
    try {
      if (!('speechSynthesis' in window)) return false;
      var synth = window.speechSynthesis;
      var voices = synth.getVoices() || [];
      var en = voices.filter(function (v) { return /en[-_]US/i.test(v.lang); })[0]
            || voices.filter(function (v) { return /^en/i.test(v.lang); })[0];
      synth.cancel();
      var u = new SpeechSynthesisUtterance(text);
      var _b = (typeof bookAudioLang === 'function') ? bookAudioLang() : '';
      u.lang = _b === 'es' ? 'es-ES' : (en ? en.lang : 'en-US');
      if (en) u.voice = en;
      u.rate = rate || 0.85; u.volume = 1;
      synth.speak(u);
      return true;
    } catch (e) { return false; }
  }

  /* ---------------- 题型实现：统一走 XYCore ---------------- */
  /* 题型生成逻辑抽到 js/core.js（纯函数，可单元测试） */
  function coreLib() {
    if (typeof XYCore !== 'undefined' && XYCore) return XYCore;
    return null;
  }

  /* 西语题面适配：把「英文单词」类文案换成「西语单词」 */
  function adaptTag(qq) {
    try {
      if (!(typeof isLangBook === 'function' && isLangBook('es'))) return qq;
      if (!qq || !qq.tag) return qq;
      qq.tag = String(qq.tag)
        .replace(/英文单词/g, '西语单词')
        .replace(/英文/g, '西语');
    } catch (e) { }
    return qq;
  }

  function buildQuestion(word, pool, wanted) {
    var lib = coreLib();
    if (!lib) { console.error('XYCore 未加载，无法出题'); return null; }
    return adaptTag(lib.buildQuestion(word, pool, wanted));
  }

  /* ---------------- 开始一关 ---------------- */
  function startQuiz(info) {
    if (!info || !info.ws || !info.ws.length) return;
    if (!info.unlocked && !info.done) { toast('先完成前面那一关哦～'); return; }

    var words = info.ws;
    var cards = [];              /* 不再有速览卡：每个词都出成题 */
    var rest = words.slice(0);
    var pool = (typeof curBook !== 'undefined' && curBook && curBook.words) ? curBook.words : words;

    var plan = ['choice', 'listen', 'cloze', 'match', 'spell', 'cn2en',
                'order', 'tf', 'choice', 'listen', 'cloze', 'match', 'spell', 'order',
                'cn2en', 'choice', 'tf', 'listen', 'match', 'cloze'];
    var qs = [];
    rest.forEach(function (w, i) {
      var q = null;
      try { q = buildQuestion(w, pool, [plan[i % plan.length], 'choice', 'cloze', 'listen']); } catch (e) { q = null; }
      if (q && q.prompt != null && q.prompt !== '') qs.push(q);   /* 题面为空就跳过，不白屏 */
    });

    /* 把速览卡和题目打散混排，避免用户一路点"认识" */
    var items = qs.map(function (q) { return { kind: 'q', q: q }; });
    items = shuffled(items);

    quiz = {
      nodeId: info.n,
      station: (info.n % 10) + 1,
      country: (typeof COUNTRIES !== 'undefined') ? COUNTRIES[Math.floor(info.n / 10) % COUNTRIES.length] : null,
      phase: 'enter', cards: cards, ci: 0, revealed: false,
      qs: qs, qi: 0, correct: 0, wrongWords: [],
      items: items, idx: 0
    };
    applyCountryTheme(quiz.country);
    el('quizPanel').classList.add('is-open');
    document.documentElement.classList.add('overlay-open');
    renderQuiz();
  }


  /* 只练错题：拿错词重新出一套题 */
  function startWrongDrill(words) {
    var pool = (typeof curBook !== 'undefined' && curBook && curBook.words) ? curBook.words : [];
    var wset = {};
    words.forEach(function (w) { wset[w] = 1; });
    var picked = pool.filter(function (w) { return wset[w.w]; });
    if (!picked.length) { if (typeof toast === 'function') toast('没有错题可练'); return; }

    var plan = ['choice', 'listen', 'cloze', 'cn2en', 'spell'];
    var qs = [];
    picked.forEach(function (w, i) {
      var q = null;
      try { q = buildQuestion(w, pool, [plan[i % plan.length], 'choice', 'cn2en']); } catch (e) { }
      if (q) qs.push(q);
    });
    if (!qs.length) return;

    var items = qs.map(function (q) { return { kind: 'q', q: q }; });
    quiz = {
      nodeId: quiz ? quiz.nodeId : 0,
      station: quiz ? quiz.station : 1,
      country: quiz ? quiz.country : null,
      phase: 'run', cards: [], ci: 0, revealed: false,
      qs: qs, qi: 0, correct: 0, wrongWords: [], drill: true,
      items: items, idx: 0
    };
    applyCountryTheme(quiz.country);
    el('quizPanel').classList.add('is-open');
    document.documentElement.classList.add('overlay-open');
    renderQuiz();
  }

  function closeQuiz() {
    quiz = null;
    el('quizPanel').classList.remove('is-open');
    document.documentElement.classList.remove('overlay-open');
  }

  function applyCountryTheme(country) {
    var panel = el('quizPanel');
    if (!panel || !country) return;
    panel.style.setProperty('--q-sky1', (country.sky && country.sky[0]) || '#eef7f0');
    panel.style.setProperty('--q-sky2', (country.sky && country.sky[1]) || '#e4f2e8');
    var img = el('quizBg');
    if (img) {
      if (country.img) { img.src = 'data/countries/' + country.img + '.jpg'; img.style.display = 'block'; }
      else { img.removeAttribute('src'); img.style.display = 'none'; }
    }
  }

  /* ---------------- 渲染 ---------------- */
  function renderQuiz() {
    if (!quiz) return;
    var body = el('quizBody'), bar = el('quizBar'), title = el('quizTitle');
    if (!body || !bar) return;

    var total = quiz.items ? quiz.items.length : (quiz.cards.length + quiz.qs.length);
    var done = quiz.phase === 'enter' ? 0
      : quiz.phase === 'done' ? total
      : (quiz.items ? quiz.idx : 0);
    bar.style.width = Math.min(100, done / Math.max(1, total) * 100) + '%';
    if (title) {
      title.textContent = quiz.country
        ? quiz.country.emoji + ' ' + quiz.country.name + ' · 第 ' + (quiz.station || 1) + ' 站'
        : '第 ' + (quiz.nodeId + 1) + ' 关';
    }

    if (quiz.phase === 'enter') return renderEnter(body);
    if (quiz.phase === 'done') return renderDone(body);

    var it = quiz.items && quiz.items[quiz.idx];
    if (!it) { quiz.phase = 'done'; return renderDone(body); }
    if (it.kind === 'card') return renderCard(body, it.word);
    return renderQuestion(body, it.q);
  }

  function renderEnter(body) {
    var c = quiz.country || { name: '关卡', emoji: '🗺️', tag: '' };
    var dots = '';
    for (var i = 0; i < 10; i++) {
      dots += '<i class="' + (i < quiz.station - 1 ? 'done' : (i === quiz.station - 1 ? 'now' : '')) + '"></i>';
    }
    body.innerHTML =
      '<div class="q-enter">' +
        '<div class="q-enter-emoji">' + '<span class="ic ic-32" data-icon="map"></span></div>' +
        '<div class="q-enter-name">' + (c.name || '') + '</div>' +
        '<div class="q-enter-tag">' + (c.tag || '') + '</div>' +
        '<div class="q-enter-station">第 <b>' + (quiz.station || 1) + '</b> 站 / 共 10 站</div>' +
        '<div class="q-enter-dots">' + dots + '</div>' +
        '<div class="q-enter-plan">' + quiz.qs.length + ' 道题，<b>题型随机混排</b><br>' +
          '<span>看词选义 · 例句填空 · 听音选词 · 词义配对 · 听写 · 句子排序</span></div>' +
        '<div class="q-rule">' +
          '答对 <b>' + Math.ceil(quiz.qs.length * PASS_RATIO) + '</b> 题即可通关（共 ' + quiz.qs.length + ' 题）<br>' +
          '<span>答错不扣分，只影响能否通关</span>' +
        '</div>' +
      '</div>' +
      '<div class="q-actions"><button class="q-btn q-btn-good" id="qGo">开始闯关</button></div>';
    var go = el('qGo');
    if (go) go.onclick = function () {
      unlockAudio();                       /* iOS：必须在用户手势里解锁 */
      quiz.phase = quiz.cards.length ? 'card' : 'quiz';
      renderQuiz();
    };
  }

  function renderCard(body, w) {
    if (!w) { nextItem(); return; }
    var reveal = '';
    if (quiz.revealed) {
      var defs = (w.t && w.t.length) ? w.t.map(function (t) { return '<div>' + t + '</div>'; }).join('')
        : '<div class="q-null">这个词暂无释义</div>';
      reveal = '<div class="q-reveal show">' + defs +
        (w.s ? '<div class="q-sent">' + w.s + '</div>' : '') +
        (w.sz ? '<div class="q-sent-zh">' + w.sz + '</div>' : '') +
        '</div>';
    } else {
      reveal = '<div class="q-hint">轻点卡片看释义 · 共 ' + quiz.cards.length + ' 词</div>';
    }
    body.innerHTML =
      '<div class="q-card">' +
        '<div class="q-tag">速览</div>' +
        '<div class="q-word">' + w.w + '</div>' +
        '<div class="q-ph">' + (w.us ? 'US /' + w.us + '/' : '') + (w.uk ? '  UK /' + w.uk + '/' : '') + '</div>' +
        reveal +
      '</div>' +
      '<div class="q-actions">' +
        '<button class="q-btn q-btn-again" id="qAgain">不认识</button>' +
        '<button class="q-btn q-btn-good" id="qGood">认识</button>' +
      '</div>';
    var card = body.querySelector('.q-card');
    if (card) card.onclick = function () { sfx('mid'); quiz.revealed = true; renderQuiz(); };
    var a = el('qAgain'), g = el('qGood');
    if (a) a.onclick = function (e) { e.stopPropagation(); sfx('no'); nextCard(false); };
    if (g) g.onclick = function (e) { e.stopPropagation(); sfx('ok'); nextCard(true); };
  }

  function nextCard(known) {
    var it = quiz.items && quiz.items[quiz.idx];
    var w = it ? it.word : null;
    if (!quiz.revealed) {
      quiz.revealed = true;
      renderQuiz();
      return;
    }
    if (!known) quiz.wrongWords.push(w.w);
    try {
      if (typeof progressOf === 'function' && typeof saveState === 'function') {
        var p = progressOf(), k = wordKey(w.w);
        if (!p[k]) {
          p[k] = { b: known ? 1 : 0, d: shiftDay(known ? 1 : 0), r: 1, w: known ? 0 : 1, last: dateKey(), dt: dateKey() };
          saveState();
        }
      }
    } catch (e) { }
    quiz.revealed = false;
    nextItem();
  }

  /* ---------------- 题目 ---------------- */

  /* 需要"第一次教一下"的题型 —— 其余题型一看就懂，不打扰 */
  var HINT_TYPES = {
    match: {
      icon: 'hand',
      title: '词义配对',
      lines: ['先点左边一个**英文词**', '再点右边对应的**中文释义**', '配对正确会变绿并锁住'],
      tip: '4 组必须全配对正确，这题才算答对'
    },
    spell: {
      icon: 'speaker',
      title: '听写',
      lines: ['听发音，看它读的是哪个词', '按**顺序点**下面的字母块', '点错了可以撤销'],
      tip: '字母全部点对才算答对，点错可撤销'
    },
    order: {
      icon: 'tile',
      title: '句子排序',
      lines: ['下面的单词是**打乱**的', '按正确语序**依次点**它们', '排好点确认'],
      tip: '整句语序全对才算答对'
    }
  };

  function hintSeen(type) {
    try { return !!(state.quizHintSeen && state.quizHintSeen[type]); } catch (e) { return true; }
  }
  function markHint(type) {
    try {
      if (!state.quizHintSeen) state.quizHintSeen = {};
      state.quizHintSeen[type] = Date.now();
      if (typeof saveState === 'function') saveState();
    } catch (e) { }
  }

  function renderHint(body, q) {
    var h = HINT_TYPES[q.type];
    body.innerHTML =
      '<div class="q-hintcard">' +
        '<div class="qh-icon" data-icon="' + h.icon + '"></div>' +
        '<div class="qh-title">' + h.title + '</div>' +
        '<div class="qh-lines">' +
          h.lines.map(function (l) {
            return '<div>' + l.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') + '</div>';
          }).join('') +
        '</div>' +
        '<div class="qh-tip">' + h.tip + '</div>' +
      '</div>' +
      '<div class="q-actions"><button class="q-btn q-btn-good" id="qhGo">知道了，开始</button></div>';
    var go = el('qhGo');
    if (go) go.onclick = function () {
      markHint(q.type);
      sfx('mid');
      renderQuestion(body);
    };
  }


  function renderQuestion(body, q) {
    if (!q) { nextItem(); return; }
    /* 第一次遇到不会用的题型：先教一次 */
    if (HINT_TYPES[q.type] && !hintSeen(q.type)) {
      quiz.phase = 'quiz';
      return renderHint(body, q);
    }
    if ((q.type === 'listen' || q.type === 'spell') && _audioUnlocked) {
      setTimeout(function () { speak(q.word.w); }, 260);
    }

    /* 题干长度自适应：短词大字号，长句子小字号，避免撑爆卡片 */
    var _pt = String(q.prompt || '');
    var _lenCls = _pt.length > 60 ? 'q-len-xl' : _pt.length > 30 ? 'q-len-lg' : _pt.length > 14 ? 'q-len-md' : '';
    var _isListen = (q.type === 'listen' || q.type === 'spell');
    var head = _isListen
      ? '<div class="q-card q-quiz-card q-listen-card">' +
          '<div class="q-tag">' + q.tag + '<span class="q-dim">' + q.dim + '</span></div>' +
          '<button class="q-hero" id="qSpeak">' +
            '<span class="q-hero-icon" data-icon="speaker"></span>' +
            '<span class="q-hero-label">点击播放</span>' +
          '</button>' +
        '</div>'
      : '<div class="q-card q-quiz-card">' +
          '<div class="q-tag">' + q.tag + '<span class="q-dim">' + q.dim + '</span></div>' +
          '<div class="q-word ' + _lenCls + '">' + q.prompt + '</div>' +
          (q.sub ? '<div class="q-ph">' + q.sub + '</div>' : '') +
        '</div>';

    var prog = '<div class="q-progress">第 ' + (quiz.idx + 1) + ' / ' + (quiz.items ? quiz.items.length : quiz.qs.length) + ' 步　答对 ' + quiz.correct + '</div>';

    if (q.type === 'choice' || q.type === 'listen') {
      body.innerHTML = head + '<div class="q-opts">' +
        q.opts.map(function (o, i) {
          return '<button class="q-opt" data-i="' + i + '"><span class="q-letter">' + 'ABCD'[i] + '</span><span>' + o.text + '</span></button>';
        }).join('') + '</div>' + prog;
      bindChoice(body, q);
    } else if (q.type === 'match') {
      var lcol = q.left.map(function (o) {
        return '<button class="q-match-item" data-side="L" data-id="' + o.id + '">' + o.text + '</button>';
      }).join('');
      var rcol = q.right.map(function (o) {
        return '<button class="q-match-item" data-side="R" data-id="' + o.id + '">' + o.text + '</button>';
      }).join('');
      body.innerHTML =
        '<div class="q-match">' +
          '<div class="q-match-col">' + lcol + '</div>' +
          '<div class="q-match-col">' + rcol + '</div>' +
        '</div>' + prog;
      bindMatch(body, q);
    } else if (q.type === 'tf') {
      body.innerHTML = head +
        '<div class="q-actions q-tf">' +
          '<button class="q-btn q-btn-again" id="qFalse"><span class="ic" data-icon="cross"></span> 不对</button>' +
          '<button class="q-btn q-btn-good" id="qTrue"><span class="ic" data-icon="check"></span> 对的</button>' +
        '</div>' + prog;
      bindTF(body, q);
    } else if (q.type === 'order') {
      var otiles = '';
      q.tiles.forEach(function (t, i) { otiles += '<button class="q-tile q-tile-word" data-i="' + i + '">' + t.text + '</button>'; });
      body.innerHTML = head +
        '<div class="q-order-line" id="qLine"></div>' +
        '<div class="q-tiles" id="qTiles">' + otiles + '</div>' +
        '<div class="q-actions q-actions-3">' +
          '<button class="q-btn q-btn-ghost" id="qSkip">跳过</button>' +
          '<button class="q-btn q-btn-again" id="qUndo">撤销</button>' +
          '<button class="q-btn q-btn-good" id="qSubmit" disabled>确认</button>' +
        '</div>' + prog;
      bindOrder(body, q);
      bindSkip(body, q);
    } else if (q.type === 'spell') {
      var slots = '', tiles = '';
      for (var i = 0; i < q.answer.length; i++) slots += '<i></i>';
      q.tiles.forEach(function (t, i) { tiles += '<button class="q-tile" data-i="' + i + '">' + t.ch + '</button>'; });
      body.innerHTML = head +
        '<div class="q-slots" id="qSlots">' + slots + '</div>' +
        '<div class="q-tiles" id="qTiles">' + tiles + '</div>' +
        '<div class="q-actions q-actions-3">' +
          '<button class="q-btn q-btn-ghost" id="qSkip">跳过</button>' +
          '<button class="q-btn q-btn-again" id="qUndo">撤销</button>' +
          '<button class="q-btn q-btn-good" id="qSubmit" disabled>确认</button>' +
        '</div>' + prog;
      bindSpell(body, q);
      bindSkip(body, q);
    }

    var sp = el('qSpeak');
    if (sp) sp.onclick = function (e) {
      e.stopPropagation();
      speak(q.word.w);
      sp.classList.add('played');
      var lb = sp.querySelector('.q-hero-label');
      if (lb) lb.textContent = '再听一次';
    };
  }


  /* 答错时把正确答案亮出来 */
  function showAnswerLine(body, text) {
    var old = body.querySelector('.q-answer');
    if (old) old.remove();
    var d = document.createElement('div');
    d.className = 'q-answer';
    d.innerHTML = '正确答案：<b>' + text + '</b>';
    var prog = body.querySelector('.q-progress');
    if (prog) prog.parentNode.insertBefore(d, prog);
    else body.appendChild(d);
  }

  function bindChoice(body, q) {
    var opts = body.querySelectorAll('.q-opt');
    Array.prototype.forEach.call(opts, function (btn) {
      btn.onclick = function () {
        var i = Number(btn.dataset.i), ok = q.opts[i].ok;
        sfx(ok ? 'ok' : 'no');
        Array.prototype.forEach.call(opts, function (b, j) {
          b.disabled = true;
          if (q.opts[j].ok) b.classList.add('is-right');
          else if (j === i) b.classList.add('is-wrong');
        });
        sfx(ok ? 'ok' : 'no');
        if (ok) quiz.correct++; else quiz.wrongWords.push(q.word.w);
        setTimeout(nextQuestion, ok ? 750 : 1400);
      };
    });
  }

  function bindMatch(body, q) {
    var selL = null, selR = null, done = 0, mistakes = 0;
    var total = q.left.length;

    function clearSel() {
      body.querySelectorAll('.q-match-item.is-sel').forEach(function (b) { b.classList.remove('is-sel'); });
      selL = null; selR = null;
    }

    function judge() {
      if (!selL || !selR) return;
      var a = selL, b = selR;
      var ok = a.dataset.id === b.dataset.id;
      if (ok) {
        a.classList.add('is-ok'); b.classList.add('is-ok');
        a.disabled = true; b.disabled = true;
        done++;
        sfx('ok');
        selL = null; selR = null;
        if (done >= total) {
          if (mistakes === 0) quiz.correct++;
          else quiz.wrongWords.push(q.word.w);
          setTimeout(nextQuestion, 700);
        }
      } else {
        mistakes++;
        a.classList.add('is-bad'); b.classList.add('is-bad');
        sfx('no');
        setTimeout(function () {
          a.classList.remove('is-bad', 'is-sel');
          b.classList.remove('is-bad', 'is-sel');
          selL = null; selR = null;
        }, 520);
      }
    }

    body.querySelectorAll('.q-match-item').forEach(function (btn) {
      btn.onclick = function () {
        if (btn.disabled) return;
        var side = btn.dataset.side;
        if (side === 'L') {
          if (selL === btn) { btn.classList.remove('is-sel'); selL = null; return; }
          if (selL) selL.classList.remove('is-sel');
          selL = btn; btn.classList.add('is-sel');
        } else {
          if (selR === btn) { btn.classList.remove('is-sel'); selR = null; return; }
          if (selR) selR.classList.remove('is-sel');
          selR = btn; btn.classList.add('is-sel');
        }
        judge();
      };
    });
  }


  /* 跳过：记为答错，亮出正确答案后进入下一题 */
  function bindSkip(body, q) {
    const btn = el('qSkip');
    if (!btn) return;
    btn.onclick = function () {
      sfx('no');
      if (quiz.wrongWords.indexOf(q.word.w) < 0) quiz.wrongWords.push(q.word.w);
      const slots = el('qSlots');
      if (slots && q.answer) {
        const ss = slots.querySelectorAll('i');
        for (let i = 0; i < ss.length; i++) {
          ss[i].textContent = q.answer[i] || '';
          ss[i].className = 'on ok';
        }
        slots.classList.add('is-right');
      }
      const line = el('qLine');
      if (line) { line.innerHTML = ''; line.classList.add('is-wrong'); }
      showAnswerLine(body, q.answer || '');
      btn.disabled = true;
      const sub = el('qSubmit'); if (sub) sub.disabled = true;
      const undo = el('qUndo'); if (undo) undo.disabled = true;
      setTimeout(nextQuestion, 1800);
    };
  }

  function bindSpell(body, q) {
    var slots = el('qSlots'), tilesBox = el('qTiles'), submit = el('qSubmit'), undo = el('qUndo');
    var picked = [];
    function paint() {
      var ss = slots.querySelectorAll('i');
      Array.prototype.forEach.call(ss, function (s, i) {
        s.textContent = picked[i] ? picked[i].ch : '';
        s.className = picked[i] ? 'on' : '';
      });
      var ts = tilesBox.querySelectorAll('.q-tile');
      Array.prototype.forEach.call(ts, function (t) {
        var idx = Number(t.dataset.i);
        var used = picked.some(function (p) { return p.idx === idx; });
        t.classList.toggle('used', used);
      });
      if (submit) submit.disabled = picked.length !== q.answer.length;
    }
    var ts = tilesBox.querySelectorAll('.q-tile');
    Array.prototype.forEach.call(ts, function (t) {
      t.onclick = function () {
        var i = Number(t.dataset.i);
        if (picked.some(function (p) { return p.idx === i; })) return;
        if (picked.length >= q.answer.length) return;
        picked.push({ ch: q.tiles[i].ch, idx: i });
        paint();
      };
    });
    if (undo) undo.onclick = function () { picked.pop(); paint(); };
    if (submit) submit.onclick = function () {
      var typed = picked.map(function (p) { return p.ch; }).join('');
      var ok = typed.toLowerCase() === q.answer.toLowerCase();
      sfx(ok ? 'ok' : 'no');
      if (ok) quiz.correct++; else quiz.wrongWords.push(q.word.w);
      slots.classList.add(ok ? 'is-right' : 'is-wrong');
      submit.disabled = true;
      if (!ok) {
        /* 把正确拼写填进槽位 */
        var ss = slots.querySelectorAll('i');
        for (var i2 = 0; i2 < ss.length; i2++) {
          ss[i2].textContent = q.answer[i2] || '';
          ss[i2].className = 'on ok';
        }
        showAnswerLine(body, q.answer);
      }
      setTimeout(nextQuestion, ok ? 750 : 1900);
    };
    paint();
  }


  function bindTF(body, q) {
    var t = el('qTrue'), f = el('qFalse');
    function answer(said) {
      var ok = (said === q.shownOk);
      sfx(ok ? 'ok' : 'no');
      if (ok) quiz.correct++; else quiz.wrongWords.push(q.word.w);
      if (!ok) {
        var right = q.shownOk ? '这个释义是对的' : ('这个释义不对，应该是「' + ((q.word.t && q.word.t[0]) || '') + '」');
        showAnswerLine(body, right);
      }
      if (t) t.disabled = true;
      if (f) f.disabled = true;
      var card = body.querySelector('.q-quiz-card');
      if (card) card.classList.add(ok ? 'is-ok' : 'is-bad');
      setTimeout(nextQuestion, ok ? 750 : 1400);
    }
    if (t) t.onclick = function () { answer(true); };
    if (f) f.onclick = function () { answer(false); };
  }

  function bindOrder(body, q) {
    var line = el('qLine'), tilesBox = el('qTiles'), submit = el('qSubmit'), undo = el('qUndo');
    var picked = [];
    function paint() {
      line.innerHTML = picked.map(function (p) { return '<span>' + p.text + '</span>'; }).join('');
      var ts = tilesBox.querySelectorAll('.q-tile');
      Array.prototype.forEach.call(ts, function (bt) {
        var idx = Number(bt.dataset.i);
        bt.classList.toggle('used', picked.some(function (p) { return p.idx === idx; }));
      });
      if (submit) submit.disabled = picked.length !== q.tiles.length;
    }
    var ts = tilesBox.querySelectorAll('.q-tile');
    Array.prototype.forEach.call(ts, function (bt) {
      bt.onclick = function () {
        var i = Number(bt.dataset.i);
        if (picked.some(function (p) { return p.idx === i; })) return;
        picked.push({ text: q.tiles[i].text, idx: i });
        paint();
      };
    });
    if (undo) undo.onclick = function () { picked.pop(); paint(); };
    if (submit) submit.onclick = function () {
      var typed = picked.map(function (p) { return p.text; }).join(' ');
      var ok = typed.toLowerCase() === q.answer.toLowerCase();
      sfx(ok ? 'ok' : 'no');
      if (ok) quiz.correct++; else quiz.wrongWords.push(q.word.w);
      line.classList.add(ok ? 'is-right' : 'is-wrong');
      submit.disabled = true;
      if (!ok) showAnswerLine(body, q.answer);
      setTimeout(nextQuestion, ok ? 800 : 2200);
    };
    paint();
  }

  function nextQuestion() { nextItem(); }

  /* 记录一个词的学习结果（代替原来的速览卡打分） */
  function markWord(w, ok) {
    if (!w || !w.w) return;
    try {
      if (typeof progressOf !== 'function' || typeof saveState !== 'function') return;
      var p = progressOf(), k = wordKey(w.w);
      var cur = p[k];
      if (cur) {
        cur.r = (cur.r || 1) + 1;
        if (ok) { cur.b = Math.min((cur.b || 0) + 1, 7); cur.d = shiftDay(BOX_DAYS ? BOX_DAYS[cur.b] : 1); }
        else { cur.b = 0; cur.d = shiftDay(0); cur.w = (cur.w || 0) + 1; }
        cur.last = dateKey();
      } else {
        p[k] = { b: ok ? 1 : 0, d: shiftDay(ok ? 1 : 0), r: 1, w: ok ? 0 : 1, last: dateKey(), dt: dateKey() };
      }
      saveState();
    } catch (e) { }
  }

  /* 前进到下一个混排项 */
  function nextItem() {
    if (!quiz) return;
    var _it = quiz.items && quiz.items[quiz.idx];
    if (_it && _it.kind === 'q' && _it.q && _it.q.word) {
      markWord(_it.q.word, quiz.wrongWords.indexOf(_it.q.word.w) < 0);
    }
    quiz.idx++;
    quiz.revealed = false;
    if (!quiz.items || quiz.idx >= quiz.items.length) quiz.phase = 'done';
    renderQuiz();
  }

  /* ---------------- 结算 ---------------- */
  function renderDone(body) {
    var need = Math.ceil(quiz.qs.length * PASS_RATIO);
    var passed = quiz.correct >= need;

    /* 通关后要把下一关找出来：先重算路径，解锁状态才会更新 */
    var nextInfo = null;
    if (passed) {
      try { if (typeof renderPath === 'function' && !new URLSearchParams(location.search).get('dbgquiz')) renderPath(); } catch (e) { }
      if (typeof pathInfos !== 'undefined') {
        nextInfo = pathInfos.filter(function (p) { return p.n === quiz.nodeId + 1; })[0] || null;
      }
    }
    body.innerHTML =
      '<div class="q-done ' + (passed ? 'ok' : 'fail') + '">' +
        '<div class="q-done-emoji">' + (passed ? '<span class="ic ic-28" data-icon="party"></span>' : '<span class="ic ic-28" data-icon="star"></span>') + '</div>' +
        '<div class="q-done-title">' + (passed ? '通关！' : '差一点') + '</div>' +
        (quiz.country ? '<div class="q-done-country">' + quiz.country.emoji + ' ' + quiz.country.name + ' · 第 ' + (quiz.station || 1) + ' 站</div>' : '') +
        '<div class="q-done-sub">答对 <b>' + quiz.correct + '</b> / ' + quiz.qs.length + ' 题' +
          (passed ? '（通过线 ' + need + '）' : '（通过线 ' + need + ' 题，差 ' + (need - quiz.correct) + ' 题）') + '</div>' +
        (quiz.wrongWords.length ? '<div class="q-done-rule">答错不扣分，错的词已记入错词本</div>' : '') +
        (passed ? '<div class="q-reward"><span>+'+REWARD_XP+' XP</span><span>+'+REWARD_HEARTS+' <span class="ic ic-14" data-icon="heart"></span></span><span>+'+REWARD_FOOD+' <span class="ic ic-14" data-icon="leaf"></span></span></div>' : '') +
        (quiz.wrongWords.length ? '<div class="q-wrong-list">错的词：' + quiz.wrongWords.slice(0, 10).join('、') + '</div>' : '') +
      '</div>' +
      '<div class="q-actions">' +
        '<button class="q-btn q-btn-again" id="qClose">退出</button>' +
        '<button class="q-btn q-btn-good" id="qRetry">' + (passed ? (nextInfo ? '下一关 →' : '本章完成') : '只练错题') + '</button>' +
      '</div>';
    if (passed && !quiz.rewarded) {
      quiz.rewarded = true;
      sfx('ok'); setTimeout(function(){ sfx('ok'); }, 180);
      grantReward(quiz.nodeId);
      setTimeout(function () { checkChapterDone(quiz.country, quiz.nodeId); }, 400);
    }
    var quizWrongWords = (quiz.wrongWords || []).slice();
    var c = el('qClose'), r = el('qRetry');
    if (c) c.onclick = function () { closeQuiz(); if (typeof renderPath === 'function') renderPath(); };
    if (r) r.onclick = function () {
      var curNode = quiz.nodeId;
      closeQuiz();
      if (typeof renderPath === 'function') renderPath();
      var target = null;
      if (passed) {
        target = nextInfo;
        if (!target) {                       /* 本章最后一关 */
          if (typeof toast === 'function') toast('这一章全部通关啦');
          return;
        }
        if (!target.unlocked && !target.done) {
          if (typeof toast === 'function') toast('下一关还没解锁');
          return;
        }
      } else {
        /* 只练错题：从错词里重新组一套题 */
        var wrong = (quizWrongWords.length ? quizWrongWords : []).slice();
        if (wrong.length) { startWrongDrill(wrong); return; }
        target = (typeof pathInfos !== 'undefined')
          ? pathInfos.filter(function (p) { return p.n === curNode; })[0] : null;
      }
      if (target) startQuiz(target);
    };
  }

  function grantReward(nodeId) {
    try {
      if (!state.quizPass) state.quizPass = {};
      var first = !state.quizPass[nodeId];
      state.quizPass[nodeId] = Date.now();
      var xp = first ? REWARD_XP : Math.round(REWARD_XP / 2);
      if (typeof addXp === 'function') addXp(xp);
      if (typeof todayRec === 'function') { var t = todayRec(); t.xp = (t.xp || 0) + xp; }
      if (state.hearts) {
        var cap = (typeof HEARTS_PER_DAY !== 'undefined') ? HEARTS_PER_DAY : 20;
        state.hearts.n = Math.min(cap, (state.hearts.n || 0) + REWARD_HEARTS);
      }
      /* 宠物食物奖励已随模块下架 */
      if (typeof saveState === 'function') saveState();
      if (typeof toast === 'function') toast(first ? ' 首次通关！+' + xp + ' XP' : '再通一次 +' + xp + ' XP');
    } catch (e) { }
  }

  /* ---------------- 章节庆祝 ---------------- */
  function chapterDoneCount(ch) {
    if (typeof pathInfos === 'undefined') return 0;
    var s = ch * 10, e = Math.min(s + 10, pathInfos.length), n = 0;
    for (var i = s; i < e; i++) {
      var info = pathInfos[i];
      if (info.done || (state.quizPass && state.quizPass[info.n])) n++;
    }
    return n;
  }

  function checkChapterDone(country, nodeId) {
    var ch = Math.floor(nodeId / 10);
    var total = Math.min(10, (typeof pathInfos !== 'undefined' ? pathInfos.length : 10) - ch * 10);
    if (chapterDoneCount(ch) < total) return;
    if (state.countryDone && state.countryDone[ch]) return;
    setTimeout(function () { showChapterCelebration(country, ch); }, 600);
  }

  function showChapterCelebration(country, ch) {
    if (!state.countryDone) state.countryDone = {};
    state.countryDone[ch] = Date.now();
    try { if (typeof saveState === 'function') saveState(); } catch (e) { }
    var c = country || { name: '这一章', emoji: '🗺️', tag: '' };
    var box = el('celePanel');
    if (!box) {
      box = document.createElement('div');
      box.id = 'celePanel'; box.className = 'cele';
      document.body.appendChild(box);
    }
    box.innerHTML =
      '<img class="cele-bg" src="' + (c.img ? 'data/countries/' + c.img + '.jpg' : '') + '" alt="">' +
      '<div class="cele-veil"></div>' +
      '<div class="cele-inner">' +
        '<div class="cele-top"> 旅程完成</div>' +
        '<div class="cele-emoji">' + '<span class="ic ic-32" data-icon="map"></span></div>' +
        '<div class="cele-name">' + c.name + '</div>' +
        '<div class="cele-tag">' + (c.tag || '') + ' · 10 站全部走完</div>' +
        '<div class="cele-pet-emoji" data-icon="party"></div>' +
        '<div class="cele-note">这一章的词全部过了一遍</div>' +
        '<button class="cele-btn" id="celeGo">继续下一段旅程</button>' +
      '</div>';
    box.classList.add('is-open');
    try { if (typeof confetti === 'function') { confetti(120); setTimeout(function () { confetti(80); }, 500); } } catch (e) { }
    
    var go = el('celeGo');
    if (go) go.onclick = function () {
      box.classList.remove('is-open');
      closeQuiz();
      if (typeof renderPath === 'function') renderPath();
    };
  }

  /* ---------------- 绑定 ---------------- */
  function bind() {
    var close = el('quizClose');
    if (close) close.onclick = closeQuiz;

    document.addEventListener('click', function (e) {
      var node = e.target.closest && e.target.closest('.node');
      if (!node || typeof pathInfos === 'undefined') return;
      var n = Number(node.dataset.node);
      var info = null;
      for (var i = 0; i < pathInfos.length; i++) if (pathInfos[i].n === n) { info = pathInfos[i]; break; }
      if (!info || (!info.unlocked && !info.done)) return;
      e.stopPropagation(); e.preventDefault();
      unlockAudio();          /* 关键：这是第一个用户手势，必须在这里解锁 */
      startQuiz(info);
    }, true);

    var dbg = new URLSearchParams(location.search).get('dbgquiz');
    if (dbg) {
      setTimeout(function () {
        var infos = (typeof pathInfos !== 'undefined') ? pathInfos : [];
        var target = null;
        for (var i = 0; i < infos.length; i++) if (infos[i].unlocked || infos[i].done) { target = infos[i]; break; }
        if (!target) target = infos[0];
        if (!target) return;
        if (new URLSearchParams(location.search).get('nohint') === '1') {
          if (!state.quizHintSeen) state.quizHintSeen = {};
          Object.keys(HINT_TYPES).forEach(function (k) { state.quizHintSeen[k] = 1; });
        }
        startQuiz(target);

        /* 调试：强制第一题为指定题型 */
        var _wantType = new URLSearchParams(location.search).get('dbgtype');
        if (_wantType) setTimeout(function () {
          try {
            var lib = (typeof XYCore !== 'undefined') ? XYCore : null;
            if (!lib || !quiz || !quiz.qs) return;
            for (var i = 0; i < quiz.qs.length; i++) {
              if (quiz.qs[i].type === _wantType) {
                quiz.items = [{ kind: 'q', q: quiz.qs[i] }];
                quiz.idx = 0; quiz.phase = 'run';
                renderQuiz(); return;
              }
            }
            /* 题库里没有该题型 → 直接造一个 */
            var w = (curBook && curBook.words) ? curBook.words[0] : null;
            var gen = { spell: lib.qSpell, order: lib.qOrder, match: lib.qMatch, tf: lib.qTrueFalse,
                        listen: lib.qListen, cloze: lib.qCloze }[_wantType];
            if (w && gen) {
              var q = gen(w, curBook.words);
              if (q) { quiz.items = [{ kind: 'q', q: q }]; quiz.idx = 0; quiz.phase = 'run'; renderQuiz(); }
            }
          } catch (e) { document.title = 'DBGTYPE-ERR:' + e.message; }
        }, 400);
        if (dbg === '2') setTimeout(function () { quiz.ci = quiz.cards.length; quiz.phase = 'quiz'; renderQuiz(); }, 300);
        var qn = Number(new URLSearchParams(location.search).get('dbgq') || -1);
        if (qn >= 0) setTimeout(function () { quiz.ci = quiz.cards.length; quiz.phase = 'quiz'; quiz.qi = qn; renderQuiz(); }, 320);
        if (dbg === '3') setTimeout(function () { quiz.phase = 'done'; quiz.correct = 12; renderQuiz(); }, 300);
      }, 1500);
    }
    if (new URLSearchParams(location.search).get('dbgcele') === '1') {
      setTimeout(function () {
        showChapterCelebration((typeof COUNTRIES !== 'undefined') ? COUNTRIES[0] : null, 0);
      }, 1600);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();


  if (new URLSearchParams(location.search).get('dbgunlock') === '1') {
    setTimeout(function () {
      try {
        state.quizPass = state.quizPass || {};
        state.quizPass[0] = Date.now();      /* 假装第 1 关刚通关 */
        saveState();
        renderPath();
        setTimeout(function () {
          var n1 = document.querySelector('.node[data-node="1"]');
          var cls = n1 ? n1.className : 'NO-NODE';
          var infos = pathInfos || [];
          document.title = 'N0.done=' + infos[0].done + ' N1.unlocked=' + infos[1].unlocked + ' cls=' + cls;
        }, 400);
      } catch (e) { document.title = 'UL-FAIL:' + e.message; }
    }, 1800);
  }


  if (new URLSearchParams(location.search).get('dbgorder') === '1') {
    setTimeout(function () {
      try {
        var infos = pathInfos || [];
        var t = infos.filter(function (i) { return i.unlocked || i.done; })[0] || infos[0];
        if (!t) { document.title = 'NO-NODE'; return; }
        startQuiz(t);
        var seq = (quiz.items || []).slice(0, 14).map(function (it) {
          return it.kind === 'card' ? 'C' : (it.q.dim || 'Q');
        });
        document.title = seq.join(',');
      } catch (e) { document.title = 'ERR:' + e.message; }
    }, 2600);
  }

  window.startQuiz = startQuiz;
  window.closeQuiz = closeQuiz;
})();


