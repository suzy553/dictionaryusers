/* ==========================================================================
   每日阅读 v2
   - 竖屏翻页（上滑下一篇）
   - 逐句点译：点某句显示这句的中文
   - 点词查义：点单词弹释义，可收藏进「阅读生词本」
   - 文章汇总：按日期归档，可回看
   ========================================================================== */
(function () {
  'use strict';

  var FEED = null;
  var ARCH = null;
  var idx = 0;
  var audio = null;
  var playingId = null;

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function msg(t) {
    try { if (typeof toast === 'function') toast(t, 2200); } catch (e) { }
  }

  /* ---------------- 数据 ---------------- */
  async function loadFeed() {
    if (FEED) return FEED;
    try {
      var r = await fetch('data/reading.json', { cache: 'no-cache' });
      FEED = await r.json();
    } catch (e) { FEED = { items: [] }; }
    return FEED;
  }
  async function loadArchive() {
    if (ARCH) return ARCH;
    try {
      var r = await fetch('data/reading-archive.json', { cache: 'no-cache' });
      ARCH = await r.json();
    } catch (e) { ARCH = { items: [] }; }
    return ARCH;
  }

  /* ---------------- 渲染 ---------------- */
  function sentenceHTML(s, si) {
    var parts = String(s.en || '').split(/([A-Za-z][A-Za-z'’-]*)/);
    var html = '';
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (!p) continue;
      if (/^[A-Za-z]/.test(p)) {
        html += '<span class="rd-w" data-s="' + si + '">' + esc(p) + '</span>';
      } else {
        html += esc(p);
      }
    }
    return html;
  }

  function cardHTML(it, i, standalone) {
    var sents = (it.sentences || []).map(function (s, si) {
      return '<span class="rd-s" data-s="' + si + '">' + sentenceHTML(s, si) + '</span> ';
    }).join('');

    var badge = it.country
      ? ('<img class="rd-flag" src="data/flags/' + esc(it.country) + '.webp" alt="">' +
         '<span class="rd-country">' + esc(it.countryName) + '</span>')
      : ('<span class="rd-topic">' + esc(it.topic || '阅读') + '</span>');

    var bg = it.country ? ('data/countries/' + esc(it.country) + '.jpg') : '';

    return '' +
      '<article class="rd-card" data-i="' + i + '" data-id="' + esc(it.id) + '">' +
        (bg ? '<div class="rd-bg" style="background-image:url(\'' + bg + '\')"></div>'
            : '<div class="rd-bg rd-bg-plain"></div>') +
        '<div class="rd-veil"></div>' +
        '<div class="rd-inner">' +
          '<div class="rd-meta">' + badge +
            '<span class="rd-dot">·</span>' +
            '<span class="rd-date">' + esc(it.date) + '</span>' +
            '<span class="rd-src">' + esc(it.source) + '</span>' +
          '</div>' +
          '<div class="rd-headrow">' +
            '<div class="rd-headmain">' +
              '<h2 class="rd-title">' + esc(it.title) + '</h2>' +
              (it.titleZh ? '<p class="rd-title-zh">' + esc(it.titleZh) + '</p>' : '') +
            '</div>' +
            '<div class="rd-headacts">' +
              (it.audio
                ? '<button class="rd-hbtn" data-act="play" data-id="' + esc(it.id) + '" title="听朗读">' +
                  '<span class="rd-play-ic"></span></button>'
                : '') +
              '<button class="rd-hbtn rd-hbtn-zh" data-act="allzh" title="翻译全文">译</button>' +
            '</div>' +
          '</div>' +
          '<div class="rd-body">' + sents + '</div>' +
          '<div class="rd-tools"><span class="rd-tip">点句子看翻译 · 点单词查释义</span></div>' +
          '<div class="rd-foot">' +
            (it.link ? '<a class="rd-link" href="' + esc(it.link) + '" target="_blank" rel="noopener">原文</a>' : '') +
            (standalone ? '<button class="rd-link" data-act="back">返回列表</button>'
                        : '<button class="rd-next" data-act="next">下一篇 ›</button>') +
          '</div>' +
        '</div>' +
        (standalone ? '' : '<div class="rd-hint">上滑看下一篇</div>') +
      '</article>';
  }

  function render() {
    var track = el('readingTrack');
    if (!track) return;
    var items = (FEED && FEED.items) || [];
    if (!items.length) {
      track.innerHTML = '<div class="rd-card"><div class="rd-empty">今天还没有内容，稍后再来看看</div></div>';
      return;
    }
    track.innerHTML = items.map(function (it, i) { return cardHTML(it, i, false); }).join('');
    renderProgress();
    setTimeout(markOverflow, 60);
  }

  function renderProgress() {
    var bar = el('readingProgress');
    if (!bar || !FEED) return;
    var n = (FEED.items || []).length;
    var html = '';
    for (var i = 0; i < n; i++) html += '<i class="' + (i <= idx ? 'on' : '') + '"></i>';
    bar.innerHTML = html;
  }



  /* 把卡片的正文滚动区拉回顶部（从标题开始看） */
  function scrollInnerTop(node) {
    try {
      var card = node && node.closest ? node.closest('.rd-card') : null;
      var inner = card ? card.querySelector('.rd-inner') : null;
      if (inner) inner.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { }
  }

  /* 全文翻译：一次展开/收起所有句子译文 */
  function toggleAllZh(card, btn) {
    var item = findItem(card);
    if (!item) return;
    var opens = card.querySelectorAll('.rd-szh');
    if (opens.length) {
      for (var i = 0; i < opens.length; i++) opens[i].remove();
      var on = card.querySelectorAll('.rd-s.is-on');
      for (var j = 0; j < on.length; j++) on[j].classList.remove('is-on');
      if (btn) { btn.textContent = '译'; btn.classList.remove('is-on'); }
      return;
    }
    var sents = card.querySelectorAll('.rd-s');
    for (var k = 0; k < sents.length; k++) {
      var si = Number(sents[k].dataset.s);
      var src = (item.sentences || [])[si] || {};
      var d = document.createElement('div');
      d.className = 'rd-szh';
      d.textContent = src.zh || '（暂无翻译）';
      sents[k].parentNode.insertBefore(d, sents[k].nextSibling);
      sents[k].classList.add('is-on');
    }
    if (btn) { btn.textContent = '译'; btn.classList.add('is-on'); }
  }

  /* 轻点识别：手机上下滑会被当成滚动，click 常常不触发 */
  function bindTap(elTarget, handler) {
    var sx = 0, sy = 0, moved = false, active = false;
    elTarget.addEventListener('pointerdown', function (e) {
      active = true; moved = false; sx = e.clientX; sy = e.clientY;
    }, { passive: true });
    elTarget.addEventListener('pointermove', function (e) {
      if (!active) return;
      if (Math.abs(e.clientX - sx) > 8 || Math.abs(e.clientY - sy) > 8) moved = true;
    }, { passive: true });
    elTarget.addEventListener('pointerup', function (e) {
      if (!active) return;
      active = false;
      if (moved) return;
      handler(e);
    });
    elTarget.addEventListener('pointercancel', function () { active = false; });
  }

  /* ---------------- 逐句翻译 ---------------- */
  function toggleSentence(sEl) {
    var card = sEl.closest('.rd-card');
    var si = Number(sEl.dataset.s);
    var item = findItem(card);
    if (!item) return;
    var next = sEl.nextElementSibling;
    if (next && next.classList && next.classList.contains('rd-szh')) {
      next.remove();
      sEl.classList.remove('is-on');
      return;
    }
    var s = (item.sentences || [])[si] || {};
    var d = document.createElement('div');
    d.className = 'rd-szh';
    d.textContent = s.zh || '（暂无翻译）';
    sEl.parentNode.insertBefore(d, sEl.nextSibling);
    sEl.classList.add('is-on');
  }

  function findItem(card) {
    var id = card && card.dataset.id;
    var list = ((FEED && FEED.items) || []).concat((ARCH && ARCH.items) || []);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }

  /* ---------------- 点词查义 ---------------- */
  function lookup(item, word) {
    var g = (item && item.glossary) || [];
    var k = word.toLowerCase().replace(/[^a-z'’-]/g, '');
    for (var i = 0; i < g.length; i++) {
      var w = String(g[i].w || '').toLowerCase().replace(/[^a-z'’-]/g, '');
      if (w === k) return g[i];
    }
    return null;
  }

  function showWordPop(word, entry) {
    var pop = el('rdWordPop');
    if (!pop) return;
    var inBook = hasWord(word);
    pop.innerHTML =
      '<div class="rdp-word">' + esc(word) + '</div>' +
      '<div class="rdp-zh">' + (entry ? esc(entry.zh) : '这个词暂未收录释义，可先收藏到生词本') + '</div>' +
      '<div class="rdp-acts">' +
        (inBook
          ? '<button class="rdp-btn is-done" disabled>已在生词本</button>'
          : '<button class="rdp-btn" data-act="collect">收藏到生词本</button>') +
        '<button class="rdp-btn rdp-ghost" data-act="close">关闭</button>' +
      '</div>';
    pop.dataset.w = word;
    pop.dataset.zh = entry ? entry.zh : '';
    pop.classList.add('is-open');
  }

  function hideWordPop() {
    var pop = el('rdWordPop');
    if (pop) pop.classList.remove('is-open');
  }

  /* ---------------- 生词本 ---------------- */
  function bookMap() {
    try {
      if (typeof state === 'object' && state) {
        state.readingWords = state.readingWords || {};
        return state.readingWords;
      }
    } catch (e) { }
    return {};
  }
  function hasWord(w) {
    var m = bookMap();
    return !!(m[String(w).toLowerCase()]);
  }
  function collectWord(w, zh) {
    var m = bookMap();
    var k = String(w).toLowerCase();
    if (m[k]) { msg('已经在生词本里了'); return; }
    m[k] = {
      w: w,
      zh: zh || '',
      at: Date.now(),
      date: (typeof dateKey === 'function') ? dateKey() : ''
    };
    try { if (typeof saveState === 'function') saveState(); } catch (e) { }
    msg('已收藏：' + w + '，可在「复习」里回顾');
  }

  /* ---------------- 音频 ---------------- */
  var audioEl = null;
  var unlocked = false;

  function getAudio() {
    if (!audioEl) audioEl = el('rdAudio');
    return audioEl;
  }

  /* 首次交互解锁音频：用 AudioContext.resume()，不去播放空音频（会触发 error 打断真正播放） */
  var unlockCtx = null;
  function unlockAudio() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!unlockCtx) unlockCtx = new AC();
      if (unlockCtx.state === 'suspended') unlockCtx.resume();
    } catch (e) { }
  }

  function setBtnsPlaying(id, on) {
    var btns = document.querySelectorAll('[data-act="play"]');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].dataset.id === id) {
        if (on) btns[i].classList.add('is-playing');
        else btns[i].classList.remove('is-playing');
        btns[i].classList.remove('is-loading');
      }
    }
  }

  function stopAudio() {
    var a = getAudio();
    if (a) { try { a.pause(); } catch (e) { } }
    playingId = null;
    var bs = document.querySelectorAll('[data-act="play"]');
    for (var i = 0; i < bs.length; i++) {
      bs[i].classList.remove('is-playing');
      bs[i].classList.remove('is-loading');
    }
  }


  /* 兜底：mp3 迟迟不缓冲就改用系统语音朗读 */
  function ttsFallback(item) {
    try {
      if (!('speechSynthesis' in window)) { msg('音频加载失败'); return; }
      var text = ((item.sentences || []).map(function (x) { return x.en; }).join(' ')) || item.title || '';
      if (!text) { msg('没有可朗读的内容'); return; }
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 0.95;
      u.onend = function () { playingId = null; setBtnsPlaying(item.id, false); };
      u.onerror = function () { playingId = null; setBtnsPlaying(item.id, false); };
      speechSynthesis.speak(u);
      msg('已改用系统朗读');
    } catch (e) { msg('朗读失败'); }
  }

  function togglePlay(id, btn, itemList) {
    var list = itemList || ((FEED && FEED.items) || []);
    var item = list.filter(function (x) { return x.id === id; })[0];
    if (!item || !item.audio) { msg('这篇没有音频'); return; }
    var a = getAudio();
    if (!a) { msg('这台设备不支持播放'); return; }

    /* 已经在放同一篇 → 暂停 */
    if (!a.paused && playingId === id) {
      a.pause();
      playingId = null;
      setBtnsPlaying(id, false);
      return;
    }

    playingId = id;
    if (btn) btn.classList.add('is-loading');

    try { a.volume = 1; a.muted = false; } catch (e) { }
    if (a.dataset.src !== item.audio) {
      a.dataset.src = item.audio;
      a.src = item.audio;
      try { a.load(); } catch (e) { }
    }

    var p = a.play();
    /* 只有「确实无法播放」才降级；慢网继续等，不能把正常播放掐掉 */
    clearTimeout(window.__rdAudioGuard);
    window.__rdAudioGuard = setTimeout(function () {
      if (playingId !== id) return;
      var broken = (a.error && a.error.code) || a.networkState === 3; /* 3 = NO_SOURCE */
      if (broken) {
        try { a.pause(); } catch (e) { }
        playingId = null;
        setBtnsPlaying(id, false);
        ttsFallback(item);
      }
    }, 8000);

    if (p && p.then) {
      p.then(function () {
        setBtnsPlaying(id, true);
      }).catch(function (err) {
        playingId = null;
        setBtnsPlaying(id, false);
        var n = err && err.name ? err.name : '';
        if (n === 'NotAllowedError') msg('请再点一次播放');
        else if (n === 'NotSupportedError') msg('音频格式不支持');
        else msg('播放失败：' + (n || '未知错误'));
      });
    }
  }


  /* 预加载第一篇的音频，点播放时能立刻出声 */
  function preloadFirst() {
    try {
      var first = ((FEED && FEED.items) || [])[0];
      if (!first || !first.audio) return;
      var a = getAudio();
      if (!a) return;
      if (a.dataset.src !== first.audio) {
        a.dataset.src = first.audio;
        a.src = first.audio;
        a.preload = 'auto';
        try { a.load(); } catch (e) { }
      }
    } catch (e) { }
  }

  function bindAudioEvents() {
    var a = getAudio();
    if (!a || a.dataset.bound) return;
    a.dataset.bound = '1';
    a.addEventListener('ended', function () {
      var id = playingId;
      playingId = null;
      if (id) setBtnsPlaying(id, false);
    });
    a.addEventListener('error', function () {
      var id = playingId;
      playingId = null;
      if (id) setBtnsPlaying(id, false);
      var c = a.error ? a.error.code : 0;
      msg(c === 4 ? '音频打不开，可能文件异常' : '音频加载失败');
    });
    a.addEventListener('waiting', function () {
      if (playingId) {
        var bs = document.querySelectorAll('[data-act="play"]');
        for (var i = 0; i < bs.length; i++) if (bs[i].dataset.id === playingId) bs[i].classList.add('is-loading');
      }
    });
    a.addEventListener('playing', function () {
      var bs = document.querySelectorAll('[data-act="play"]');
      for (var i = 0; i < bs.length; i++) bs[i].classList.remove('is-loading');
    });
  }


  /* ---------------- 音频自检（用户设备上实测） ---------------- */
  async function runAudioCheck() {
    var box = el('rdAudioOut');
    if (!box) return;
    var lines = [];
    function log(t) { lines.push(t); box.textContent = lines.join('\n'); }

    box.textContent = '检测中…';
    lines = [];

    /* 0) 测试音：判断这台设备能不能出声 */
    try {
      var ta = el('rdAudio') || new Audio();
      ta.src = 'data/reading/audio/tone.wav';
      ta.muted = false;
      ta.volume = 1;
      var toneP = ta.play();
      var toneRes = await Promise.race([
        (toneP && toneP.then ? toneP.then(function () { return 'ok'; })
                             : Promise.resolve('ok')),
        new Promise(function (res) { setTimeout(function () { res('timeout'); }, 2500); })
      ]);
      log('0) 测试音: ' + toneRes + ' · readyState=' + ta.readyState +
          ' · 播放到=' + ta.currentTime.toFixed(2) + 's');
      setTimeout(function () { try { ta.pause(); } catch (e) { } }, 1200);
    } catch (e) {
      log('0) 测试音异常: ' + e.message);
    }

    /* 1) 网络 */
    var url = '';
    try {
      await loadFeed();
      url = (((FEED && FEED.items) || [])[0] || {}).audio || '';
    } catch (e) { }
    log('1) 音频地址: ' + (url || '(无)'));
    if (!url) { log('   没有可测的音频'); return; }

    var buf = null;
    try {
      var r = await fetch(url, { cache: 'no-store' });
      buf = await r.arrayBuffer();
      log('2) 下载: HTTP ' + r.status + ' · ' + (r.headers.get('content-type') || '?') +
          ' · ' + Math.round(buf.byteLength / 1024) + 'KB');
    } catch (e) {
      log('2) 下载失败: ' + e.message);
      return;
    }

    /* 2) 解码（带 5 秒超时，避免无音频设备时卡死） */
    log('3) 解码中…');
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) {
        log('3) 解码: 浏览器不支持 AudioContext');
      } else {
        var ctx = new AC();
        var decoded = await Promise.race([
          ctx.decodeAudioData(buf.slice(0)).then(function (ab) { return ab; }),
          new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })
        ]);
        if (decoded) {
          log('3) 解码: 成功 · 时长 ' + decoded.duration.toFixed(1) + 's · ' + decoded.sampleRate + 'Hz');
        } else {
          log('3) 解码: 超时或无音频设备（不影响 <audio> 播放尝试）');
        }
        ctx.close && ctx.close();
      }
    } catch (e) {
      log('3) 解码失败: ' + (e && e.message ? e.message : e));
    }

    /* 3) 用 <audio> 播 1 秒 */
    try {
      var a = el('rdAudio') || new Audio();
      a.src = url;
      a.muted = false;
      a.volume = 1;
      var played = false;
      var p = await Promise.race([
        a.play().then(function () { played = true; return 'ok'; }).catch(function (e) { return 'err:' + e.name; }),
        new Promise(function (res) { setTimeout(function () { res('timeout'); }, 3000); })
      ]);
      log('4) 播放: ' + (played ? '已开始' : p) + ' · readyState=' + a.readyState +
          ' · 当前时间=' + a.currentTime.toFixed(2) + 's' +
          ' · error=' + (a.error ? a.error.code : 0));
      try { a.pause(); } catch (e) { }
    } catch (e) {
      log('4) 播放异常: ' + e.message);
    }

    /* 4) 系统朗读 */
    try {
      log('5) 系统朗读: ' + ('speechSynthesis' in window
        ? ('可用 · 语音数 ' + (speechSynthesis.getVoices() || []).length)
        : '不可用'));
    } catch (e) { log('5) 系统朗读异常'); }

    log('— 把以上内容截图发给开发 —');
  }

  /* ---------------- 事件 ---------------- */
  function handleTap(e, scope) {
    var act = e.target.closest('[data-act]');
    if (act) {
      var a = act.dataset.act;
      if (a === 'play') {
        togglePlay(act.dataset.id, act, scope === 'archive' ? ((ARCH && ARCH.items) || []) : null);
        scrollInnerTop(act);
        return;
      }
      if (a === 'back') { closeArticle(); return; }
      if (a === 'next') { nextCard(); return; }
      if (a === 'allzh') {
        toggleAllZh(act.closest('.rd-card'), act);
        scrollInnerTop(act);
        return;
      }
      return;
    }
    var w = e.target.closest('.rd-w');
    if (w) {
      var card = w.closest('.rd-card');
      showWordPop(w.textContent, lookup(findItem(card), w.textContent));
      return;
    }
    var sen = e.target.closest('.rd-s');
    if (sen) { toggleSentence(sen); return; }
  }

  function bindTrack(track) {
    if (track.dataset.bound) return;
    track.dataset.bound = '1';

    bindAudioEvents();
    track.addEventListener('pointerdown', unlockAudio, { passive: true });
    bindTap(track, function (e) { handleTap(e, 'feed'); });

    track.addEventListener('click', function (e) {
      /* 交给 bindTap 统一处理，这里只兜底键盘/辅助点击 */
      if (e.detail === 0) handleTap(e, 'feed');
    });

    var raf = null;
    track.addEventListener('scroll', function () {
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        var h = track.clientHeight || 1;
        var i = Math.round(track.scrollTop / h);
        if (i !== idx) { idx = i; renderProgress(); stopAudio(); }
      });
    }, { passive: true });
  }


  /* 下一篇：滚到下一张卡片 */
  function nextCard() {
    var track = el('readingTrack');
    if (!track) return;
    var total = ((FEED && FEED.items) || []).length;
    if (idx >= total - 1) { msg('已经是最后一篇了'); return; }
    var h = track.clientHeight || 1;
    track.scrollTo({ top: (idx + 1) * h, behavior: 'smooth' });
  }

  /* 内容超高时隐藏底部提示，避免压字 */
  function markOverflow() {
    var cards = document.querySelectorAll('.rd-card');
    for (var i = 0; i < cards.length; i++) {
      var inner = cards[i].querySelector('.rd-inner');
      var hint = cards[i].querySelector('.rd-hint');
      if (!inner || !hint) continue;
      if (inner.scrollHeight > inner.clientHeight + 8) hint.style.display = 'none';
      else hint.style.display = '';
    }
  }

  /* ---------------- 打开 / 关闭 ---------------- */
  async function open() {
    var panel = el('readingFeed');
    if (!panel) return;
    /* 先盖住整屏，再加载数据，避免露出下面的学习页造成闪跳 */
    panel.classList.add('is-open');
    document.documentElement.classList.add('overlay-open');
    await loadFeed();
    render();
    var track = el('readingTrack');
    if (track) { bindTrack(track); bindAudioEvents(); track.scrollTop = 0; }
    preloadFirst();
    idx = 0;
    renderProgress();
  }

  function close() {
    var panel = el('readingFeed');
    if (panel) panel.classList.remove('is-open');
    document.documentElement.classList.remove('overlay-open');
    hideWordPop();
    stopAudio();
    /* 关掉阅读后回首页，而不是停在已经没用的学习页 */
    try { if (typeof go === 'function') go('home'); } catch (e) { }
  }

  /* ---------------- 文章汇总 ---------------- */
  async function openArchive() {
    await loadArchive();
    var panel = el('readingArchive');
    if (!panel) return;
    var items = ((ARCH && ARCH.items) || []).filter(function (x) {
      return (x.sentences || []).length >= 4;
    });
    var byDate = {};
    items.forEach(function (it) {
      (byDate[it.date] = byDate[it.date] || []).push(it);
    });
    var dates = Object.keys(byDate).sort().reverse();

    var html = dates.map(function (d) {
      var rows = byDate[d].map(function (it) {
        var tag = it.countryName
          ? '<span class="ra-tag">' + esc(it.countryName) + '</span>'
          : '<span class="ra-tag ra-topic">' + esc(it.topic || '阅读') + '</span>';
        return '<button class="ra-row" data-id="' + esc(it.id) + '">' +
          tag +
          '<span class="ra-main"><b>' + esc(it.titleZh || it.title) + '</b>' +
          '<em>' + esc(it.title) + '</em></span>' +
          '<span class="ra-go">' + (it.words || 0) + '词</span>' +
          '</button>';
      }).join('');
      return '<div class="ra-day"><div class="ra-date">' + esc(d) + '</div>' + rows + '</div>';
    }).join('') || '<div class="ra-empty">还没有历史文章</div>';

    el('raList').innerHTML = html;
    panel.classList.add('is-open');
    document.documentElement.classList.add('overlay-open');

    var list = el('raList');
    if (!list.dataset.bound) {
      list.dataset.bound = '1';
      list.addEventListener('click', function (e) {
        var row = e.target.closest('.ra-row');
        if (row) openArticle(row.dataset.id);
      });
    }
  }

  function closeArchive() {
    var p = el('readingArchive');
    if (p) p.classList.remove('is-open');
    document.documentElement.classList.remove('overlay-open');
  }


  /* ---------------- 书架页：往期文章横向卡 ---------------- */
  async function renderStrip() {
    var box = el('bsArchiveStrip');
    if (!box) return;
    await loadArchive();
    var all = (ARCH && ARCH.items) || [];
    /* 只显示新版长文（旧的短摘要不进列表） */
    var items = all.filter(function (x) { return (x.sentences || []).length >= 4; });
    var cnt = el('bsArchCount');
    if (cnt) cnt.textContent = items.length ? (items.length + ' 篇 · 每日更新') : '';
    if (!items.length) {
      box.innerHTML = '<div class="bs-empty">还没有往期文章</div>';
      return;
    }
    var recent = items.slice(0, 8);
    box.innerHTML = recent.map(function (it) {
      var chip = it.countryName
        ? '<span class="bs-chip">' + esc(it.countryName) + '</span>'
        : '<span class="bs-chip is-topic">' + esc(it.topic || '阅读') + '</span>';
      return '<button class="bs-card" data-id="' + esc(it.id) + '">' +
          '<span class="bs-card-top">' + chip +
            '<span class="bs-date">' + esc((it.date || '').slice(5)) + '</span></span>' +
          '<span class="bs-card-zh">' + esc(it.titleZh || it.title) + '</span>' +
          '<span class="bs-card-en">' + esc(it.title) + '</span>' +
          '<span class="bs-card-foot"><span>' + (it.words || 0) + ' 词</span>' +
            '<span class="bs-card-more">阅读 ›</span></span>' +
        '</button>';
    }).join('') +
      '<button class="bs-all" data-all="1"><span>查看全部</span><span>' + items.length + ' 篇 ›</span></button>';

    if (!box.dataset.bound) {
      box.dataset.bound = '1';
      box.addEventListener('click', function (e) {
        var all = e.target.closest('[data-all]');
        if (all) { openArchive(); return; }
        var card = e.target.closest('.bs-card');
        if (card) openArticle(card.dataset.id);
      });
    }
  }

  /* ---------------- 单篇阅读 ---------------- */
  async function openArticle(id) {
    await loadArchive();
    var item = ((ARCH && ARCH.items) || []).filter(function (x) { return x.id === id; })[0];
    if (!item) { msg('找不到这篇文章'); return; }
    var panel = el('readingArticle');
    if (!panel) return;
    el('raArticleBody').innerHTML = cardHTML(item, 0, true);
    panel.classList.add('is-open');

    var body = el('raArticleBody');
    if (!body.dataset.bound) {
      body.dataset.bound = '1';
      bindTap(body, function (e) { handleTap(e, 'archive'); });
      body.addEventListener('click', function (e) {
        if (e.detail !== 0) return;
        var act = e.target.closest('[data-act]');
        if (act) {
          if (act.dataset.act === 'back') { closeArticle(); return; }
          if (act.dataset.act === 'play') { togglePlay(act.dataset.id, act, (ARCH && ARCH.items) || []); return; }
          return;
        }
        var w = e.target.closest('.rd-w');
        if (w) {
          var card = w.closest('.rd-card');
          showWordPop(w.textContent, lookup(findItem(card), w.textContent));
          return;
        }
        var s = e.target.closest('.rd-s');
        if (s) toggleSentence(s);
      });
    }
  }

  function closeArticle() {
    var p = el('readingArticle');
    if (p) p.classList.remove('is-open');
    hideWordPop();
    stopAudio();
  }

  /* ---------------- 绑定 ---------------- */
  function bindUI() {
    var on = function (id, fn, ev) {
      var b = el(id);
      if (b && !b.dataset.b) { b.dataset.b = '1'; b.addEventListener(ev || 'click', fn); }
    };
    on('btnReading', open);
    on('readingClose', close);
    on('readingArchiveBtn', openArchive);
    on('btnArchive', openArchive);
    on('raClose', closeArchive);
    on('raArticleClose', closeArticle);
    on('rdPopCloseWrap', function (e) { if (e.target.id === 'rdWordPop') hideWordPop(); });

    var pop = el('rdWordPop');
    if (pop && !pop.dataset.b) {
      pop.dataset.b = '1';
      pop.addEventListener('click', function (e) {
        var act = e.target.closest('[data-act]');
        if (!act) return;
        if (act.dataset.act === 'close') { hideWordPop(); return; }
        if (act.dataset.act === 'collect') {
          collectWord(pop.dataset.w, pop.dataset.zh);
          hideWordPop();
        }
      });
    }

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (el('rdWordPop') && el('rdWordPop').classList.contains('is-open')) { hideWordPop(); return; }
      if (el('readingArticle') && el('readingArticle').classList.contains('is-open')) { closeArticle(); return; }
      if (el('readingArchive') && el('readingArchive').classList.contains('is-open')) { closeArchive(); return; }
      if (el('readingFeed') && el('readingFeed').classList.contains('is-open')) close();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindUI);
  else bindUI();


  /* 调试：自动点第一个单词，检查弹层 */
  if (new URLSearchParams(location.search).get('dbgword') === '1') {
    setTimeout(function () {
      try {
        var w = document.querySelector('.rd-w');
        if (!w) { document.title = 'NO-WORD'; return; }
        var r = w.getBoundingClientRect();
        var opt = { bubbles: true, clientX: r.left + 4, clientY: r.top + 4 };
        w.dispatchEvent(new PointerEvent('pointerdown', opt));
        w.dispatchEvent(new PointerEvent('pointerup', opt));
        var pop = document.getElementById('rdWordPop');
        document.title = 'word=' + w.textContent +
          ' pop=' + (pop ? (pop.classList.contains('is-open') ? 'open' : 'closed') : 'null') +
          ' html=' + (pop ? pop.innerHTML.slice(0, 40) : '');
      } catch (e) { document.title = 'ERR:' + e.message; }
    }, 2400);
  }


  if (new URLSearchParams(location.search).get('dbgallzh') === '1') {
    setTimeout(function () {
      try {
        var b = document.querySelector('.rd-hbtn-zh') || document.querySelector('.rd-allbtn');
        if (!b) { document.title = 'NO-BTN'; return; }
        var r = b.getBoundingClientRect();
        var opt = { bubbles: true, clientX: r.left + 4, clientY: r.top + 4 };
        b.dispatchEvent(new PointerEvent('pointerdown', opt));
        b.dispatchEvent(new PointerEvent('pointerup', opt));
        setTimeout(function () {
          var n = document.querySelectorAll('.rd-card .rd-szh').length;
          var first = document.querySelector('.rd-szh');
          var btn = document.querySelector('.rd-hbtn-zh');
          document.title = 'zh=' + n + ' btnOn=' + (btn ? btn.classList.contains('is-on') : '?') + ' first=' + (first ? first.textContent.slice(0, 18) : 'none');
        }, 400);
      } catch (e) { document.title = 'ERR:' + e.message; }
    }, 2400);
  }


  if (new URLSearchParams(location.search).get('dbgscroll') === '1') {
    setTimeout(function () {
      try {
        var t = document.getElementById('readingTrack');
        var c = document.querySelector('.rd-card');
        var inner = c ? c.querySelector('.rd-inner') : null;
        var cs = getComputedStyle(t);
        document.title = 'trackPos=' + cs.position +
          ' clientH=' + t.clientHeight + ' scrollH=' + t.scrollHeight +
          ' canScroll=' + (t.scrollHeight > t.clientHeight + 4) +
          ' innerScroll=' + (inner ? inner.scrollHeight + '/' + inner.clientHeight : '?') +
          ' cardH=' + (c ? c.getBoundingClientRect().height : '?');
      } catch (e) { document.title = 'ERR:' + e.message; }
    }, 2200);
  }


  if (new URLSearchParams(location.search).get('dbgaudio') === '1') {
    setTimeout(function () {
      try {
        var a = new Audio();
        a.preload = 'auto';
        a.src = 'data/reading/audio/20261026-1.mp3';
        var done = false;
        a.addEventListener('loadedmetadata', function () {
          if (done) return; done = true;
          document.title = 'OK dur=' + a.duration.toFixed(1) + 's rs=' + a.readyState;
        });
        a.addEventListener('error', function () {
          if (done) return; done = true;
          document.title = 'ERR code=' + (a.error ? a.error.code : '?') +
            ' msg=' + (a.error ? a.error.message : '');
        });
        setTimeout(function () { if (!done) { done = true; document.title = 'TIMEOUT rs=' + a.readyState; } }, 5000);
      } catch (e) { document.title = 'EX:' + e.message; }
    }, 2000);
  }


  if (new URLSearchParams(location.search).get('dbgdecode') === '1') {
    setTimeout(function () {
      fetch('data/reading/audio/20261026-1.mp3').then(function (r) {
        return r.arrayBuffer();
      }).then(function (buf) {
        var AC = window.AudioContext || window.webkitAudioContext;
        var ctx = new AC();
        return ctx.decodeAudioData(buf).then(function (ab) {
          document.title = 'DECODED bytes=' + buf.byteLength + ' dur=' + ab.duration.toFixed(1) + 's';
        });
      }).catch(function (e) {
        document.title = 'FAIL ' + (e && e.message ? e.message : e);
      });
    }, 2000);
  }


  if (new URLSearchParams(location.search).get('dbgplay') === '1') {
    setTimeout(function () {
      try {
        var b = document.querySelector('[data-act="play"]');
        if (!b) { document.title = 'NO-BTN'; return; }
        var a = document.getElementById('rdAudio');
        var r = b.getBoundingClientRect();
        var opt = { bubbles: true, clientX: r.left + 4, clientY: r.top + 4 };
        b.dispatchEvent(new PointerEvent('pointerdown', opt));
        b.dispatchEvent(new PointerEvent('pointerup', opt));
        setTimeout(function () {
          document.title = 'src=' + (a.src || '').split('/').pop() +
            ' paused=' + a.paused + ' rs=' + a.readyState +
            ' net=' + (a.networkState) +
            ' err=' + (a.error ? a.error.code : 0) +
            ' btnPlaying=' + b.classList.contains('is-playing');
        }, 1500);
      } catch (e) { document.title = 'ERR:' + e.message; }
    }, 2400);
  }


  if (new URLSearchParams(location.search).get('dbgdiag') === '1') {
    setTimeout(function () { runAudioCheck(); }, 2000);
  }

  window.XYReading = {
    prefetch: loadFeed,
    renderStrip: renderStrip,
    audioCheck: runAudioCheck,
    isReady: function () { return !!el('readingTrack'); },
    open: open,
    close: close,
    openArchive: openArchive,
    isOpen: function () {
      var p = el('readingFeed');
      return !!(p && p.classList.contains('is-open'));
    }
  };
})();
