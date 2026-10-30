/* ==========================================================================
   讯飞语音评测（ISE）客户端
   - 采集 16kHz / 16bit / 单声道 PCM（Web Audio）
   - 两种接入方式：
     1) 国内直连（推荐）：设置里填签名服务的 https 地址；
        浏览器先拿签名，再直连讯飞，录音不绕道国外。
     2) 旧版代理：填 wss 地址，由 Cloudflare Worker 代发首帧并转发音频。
   - 解析返回的 XML 评分；未配置地址时不可用（调用方回退到原方案）
   ========================================================================== */
(function () {
  'use strict';

  var PROXY_KEY = 'ise.proxyUrl';   /* 设置页里填的：https 签名地址 或 wss 代理地址 */
  var SAMPLE_RATE = 16000;
  var RESULT_TIMEOUT = 30000;

  function proxyUrl() {
    try { return localStorage.getItem(PROXY_KEY) || ''; } catch (e) { return ''; }
  }
  function setProxyUrl(u) {
    try {
      if (u) localStorage.setItem(PROXY_KEY, u.trim());
      else localStorage.removeItem(PROXY_KEY);
    } catch (e) { }
  }
  function available() { return !!proxyUrl(); }

  /* https:// 开头 = 国内直连（先取签名）；wss:// 开头 = 旧版代理 */
  function isDirect(url) { return /^https?:\/\//i.test(url); }

  /* ---------- PCM 采集 ---------- */
  function Recorder() {
    this.ctx = null;
    this.stream = null;
    this.node = null;
    this.onChunk = null;
    this.sent = 0;
  }

  Recorder.prototype.start = async function (onChunk) {
    var self = this;
    this.onChunk = onChunk;
    this.sent = 0;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }
    });
    var AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    var src = this.ctx.createMediaStreamSource(this.stream);

    /* 用 ScriptProcessor，兼容性最好（AudioWorklet 需要额外文件） */
    var bufSize = 4096;
    this.node = this.ctx.createScriptProcessor(bufSize, 1, 1);
    this.node.onaudioprocess = function (e) {
      if (!self.onChunk) return;
      var input = e.inputBuffer.getChannelData(0);
      var pcm = downsampleToPcm16(input, self.ctx.sampleRate, SAMPLE_RATE);
      if (pcm.byteLength) self.onChunk(pcm);
    };
    src.connect(this.node);
    /* 必须接到 destination 才会持续触发，静音输出即可 */
    var mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.node.connect(mute);
    mute.connect(this.ctx.destination);
  };

  Recorder.prototype.stop = function () {
    this.onChunk = null;
    try { if (this.node) this.node.disconnect(); } catch (e) { }
    try { if (this.ctx) this.ctx.close(); } catch (e) { }
    try { if (this.stream) this.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { }
    this.node = null; this.ctx = null; this.stream = null;
  };

  /* Float32 → 16k Int16 PCM */
  function downsampleToPcm16(input, inRate, outRate) {
    var ratio = inRate / outRate;
    var outLen = Math.floor(input.length / ratio);
    if (outLen <= 0) return new DataView(new ArrayBuffer(0));
    var out = new Int16Array(outLen);
    for (var i = 0; i < outLen; i++) {
      var idx = Math.floor(i * ratio);
      var s = Math.max(-1, Math.min(1, input[idx] || 0));
      out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return out;
  }

  function b64(bytes) {
    var s = '';
    var arr = new Uint8Array(bytes.buffer || bytes);
    var CHUNK = 0x8000;
    for (var i = 0; i < arr.length; i += CHUNK) {
      s += String.fromCharCode.apply(null, arr.subarray(i, i + CHUNK));
    }
    return btoa(s);
  }

  /* ---------- XML 解析 ---------- */
  function parseResult(xml) {
    var doc = new DOMParser().parseFromString(xml, 'text/xml');
    function attr(node, name) {
      return node && node.getAttribute ? Number(node.getAttribute(name) || 0) : 0;
    }
    var rs = doc.querySelector('read_sentence') || doc.querySelector('read_chapter') || doc.querySelector('read_word');
    var out = {
      total: attr(rs, 'total_score'),
      accuracy: attr(rs, 'accuracy_score'),
      fluency: attr(rs, 'fluency_score'),
      integrity: attr(rs, 'integrity_score'),
      standard: attr(rs, 'standard_score'),
      words: []
    };
    var words = doc.querySelectorAll('word');
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      var dp = Number(w.getAttribute('dp_message') || 0);
      out.words.push({
        word: w.getAttribute('content') || '',
        score: Number(w.getAttribute('total_score') || 0),
        /* 0 正常 / 16 漏读 / 32 增读 / 128 替换 */
        error: dp === 16 ? 'miss' : dp === 128 ? 'wrong' : dp === 32 ? 'extra' : ''
      });
    }
    return out;
  }

  /* ---------- 讯飞协议帧 ---------- */
  function ssbFrame(appId, text) {
    return {
      common: { app_id: appId },
      business: {
        sub: 'ise',
        ent: 'en_vip',
        category: 'read_sentence',
        cmd: 'ssb',
        text: '\uFEFF' + text,
        tte: 'utf-8',
        ttp_skip: true,
        aue: 'raw',
        auf: 'audio/L16;rate=16000',
        rstcd: 'utf8',
        rst: 'entirety',
        ise_unite: '1',
        extra_ability: 'multi_dimension',
        group: 'adult'
      },
      data: { status: 0 }
    };
  }

  /* ---------- 请求签名服务 ---------- */
  async function requestSign(base, sentence) {
    var url = base + (base.indexOf('?') >= 0 ? '&' : '?') +
      'text=' + encodeURIComponent(sentence) + '&category=read_sentence';

    var res;
    try {
      res = await fetch(url, { cache: 'no-store' });
    } catch (e) {
      throw new Error('签名服务连不上：' + (e && e.message ? e.message : e));
    }

    var raw = await res.text();
    var data = null;
    try { data = JSON.parse(raw); } catch (e) { }

    if (!res.ok) {
      throw new Error('签名服务 ' + res.status + (data && data.error ? '：' + data.error : ''));
    }
    if (!data || !data.url) throw new Error('签名服务返回格式不对');
    if (!data.app_id) throw new Error('签名服务没有返回 app_id');
    return data;
  }

  /* ---------- 会话管理（供「停止」按钮调用） ---------- */
  var current = null;

  function stopCurrent() {
    var s = current;
    if (!s || typeof s.stop !== 'function') return;
    s.stop();
  }

  /* ---------- 主流程：读一句 → 返回评分 ---------- */
  async function evaluate(sentence, progress) {
    if (!available()) throw new Error('未配置评测服务地址，请到设置里填写');

    var base = proxyUrl();
    var direct = isDirect(base);
    var wsUrl = '';
    var appId = '';

    if (direct) {
      var sign = await requestSign(base, sentence);
      wsUrl = sign.url;
      appId = sign.app_id;
    } else {
      wsUrl = base + (base.indexOf('?') >= 0 ? '&' : '?') +
        'text=' + encodeURIComponent(sentence) + '&category=read_sentence';
    }

    return new Promise(function (resolve, reject) {
      var ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      var rec = new Recorder();
      var started = false;
      var settled = false;
      var lastResult = null;
      var session = { ws: ws, rec: rec, stopped: false, finalSent: false };
      current = session;

      function sendFinal() {
        if (session.finalSent) return;
        session.finalSent = true;
        try {
          if (ws.readyState === 1) {
            ws.send(JSON.stringify({
              business: { cmd: 'auw', aus: 4 },
              data: { status: 2, data: '' }
            }));
          }
        } catch (e) { }
      }

      function cleanup() {
        try { rec.stop(); } catch (e) { }
        try {
          if (ws.readyState === 0 || ws.readyState === 1) ws.close();
        } catch (e) { }
        if (current === session) current = null;
      }

      function fail(msg) {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error(msg));
      }

      function done(result) {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(result);
      }

      /* 「停止」按钮：停止录音并给讯飞发最后一帧 */
      session.stop = function () {
        if (settled) return;
        session.stopped = true;
        try { rec.stop(); } catch (e) { }
        sendFinal();
      };

      ws.onopen = async function () {
        try {
          if (direct) ws.send(JSON.stringify(ssbFrame(appId, sentence)));
          if (session.stopped) { sendFinal(); return; }

          await rec.start(function (pcm) {
            if (settled || session.stopped || ws.readyState !== 1) return;
            /* 讯飞协议：首帧 aus=1 / 中间 aus=2 / 末帧 aus=4，data.status 音频阶段固定 1 */
            var aus = started ? 2 : 1;
            started = true;
            ws.send(JSON.stringify({
              business: { cmd: 'auw', aus: aus },
              data: { status: 1, data: b64(pcm) }
            }));
          });
        } catch (e) {
          fail('麦克风打开失败：' + (e && e.message ? e.message : e));
        }
      };

      ws.onmessage = function (ev) {
        var msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }

        if (msg.code !== 0) {
          fail('讯飞返回错误：' + (msg.message || ('code ' + msg.code)));
          return;
        }

        var d = msg.data || {};
        var result = null;

        if (d.data) {
          var xml = '';
          try { xml = atob(d.data); } catch (e) { }
          if (xml) {
            try { result = parseResult(xml); } catch (e) { }
            if (result) {
              lastResult = result;
              if (progress) {
                try { progress(result); } catch (e) { }
              }
            }
          }
        }

        /* status=2 是最后一帧 */
        if (Number(d.status) === 2) {
          var finalResult = result || lastResult;
          if (finalResult) done(finalResult);
          else fail('讯飞返回了结束标记，但没有评分');
        }
      };

      ws.onerror = function () {
        fail(direct ? '连不上讯飞（检查网络或签名地址）' : '连接评测服务失败');
      };

      ws.onclose = function () {
        if (!settled) fail('连接已关闭，没有拿到评分');
      };

      /* 保护：用户忘了点「停止」时不至于一直挂着 */
      setTimeout(function () {
        if (!settled) fail('评测超时（' + (RESULT_TIMEOUT / 1000) + ' 秒）');
      }, RESULT_TIMEOUT);
    });
  }

  window.XYISE = {
    available: available,
    proxyUrl: proxyUrl,
    setProxyUrl: setProxyUrl,
    evaluate: evaluate,
    parseResult: parseResult,
    _stop: stopCurrent
  };
})();
