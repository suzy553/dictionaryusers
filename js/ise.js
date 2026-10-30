/* ==========================================================================
   讯飞语音评测（ISE）客户端
   - 采集 16kHz / 16bit / 单声道 PCM（Web Audio）
   - 通过 Worker 代理流式发送，解析返回的 XML 评分
   - 未配置代理地址时自动不可用（调用方回退到原方案）
   ========================================================================== */
(function () {
  'use strict';

  var PROXY_KEY = 'ise.proxyUrl';   /* 设置页里填的 wss:// 地址 */
  var SAMPLE_RATE = 16000;

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

  /* ---------- 主流程：读一句 → 返回评分 ---------- */
  async function evaluate(sentence, progress) {
    if (!available()) throw new Error('未配置评测服务地址，请到设置里填写');
    var url = proxyUrl() + '?text=' + encodeURIComponent(sentence) + '&category=read_sentence';

    return new Promise(function (resolve, reject) {
      var ws = new WebSocket(url);
      ws.binaryType = 'arraybuffer';
      var started = false;
      var rec = new Recorder();
      var settled = false;

      function fail(msg) {
        if (settled) return;
        settled = true;
        try { rec.stop(); } catch (e) { }
        try { ws.close(); } catch (e) { }
        reject(new Error(msg));
      }

      ws.onopen = async function () {
        try {
          await rec.start(function (pcm) {
            if (ws.readyState !== 1) return;
            var status = 1;
            var aus = started ? 2 : 1;
            started = true;
            ws.send(JSON.stringify({
              business: { cmd: 'auw', aus: aus },
              data: { status: status, data: b64(pcm) }
            }));
          });
        } catch (e) {
          fail('麦克风打开失败：' + e.message);
        }
      };

      ws.onmessage = function (ev) {
        var msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg.code !== 0) { fail('讯飞返回错误：' + (msg.message || msg.code)); return; }
        if (msg.data && msg.data.data) {
          var xml = '';
          try { xml = atob(msg.data.data); } catch (e) { }
          if (xml) {
            try {
              var r = parseResult(xml);
              if (progress) progress(r);
              if (Number(msg.data.status) === 2) {
                settled = true;
                rec.stop();
                try { ws.close(); } catch (e) { }
                resolve(r);
              }
            } catch (e) { }
          }
        }
      };

      ws.onerror = function () { fail('连接评测服务失败'); };
      ws.onclose = function () { if (!settled) fail('连接已关闭，没有拿到评分'); };

      /* 15 秒保护 */
      setTimeout(function () { if (!settled) fail('评测超时'); }, 15000);
    });
  }

  window.XYISE = {
    available: available,
    proxyUrl: proxyUrl,
    setProxyUrl: setProxyUrl,
    evaluate: evaluate,
    parseResult: parseResult
  };
})();
