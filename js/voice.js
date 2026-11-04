/* ==========================================================================
   讯飞语音能力（TTS 合成 / IAT 听写）
   - 浏览器先向腾讯云函数要签名（svc=tts / svc=iat），再直连讯飞
   - TTS 音频按「文本+语速」缓存到 IndexedDB，避免重复消耗额度
   ========================================================================== */
(function () {
  'use strict';

  var TTS_HOST = 'tts-api.xfyun.cn';
  var IAT_HOST = 'iat-api.xfyun.cn';
  var DB_NAME = 'xyvoice';
  var STORE = 'tts';
  var memCache = {};

  function base() {
    try { return (window.XYISE && window.XYISE.proxyUrl()) || ''; } catch (e) { return ''; }
  }
  function canUse() {
    var b = base();
    return !!b && /^https?:\/\//i.test(b);
  }

  /* iOS 要求在点击的同步调用链里创建/恢复 AudioContext */
  var sharedCtx = null;
  function kickAudio() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new AC();
      if (sharedCtx.state === 'suspended') sharedCtx.resume();
    } catch (e) { }
  }

  function b64bytes(bytes) {
    var s = '';
    var CHUNK = 0x8000;
    for (var i = 0; i < bytes.length; i += CHUNK) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(s);
  }
  function b64text(str) {
    return b64bytes(new TextEncoder().encode(str));
  }
  function fromB64(str) {
    var bin = atob(str);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* 向腾讯云函数取签名 */
  async function sign(svc) {
    var url = base() + (base().indexOf('?') >= 0 ? '&' : '?') + 'svc=' + encodeURIComponent(svc);
    var res = await fetch(url, { cache: 'no-store' });
    var data = null;
    try { data = await res.json(); } catch (e) { }
    if (!res.ok || !data || !data.url) {
      throw new Error((data && data.error) || '签名服务不可用');
    }
    return data;
  }

  /* ---------------- IndexedDB 缓存 ---------------- */
  function idb() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) return reject(new Error('no idb'));
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(STORE); };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { reject(r.error); };
    });
  }
  async function cacheGet(key) {
    if (memCache[key]) return memCache[key];
    try {
      var db = await idb();
      var v = await new Promise(function (resolve) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).get(key);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { resolve(null); };
      });
      if (v) memCache[key] = v;
      return v;
    } catch (e) { return null; }
  }
  async function cacheSet(key, buf) {
    memCache[key] = buf;
    try {
      var db = await idb();
      await new Promise(function (resolve) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(buf, key);
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
    } catch (e) { }
  }

  /* ---------------- TTS ---------------- */
  async function tts(text, opts) {
    opts = opts || {};
    var speed = opts.speed === 0.7 ? 30 : (opts.speed === 1.15 ? 65 : 50);
    var vcn = opts.vcn || 'xiaoyan';
    var key = vcn + '|' + speed + '|' + text;

    var cached = await cacheGet(key);
    if (cached) return new Blob([cached], { type: 'audio/mpeg' });

    var s = await sign('tts');
    var audio = await new Promise(function (resolve, reject) {
      var ws;
      try { ws = new WebSocket(s.url); } catch (e) { return reject(e); }
      var chunks = [];
      var done = false;
      var timer = setTimeout(function () { finish(new Error('语音合成超时')); }, 20000);

      function finish(err) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        try { ws.close(); } catch (e) { }
        if (err) reject(err);
        else {
          var total = 0;
          chunks.forEach(function (c) { total += c.length; });
          var out = new Uint8Array(total);
          var off = 0;
          chunks.forEach(function (c) { out.set(c, off); off += c.length; });
          resolve(out.buffer);
        }
      }

      ws.onopen = function () {
        ws.send(JSON.stringify({
          common: { app_id: s.app_id },
          business: {
            aue: 'lame', sfl: 1, vcn: vcn, speed: speed,
            volume: 50, pitch: 50, tte: 'UTF8'
          },
          data: { status: 2, text: b64text(text) }
        }));
      };
      ws.onmessage = function (ev) {
        var m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.code !== 0) return finish(new Error(m.message || ('TTS ' + m.code)));
        var d = m.data || {};
        if (d.audio) chunks.push(fromB64(d.audio));
        if (Number(d.status) === 2) finish(null);
      };
      ws.onerror = function () { finish(new Error('语音合成连接失败')); };
      ws.onclose = function () { if (!done) finish(chunks.length ? null : new Error('语音合成中断')); };
    });

    await cacheSet(key, audio);
    return new Blob([audio], { type: 'audio/mpeg' });
  }

  /* 播放合成语音；失败由调用方决定是否退回系统 TTS */
  async function play(text, opts) {
    var blob = await tts(text, opts);
    var url = URL.createObjectURL(blob);
    await new Promise(function (resolve, reject) {
      var a = new Audio(url);
      a.onended = function () { URL.revokeObjectURL(url); resolve(); };
      a.onerror = function () { URL.revokeObjectURL(url); reject(new Error('播放失败')); };
      a.play().catch(function (e) { URL.revokeObjectURL(url); reject(e); });
    });
  }

  /* ---------------- IAT 听写 ---------------- */
  function down16(input, inRate) {
    var ratio = inRate / 16000;
    var len = Math.floor(input.length / ratio);
    var out = new Int16Array(len);
    for (var i = 0; i < len; i++) {
      var v = Math.max(-1, Math.min(1, input[Math.floor(i * ratio)] || 0));
      out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    return out;
  }

  /**
   * 实时听写。返回 { done, stop }
   * @param {{onPartial?:function(string), maxMs?:number}} opts
   */
  function listen(opts) {
    opts = opts || {};
    var maxMs = opts.maxMs || 55000;
    var state = { stopped: false, ws: null, ctx: null, stream: null, node: null, timer: null };
    var cap = {};
    var finished = false;
    var text = '';
    var started = false;

    state.done = new Promise(function (res, rej) { cap.res = res; cap.rej = rej; });

    /* 必须在点击的同步调用里唤醒音频上下文（iOS） */
    kickAudio();

    function teardown() {
      try { if (state.node) state.node.disconnect(); } catch (e) { }
      try { if (state.stream) state.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { }
      try {
        if (state.ctx && state.ctx !== sharedCtx && state.ctx.state !== 'closed') state.ctx.close();
      } catch (e) { }
      state.node = null; state.stream = null; state.ctx = null;
    }
    function finish(err) {
      if (finished) return;
      finished = true;
      clearTimeout(state.timer);
      teardown();
      try { if (state.ws) state.ws.close(); } catch (e) { }
      if (err) cap.rej(err);
      else cap.res(text.trim());
    }

    state.stop = function () {
      if (finished) return;
      state.stopped = true;
      try {
        if (state.ws && state.ws.readyState === 1) {
          state.ws.send(JSON.stringify({
            data: { status: 2, format: 'audio/L16;rate=16000', encoding: 'raw', audio: '' }
          }));
        }
      } catch (e) { }
      teardown();
      /* 服务端一般 1 秒内回结束帧；兜底 3 秒 */
      setTimeout(function () { if (!finished) finish(null); }, 3000);
    };

    (async function start() {
      var s = await sign('iat');
      var stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
      });
      state.stream = stream;
      var AC = window.AudioContext || window.webkitAudioContext;
      var ctx = (sharedCtx && sharedCtx.state !== 'closed') ? sharedCtx : new AC();
      state.ctx = ctx;
      if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) { } }

      var ws = new WebSocket(s.url);
      state.ws = ws;

      ws.onopen = function () {
        var src = ctx.createMediaStreamSource(stream);
        var node = ctx.createScriptProcessor(4096, 1, 1);
        state.node = node;
        node.onaudioprocess = function (e) {
          if (finished || state.stopped || ws.readyState !== 1) return;
          var pcm = down16(e.inputBuffer.getChannelData(0), ctx.sampleRate);
          var b64 = b64bytes(new Uint8Array(pcm.buffer));
          var frame = {
            data: {
              status: started ? 1 : 0,
              format: 'audio/L16;rate=16000',
              encoding: 'raw',
              audio: b64
            }
          };
          if (!started) {
            started = true;
            frame.common = { app_id: s.app_id };
            frame.business = { language: 'en_us', domain: 'iat', accent: 'mandarin', eos: 3000 };
          }
          try { ws.send(JSON.stringify(frame)); } catch (err) { }
        };
        src.connect(node);
        var mute = ctx.createGain();
        mute.gain.value = 0;
        node.connect(mute);
        mute.connect(ctx.destination);
      };

      ws.onmessage = function (ev) {
        var m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.code !== 0) return finish(new Error(m.message || ('IAT ' + m.code)));
        var d = m.data || {};
        var r = d.result;
        if (r && r.ws) {
          var seg = '';
          for (var i = 0; i < r.ws.length; i++) {
            var cw = r.ws[i].cw || [];
            for (var j = 0; j < cw.length; j++) seg += cw[j].w || '';
          }
          if (seg) {
            text += seg;
            if (opts.onPartial) { try { opts.onPartial(text); } catch (e) { } }
          }
        }
        if (Number(d.status) === 2) finish(null);
      };
      ws.onerror = function () { finish(new Error('听写连接失败')); };
      ws.onclose = function () { if (!finished) finish(text ? null : new Error('听写已断开')); };

      state.timer = setTimeout(function () { state.stop(); }, maxMs);
    })().catch(function (e) {
      finish(e);
    });

    return state;
  }

  window.XYVoice = {
    canUse: canUse,
    tts: tts,
    play: play,
    listen: listen
  };
})();
