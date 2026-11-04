/* ==========================================================================
   发音实验室：弱音档案 / 最小对立组 / 错词重练 / 进步曲线 / 节奏条
   依赖 window.XYISE（评测）与 localStorage
   ========================================================================== */
(function () {
  'use strict';

  var PROFILE_KEY = 'ise.phonemes.v1';
  var HISTORY_KEY = 'ise.history.v1';
  var MISTAKE_KEY = 'ise.mistakes.v1';

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function loadJSON(key, dflt) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || dflt; }
    catch (e) { return dflt; }
  }
  function saveJSON(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { }
  }

  /* ---------------- 数据 ---------------- */
  function loadProfile() { return loadJSON(PROFILE_KEY, {}); }
  function loadHistory() { return loadJSON(HISTORY_KEY, []); }
  function loadMistakes() { return loadJSON(MISTAKE_KEY, {}); }

  /** 每次评测后调用：累计弱音 + 历史分数 */
  function note(r, sent) {
    if (!r || !window.XYISE) return;
    var words = r.words || [];

    var prof = loadProfile();
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w.dp === 16) continue;                 /* 漏读没有音素数据，别污染档案 */
      var bad = w.dp === 128 || (w.dp === 0 && w.score > 0 && w.score < 60);
      if (!bad) continue;
      var info = window.XYISE.wordInfo(w);
      var sym = info && info.sym;
      if (!sym) continue;
      var rec = prof[sym] || (prof[sym] = { count: 0, words: {} });
      rec.count += 1;
      var k = String(w.word || '').toLowerCase();
      if (k) rec.words[k] = (rec.words[k] || 0) + 1;
    }
    saveJSON(PROFILE_KEY, prof);

    var h = loadHistory();
    h.push({
      ts: Date.now(),
      total: Math.round(r.total || 0),
      accuracy: Math.round(r.accuracy || 0),
      fluency: Math.round(r.fluency || 0),
      integrity: Math.round(r.integrity || 0)
    });
    if (h.length > 300) h = h.slice(h.length - 300);
    saveJSON(HISTORY_KEY, h);
  }

  /* ---------------- 弹层 ---------------- */
  var sheet = null;
  function close() {
    if (sheet && sheet.parentNode) sheet.parentNode.removeChild(sheet);
    sheet = null;
  }
  function open(html) {
    close();
    sheet = document.createElement('div');
    sheet.className = 'sh-sheet';
    sheet.innerHTML = '<div class="sh-sheet-card" role="dialog" aria-modal="true">' +
      '<button class="sh-sheet-x" type="button" aria-label="关闭">×</button>' + html + '</div>';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet || (e.target.classList && e.target.classList.contains('sh-sheet-x'))) close();
    });
    return sheet;
  }

  /* ---------------- 单词跟读 ---------------- */
  var busy = false;

  function recordWord(word, btn, out) {
    if (!window.XYISE) return;
    if (busy) { try { window.XYISE._stop(); } catch (e) { } return; }

    busy = true;
    var oldText = btn.textContent;
    btn.textContent = '● 正在录…（点一下停）';
    out.textContent = '';
    var timer = setTimeout(function () { try { window.XYISE._stop(); } catch (e) { } }, 5000);
    btn.onclick = function () { try { window.XYISE._stop(); } catch (e) { } };

    window.XYISE.evaluate('[word]\n' + word, null, { category: 'read_word' }).then(function (r) {
      var s = Math.round(r.total || 0);
      out.textContent = s + ' 分';
      out.className = 'pl-score ' + (s >= 80 ? 'good' : (s >= 60 ? 'mid' : 'bad'));
      btn.textContent = s >= 80 ? '✓ 通过' : '再读一次';
      if (s >= 80) markFixed(word, s);
    }, function (e) {
      out.textContent = '失败：' + (e && e.message ? e.message : e);
      out.className = 'pl-score bad';
      btn.textContent = oldText;
    }).then(function () {
      clearTimeout(timer);
      busy = false;
      btn.onclick = function () { recordWord(word, btn, out); };
    });
  }

  function markFixed(word, score) {
    var m = loadMistakes();
    var k = String(word || '').toLowerCase();
    if (!m[k]) return;
    m[k].score = score;
    m[k].fixed = score >= 80;
    m[k].ts = Date.now();
    saveJSON(MISTAKE_KEY, m);
  }

  function wordCard(word, ipa, tip) {
    var div = document.createElement('div');
    div.className = 'pl-word';
    div.innerHTML =
      '<div class="pl-word-top"><b>' + esc(word) + '</b>' +
        (ipa ? '<span class="pl-ipa">' + esc(ipa) + '</span>' : '') + '</div>' +
      (tip ? '<div class="pl-tip">' + esc(tip) + '</div>' : '') +
      '<div class="pl-word-bot">' +
        '<button type="button" class="shm-btn pl-rec">● 录这个词</button>' +
        '<span class="pl-score">—</span>' +
      '</div>';
    var btn = div.querySelector('.pl-rec');
    var out = div.querySelector('.pl-score');
    btn.onclick = function () { recordWord(word, btn, out); };
    return div;
  }

  function openDrill(title, items) {
    var html = '<div class="shm-title">' + esc(title) + '</div>' +
      '<p class="shm-p">读对 80 分算通过。点一下开始录，再点一下停止；录 5 秒会自动停。</p>' +
      '<div class="pl-list"></div>';
    var sh = open(html);
    var list = sh.querySelector('.pl-list');
    items.forEach(function (it) {
      list.appendChild(wordCard(it.word, it.ipa, it.tip));
    });
  }

  /* ---------------- 弱音档案 ---------------- */
  function openSounds() {
    var prof = loadProfile();
    var keys = Object.keys(prof).filter(function (k) { return prof[k].count > 0; })
      .sort(function (a, b) { return prof[b].count - prof[a].count; });

    if (!keys.length) {
      open('<div class="shm-title">弱音档案</div>' +
        '<p class="shm-p">还没有数据。先去跟读几句，系统会自动统计你最常错的音。</p>');
      return;
    }

    var html = '<div class="shm-title">弱音档案</div>' +
      '<p class="shm-p">按出错次数排序。先练最上面的音，见效最快。</p>';

    keys.slice(0, 8).forEach(function (sym) {
      var info = window.XYISE.phonemeInfo(sym) || ['/' + sym + '/', ''];
      var words = Object.keys(prof[sym].words || {}).slice(0, 8);
      html += '<div class="pl-sound">' +
        '<div class="pl-sound-h"><b>' + esc(info[0]) + '</b>' +
          '<span>' + prof[sym].count + ' 次</span></div>' +
        (info[1] ? '<div class="pl-tip">' + esc(info[1]) + '</div>' : '') +
        '<div class="pl-chips">' + words.map(function (w) {
          return '<span class="pl-chip">' + esc(w) + '</span>';
        }).join('') + '</div>' +
        '<button type="button" class="shm-btn ghost" data-sym="' + esc(sym) + '">练这些词</button>' +
        '</div>';
    });

    var sh = open(html);
    sh.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button[data-sym]') : null;
      if (!b) return;
      var sym = b.getAttribute('data-sym');
      var info = window.XYISE.phonemeInfo(sym);
      var items = Object.keys(prof[sym].words || {}).slice(0, 8).map(function (w) {
        return { word: w, ipa: '', tip: info ? info[1] : '' };
      });
      openDrill('练 ' + (info ? info[0] : sym), items);
    });
  }

  /* ---------------- 最小对立组 ---------------- */
  var PAIRS = [
    { a: 'thin', b: 'sin', ia: '/θɪn/', ib: '/sɪn/', tip: 'th 舌尖轻放齿间送气；s 不咬舌' },
    { a: 'think', b: 'sink', ia: '/θɪŋk/', ib: '/sɪŋk/', tip: '同上，结尾 ŋk 要收住' },
    { a: 'rice', b: 'lice', ia: '/raɪs/', ib: '/laɪs/', tip: 'r 卷舌不碰上颚；l 舌尖顶上齿龈' },
    { a: 'right', b: 'light', ia: '/raɪt/', ib: '/laɪt/', tip: '同上，注意词尾 t' },
    { a: 'vest', b: 'west', ia: '/vest/', ib: '/west/', tip: 'v 上齿咬唇振动；w 圆唇不咬' },
    { a: 'vine', b: 'wine', ia: '/vaɪn/', ib: '/waɪn/', tip: '同上' },
    { a: 'ship', b: 'sheep', ia: '/ʃɪp/', ib: '/ʃiːp/', tip: 'ɪ 短促放松；iː 长而嘴角拉开' },
    { a: 'sit', b: 'seat', ia: '/sɪt/', ib: '/siːt/', tip: '同上' },
    { a: 'bad', b: 'bed', ia: '/bæd/', ib: '/bed/', tip: 'æ 嘴张大下巴低；e 半开' },
    { a: 'cat', b: 'cut', ia: '/kæt/', ib: '/kʌt/', tip: 'æ 前低元音；ʌ 中央短促' },
    { a: 'cheap', b: 'jeep', ia: '/tʃiːp/', ib: '/dʒiːp/', tip: 'tʃ 清辅音；dʒ 声带振动' },
    { a: 'fan', b: 'van', ia: '/fæn/', ib: '/væn/', tip: 'f 清；v 浊且咬唇' }
  ];

  function openPairs() {
    var html = '<div class="shm-title">最小对立组</div>' +
      '<p class="shm-p">每组两个词只差一个音。两个都读对 80 分，这一组才算过。</p>';

    PAIRS.forEach(function (p, i) {
      html += '<div class="pl-pair">' +
        '<div class="pl-pair-w"><b>' + esc(p.a) + '</b><span>' + esc(p.ia) + '</span></div>' +
        '<div class="pl-pair-vs">vs</div>' +
        '<div class="pl-pair-w"><b>' + esc(p.b) + '</b><span>' + esc(p.ib) + '</span></div>' +
        '<button type="button" class="shm-btn ghost" data-pair="' + i + '">练这组</button>' +
        '</div>';
    });

    var sh = open(html);
    sh.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button[data-pair]') : null;
      if (!b) return;
      var p = PAIRS[Number(b.getAttribute('data-pair'))];
      if (!p) return;
      openDrill(p.a + ' / ' + p.b, [
        { word: p.a, ipa: p.ia, tip: p.tip },
        { word: p.b, ipa: p.ib, tip: p.tip }
      ]);
    });
  }

  /* ---------------- 错词重练 ---------------- */
  function openMistakes() {
    var m = loadMistakes();
    var keys = Object.keys(m).filter(function (k) { return !m[k].fixed; })
      .sort(function (a, b) { return (m[b].count || 0) - (m[a].count || 0); });

    if (!keys.length) {
      open('<div class="shm-title">错词重练</div>' +
        '<p class="shm-p">还没有错词。跟读时读错或漏读的词会自动记进来。</p>');
      return;
    }

    var html = '<div class="shm-title">错词重练</div>' +
      '<p class="shm-p">这些词你错过 ' + keys.length + ' 个。读对 80 分就会从列表里消失。</p>' +
      '<button type="button" class="shm-btn" data-all="1">开始重练（最多 8 个）</button>' +
      '<div class="pl-list"></div>';

    var sh = open(html);
    var list = sh.querySelector('.pl-list');

    keys.forEach(function (k) {
      var rec = m[k];
      var div = document.createElement('div');
      div.className = 'pl-word';
      div.innerHTML =
        '<div class="pl-word-top"><b>' + esc(rec.w || k) + '</b>' +
          (rec.ipa ? '<span class="pl-ipa">' + esc(rec.ipa) + '</span>' : '') +
          '<span class="pl-count">错 ' + (rec.count || 1) + ' 次</span></div>' +
        (rec.tip ? '<div class="pl-tip">' + esc(rec.tip) + '</div>' : '') +
        '<div class="pl-word-bot">' +
          '<button type="button" class="shm-btn pl-rec">● 录这个词</button>' +
          '<span class="pl-score">' + (rec.score ? rec.score + ' 分' : '—') + '</span>' +
        '</div>';
      var btn = div.querySelector('.pl-rec');
      var out = div.querySelector('.pl-score');
      btn.onclick = function () { recordWord(rec.w || k, btn, out); };
      list.appendChild(div);
    });

    sh.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button[data-all]') : null;
      if (!b) return;
      var items = keys.slice(0, 8).map(function (k) {
        var rec = m[k];
        return { word: rec.w || k, ipa: rec.ipa || '', tip: rec.tip || '' };
      });
      openDrill('错词重练', items);
    });
  }

  /* ---------------- 进步曲线 ---------------- */
  function openProgress() {
    var h = loadHistory();
    if (!h.length) {
      open('<div class="shm-title">进步曲线</div>' +
        '<p class="shm-p">还没有记录。每读一句就会记一次总分，这里会画出趋势。</p>');
      return;
    }

    var vals = h.slice(-30).map(function (x) { return x.total; });
    var max = 100;
    var W = 300, H = 80;
    var pts = vals.map(function (v, i) {
      var x = vals.length === 1 ? W / 2 : (i / (vals.length - 1)) * W;
      var y = H - (v / max) * (H - 6) - 3;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');

    var last = vals[vals.length - 1];
    var best = Math.max.apply(null, vals);
    var avg = Math.round(vals.reduce(function (a, b) { return a + b; }, 0) / vals.length);

    var html = '<div class="shm-title">进步曲线</div>' +
      '<p class="shm-p">最近 ' + vals.length + ' 次总分</p>' +
      '<svg class="pl-chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">' +
        '<polyline points="' + pts + '" fill="none" stroke="#58cc02" stroke-width="2.5" ' +
          'stroke-linejoin="round" stroke-linecap="round"/>' +
      '</svg>' +
      '<div class="pl-stats">' +
        '<div><b>' + last + '</b><span>最近</span></div>' +
        '<div><b>' + best + '</b><span>最高</span></div>' +
        '<div><b>' + avg + '</b><span>平均</span></div>' +
        '<div><b>' + h.length + '</b><span>总次数</span></div>' +
      '</div>' +
      '<p class="shm-p">准确/流畅/完整最近一次：' +
        (h[h.length - 1].accuracy) + ' / ' + (h[h.length - 1].fluency) + ' / ' +
        (h[h.length - 1].integrity) + '</p>';

    open(html);
  }

  /* ---------------- 节奏条 ---------------- */
  function openRhythm(r, sent) {
    var words = (r && r.words || []).filter(function (w) { return w.end > w.beg; });
    if (!words.length) {
      open('<div class="shm-title">节奏</div><p class="shm-p">这一句没有拿到时间信息。</p>');
      return;
    }

    var max = 0;
    words.forEach(function (w) { if (w.end - w.beg > max) max = w.end - w.beg; });

    var html = '<div class="shm-title">节奏</div>' +
      '<p class="shm-p">条越长读得越久。带点的词有重读音节——重读词要明显更长，' +
      '如果只比别的词长一点，听起来会像中文。</p>' +
      '<div class="pl-rhythm">';

    words.forEach(function (w) {
      var dur = (w.end - w.beg) / 100;
      var width = Math.max(6, Math.round((w.end - w.beg) / max * 100));
      var stress = (w.syls || []).some(function (s) { return s.accent; });
      var cls = w.score >= 80 ? 'good' : (w.score >= 60 ? 'mid' : 'bad');
      html += '<div class="pl-rh">' +
        '<span class="pl-rh-w">' + (stress ? '● ' : '') + esc(w.word) + '</span>' +
        '<span class="pl-rh-bar ' + cls + '" style="width:' + width + '%"></span>' +
        '<span class="pl-rh-d">' + dur.toFixed(2) + 's</span>' +
        '</div>';
    });

    html += '</div>';
    open(html);
  }

  window.XYPronLab = {
    note: note,
    open: function (kind) {
      if (kind === 'sounds') return openSounds();
      if (kind === 'pairs') return openPairs();
      if (kind === 'mistakes') return openMistakes();
      if (kind === 'progress') return openProgress();
    },
    openRhythm: openRhythm
  };
})();
