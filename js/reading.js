/* ==========================================================================
   每日阅读 —— 竖屏上滑翻页（参考短视频形态）
   数据：data/reading.json，音频：预生成 mp3
   ========================================================================== */
(function () {
  'use strict';

  var FEED = null;          // 数据
  var idx = 0;              // 当前卡片
  var audio = null;         // 复用一个 Audio
  var playingId = null;

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function toastMsg(msg) {
    try { if (typeof toast === 'function') toast(msg, 2000); } catch (e) { }
  }

  /* ---------------- 打开 / 关闭 ---------------- */
  async function open() {
    var panel = el('readingFeed');
    if (!panel) return;
    panel.classList.add('is-open');
    document.documentElement.classList.add('overlay-open');

    if (!FEED) {
      try {
        var res = await fetch('data/reading.json', { cache: 'no-cache' });
        FEED = await res.json();
      } catch (e) {
        FEED = { items: [] };
        console.warn('阅读数据加载失败', e);
      }
      render();
    }
    idx = 0;
    goTo(0, false);
  }

  function close() {
    var panel = el('readingFeed');
    if (panel) panel.classList.remove('is-open');
    document.documentElement.classList.remove('overlay-open');
    stopAudio();
  }

  /* ---------------- 渲染 ---------------- */
  function render() {
    var track = el('readingTrack');
    if (!track) return;
    var items = (FEED && FEED.items) || [];
    if (!items.length) {
      track.innerHTML = '<div class="rd-card"><div class="rd-empty">暂时没有阅读内容，明天再来看看</div></div>';
      return;
    }
    track.innerHTML = items.map(function (it, i) {
      var flag = it.country ? ('data/flags/' + it.country + '.webp') : '';
      var words = (it.words || []).map(function (w) {
        return '<button class="rd-word" data-w="' + esc(w.w) + '" data-zh="' + esc(w.zh) + '">' +
          esc(w.w) + '<i>' + esc(w.zh) + '</i></button>';
      }).join('');
      return '' +
        '<article class="rd-card" data-i="' + i + '">' +
          '<div class="rd-bg" style="background-image:url(\'data/countries/' + esc(it.country) + '.jpg\')"></div>' +
          '<div class="rd-veil"></div>' +
          '<div class="rd-inner">' +
            '<div class="rd-meta">' +
              (flag ? '<img class="rd-flag" src="' + flag + '" alt="">' : '') +
              '<span class="rd-country">' + esc(it.countryName) + '</span>' +
              '<span class="rd-dot">·</span>' +
              '<span class="rd-date">' + esc(it.date) + '</span>' +
              '<span class="rd-src">' + esc(it.source) + '</span>' +
            '</div>' +
            '<h2 class="rd-title">' + esc(it.title) + '</h2>' +
            '<p class="rd-title-zh">' + esc(it.titleZh) + '</p>' +
            '<div class="rd-body">' + esc(it.body) + '</div>' +
            '<button class="rd-trans-toggle" data-act="toggle">看中文翻译</button>' +
            '<div class="rd-body-zh" hidden>' + esc(it.bodyZh) + '</div>' +
            (words ? '<div class="rd-words"><div class="rd-words-t">生词 · 点一下加入复习</div>' + words + '</div>' : '') +
            '<div class="rd-foot">' +
              (it.audio
                ? '<button class="rd-play" data-act="play" data-id="' + esc(it.id) + '"><span class="rd-play-ic"></span><b>听朗读</b></button>'
                : '<button class="rd-play" data-act="tts" data-id="' + esc(it.id) + '"><span class="rd-play-ic"></span><b>朗读</b></button>') +
              (it.link ? '<a class="rd-link" href="' + esc(it.link) + '" target="_blank" rel="noopener">原文</a>' : '') +
            '</div>' +
          '</div>' +
          '<div class="rd-hint">上滑看下一条</div>' +
        '</article>';
    }).join('');

    bind(track);
    renderProgress();
  }

  function renderProgress() {
    var bar = el('readingProgress');
    if (!bar || !FEED) return;
    bar.innerHTML = FEED.items.map(function (_, i) {
      return '<i class="' + (i <= idx ? 'on' : '') + '"></i>';
    }).join('');
  }

  /* ---------------- 交互 ---------------- */
  function bind(track) {
    track.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]');
      if (t) {
        var act = t.dataset.act;
        if (act === 'toggle') {
          var zh = t.parentElement.querySelector('.rd-body-zh');
          if (zh) {
            var hidden = zh.hasAttribute('hidden');
            if (hidden) zh.removeAttribute('hidden'); else zh.setAttribute('hidden', '');
            t.textContent = hidden ? '收起翻译' : '看中文翻译';
          }
          return;
        }
        if (act === 'play') { togglePlay(t.dataset.id, t); return; }
        if (act === 'tts') { speakFallback(t); return; }
        return;
      }

      var w = e.target.closest('.rd-word');
      if (w) { addWord(w.dataset.w, w.dataset.zh, w); return; }
    });

    // 滚动时更新进度
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

  function goTo(i, smooth) {
    var track = el('readingTrack');
    if (!track) return;
    var h = track.clientHeight || 1;
    track.scrollTo({ top: i * h, behavior: smooth === false ? 'auto' : 'smooth' });
    idx = i;
    renderProgress();
  }

  /* ---------------- 音频 ---------------- */
  function stopAudio() {
    if (audio) { try { audio.pause(); } catch (e) { } }
    playingId = null;
    var btns = document.querySelectorAll('.rd-play');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('is-playing');
  }

  function togglePlay(id, btn) {
    var item = (FEED.items || []).filter(function (x) { return x.id === id; })[0];
    if (!item || !item.audio) return;
    if (playingId === id) { stopAudio(); return; }
    stopAudio();
    if (!audio) audio = new Audio();
    audio.src = item.audio;
    audio.onended = function () { stopAudio(); };
    audio.onerror = function () { toastMsg('音频加载失败'); stopAudio(); };
    var p = audio.play();
    playingId = id;
    if (btn) btn.classList.add('is-playing');
    if (p && p.catch) p.catch(function () { toastMsg('这台设备放不出声音'); stopAudio(); });
  }

  function speakFallback(btn) {
    try {
      if (!('speechSynthesis' in window)) { toastMsg('这台设备不支持朗读'); return; }
      var card = btn.closest('.rd-card');
      var text = card ? (card.querySelector('.rd-title').textContent + '. ' + card.querySelector('.rd-body').textContent) : '';
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = 0.92;
      speechSynthesis.speak(u);
    } catch (e) { toastMsg('朗读失败'); }
  }

  /* ---------------- 生词加入复习 ---------------- */
  function addWord(w, zh, btn) {
    try {
      var p = (typeof progressOf === 'function') ? progressOf() : null;
      if (!p) { toastMsg('暂时无法保存'); return; }
      var k = (typeof wordKey === 'function') ? wordKey(w) : String(w).toLowerCase();
      if (p[k]) { toastMsg('「' + w + '」已经在词库里了'); if (btn) btn.classList.add('is-added'); return; }
      p[k] = {
        b: 0,
        d: (typeof dateKey === 'function') ? dateKey() : '',
        r: 0, w: 0,
        last: '',
        dt: (typeof dateKey === 'function') ? dateKey() : '',
        src: 'reading',
        zh: zh || ''
      };
      if (typeof saveState === 'function') saveState();
      if (btn) btn.classList.add('is-added');
      toastMsg('已加入复习：' + w);
    } catch (e) { toastMsg('加入失败'); }
  }

  /* ---------------- 绑定入口 ---------------- */
  function bindEntry() {
    var openers = ['btnReading', 'readingEntry'];
    openers.forEach(function (id) {
      var b = el(id);
      if (b && !b.dataset.bound) { b.dataset.bound = '1'; b.addEventListener('click', open); }
    });
    var c = el('readingClose');
    if (c && !c.dataset.bound) { c.dataset.bound = '1'; c.addEventListener('click', close); }
    // ESC 关闭
    document.addEventListener('keydown', function (e) {
      var panel = el('readingFeed');
      if (e.key === 'Escape' && panel && panel.classList.contains('is-open')) close();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindEntry);
  else bindEntry();


  /* 调试：自动打开阅读 */
  if (new URLSearchParams(location.search).get('dbgread') === '1') {
    setTimeout(function () { open(); }, 1800);
  }

  window.XYReading = { open: open, close: close };
})();
