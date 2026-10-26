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
      if (btn) btn.textContent = '翻译全文';
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
    if (btn) btn.textContent = '收起翻译';
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
  function stopAudio() {
    if (audio) { try { audio.pause(); } catch (e) { } }
    playingId = null;
    var bs = document.querySelectorAll('.rd-play');
    for (var i = 0; i < bs.length; i++) bs[i].classList.remove('is-playing');
  }
  function togglePlay(id, btn, itemList) {
    var list = itemList || ((FEED && FEED.items) || []);
    var item = list.filter(function (x) { return x.id === id; })[0];
    if (!item || !item.audio) { msg('这篇没有音频'); return; }
    if (playingId === id) { stopAudio(); return; }
    stopAudio();
    if (!audio) audio = new Audio();
    audio.src = item.audio;
    audio.onended = stopAudio;
    audio.onerror = function () { msg('音频加载失败'); stopAudio(); };
    var p = audio.play();
    playingId = id;
    if (btn) btn.classList.add('is-playing');
    if (p && p.catch) p.catch(function () { msg('这台设备放不出声音'); stopAudio(); });
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
    if (track) { bindTrack(track); track.scrollTop = 0; }
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
    var items = (ARCH && ARCH.items) || [];
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
        var b = document.querySelector('.rd-allbtn');
        if (!b) { document.title = 'NO-BTN'; return; }
        var r = b.getBoundingClientRect();
        var opt = { bubbles: true, clientX: r.left + 4, clientY: r.top + 4 };
        b.dispatchEvent(new PointerEvent('pointerdown', opt));
        b.dispatchEvent(new PointerEvent('pointerup', opt));
        setTimeout(function () {
          var n = document.querySelectorAll('.rd-card .rd-szh').length;
          var first = document.querySelector('.rd-szh');
          document.title = 'zh=' + n + ' first=' + (first ? first.textContent.slice(0, 24) : 'none');
        }, 400);
      } catch (e) { document.title = 'ERR:' + e.message; }
    }, 2400);
  }

  window.XYReading = {
    prefetch: loadFeed,
    open: open,
    close: close,
    openArchive: openArchive,
    isOpen: function () {
      var p = el('readingFeed');
      return !!(p && p.classList.contains('is-open'));
    }
  };
})();
