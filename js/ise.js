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

  /* iOS Safari 要求在用户点击的调用链里创建/恢复 AudioContext，
     否则麦克风数据一直是静音（表现为 0 分） */
  var sharedCtx = null;

  function kickAudio() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!sharedCtx || sharedCtx.state === 'closed') sharedCtx = new AC();
      if (sharedCtx.state === 'suspended') sharedCtx.resume();
    } catch (e) { }
  }

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
    this.ctx = (sharedCtx && sharedCtx.state !== 'closed') ? sharedCtx : new AC();
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (e) { }
    }
    var src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this._buf = new Uint8Array(this.analyser.fftSize);
    src.connect(this.analyser);

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
    if (this.ctx && this.ctx !== sharedCtx) {
      try { this.ctx.close(); } catch (e) { }
    }
    try { if (this.stream) this.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) { }
    this.node = null; this.ctx = null; this.stream = null;
    this.analyser = null;
  };

  /* 实时音量 0~1，用来画电平条 */
  Recorder.prototype.level = function () {
    if (!this.analyser || !this._buf) return 0;
    this.analyser.getByteTimeDomainData(this._buf);
    var sum = 0;
    for (var i = 0; i < this._buf.length; i++) {
      var v = (this._buf[i] - 128) / 128;
      sum += v * v;
    }
    return Math.min(1, Math.sqrt(sum / this._buf.length) * 4);
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

    function num(node, name) {
      if (!node || !node.getAttribute) return 0;
      var v = node.getAttribute(name);
      return v == null || v === '' ? 0 : Number(v);
    }

    /* 结果根节点：read_sentence / read_chapter / read_word 可能嵌套，取带 total_score 的那个 */
    function pickRoot(tags) {
      for (var t = 0; t < tags.length; t++) {
        var list = doc.querySelectorAll(tags[t]);
        for (var i = 0; i < list.length; i++) {
          if (list[i].getAttribute('total_score') != null) return list[i];
        }
      }
      return null;
    }

    var rs = pickRoot(['read_sentence', 'read_chapter', 'read_word']);
    var out = {
      total: num(rs, 'total_score'),
      accuracy: num(rs, 'accuracy_score'),
      fluency: num(rs, 'fluency_score'),
      integrity: num(rs, 'integrity_score'),
      standard: num(rs, 'standard_score'),
      words: [],
      sentences: [],
      duration: 0,
      rate: 0,
      audioSeconds: 0
    };

    var sents = doc.querySelectorAll('sentence');
    for (var si = 0; si < sents.length; si++) {
      var se = sents[si];
      out.sentences.push({
        content: se.getAttribute('content') || '',
        total: num(se, 'total_score'),
        accuracy: num(se, 'accuracy_score'),
        fluency: num(se, 'fluency_score'),
        standard: num(se, 'standard_score'),
        wordCount: num(se, 'word_count'),
        beg: num(se, 'beg_pos'),
        end: num(se, 'end_pos')
      });
    }

    var nodes = doc.querySelectorAll('word');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var w = el.getAttribute('content') || '';
      if (!w || w === 'sil' || w === 'fil') continue;

      var item = {
        word: w,
        score: num(el, 'total_score'),
        dp: num(el, 'dp_message'),
        syls: [],
        phonemes: [],
        worst: null,
        weakSyl: null
      };

      var syls = el.querySelectorAll('syll');
      for (var k = 0; k < syls.length; k++) {
        var sylEl = syls[k];
        var syl = {
          score: num(sylEl, 'syll_score'),
          accent: num(sylEl, 'syll_accent'),
          serr: num(sylEl, 'serr_msg'),
          phones: []
        };
        var phs = sylEl.querySelectorAll('phone');
        for (var p = 0; p < phs.length; p++) {
          var phEl = phs[p];
          var sym = (phEl.getAttribute('content') || '').replace(/^['’]/, '');
          var ph = { sym: sym, gwpp: num(phEl, 'gwpp') };
          syl.phones.push(ph);
          if (sym) {
            item.phonemes.push(sym);
            if (!item.worst || ph.gwpp < item.worst.gwpp) item.worst = ph;
          }
        }
        if (syl.phones.length && (!item.weakSyl || syl.score < item.weakSyl.score)) item.weakSyl = syl;
        item.syls.push(syl);
      }

      item.beg = num(el, 'beg_pos');
      item.end = num(el, 'end_pos');

      /* 0 正常 / 16 漏读 / 32 增读 / 128 替换 */
      item.error = item.dp === 16 ? 'miss' : (item.dp === 128 ? 'wrong' : (item.dp === 32 ? 'extra' : ''));
      out.words.push(item);
    }

    var maxEnd = 0;
    for (var j = 0; j < out.sentences.length; j++) {
      if (out.sentences[j].end > maxEnd) maxEnd = out.sentences[j].end;
    }
    out.duration = maxEnd / 100;                       /* beg/end 单位是 10ms */
    out.rate = out.duration > 0 ? out.words.length / out.duration * 60 : 0;
    return out;
  }

  /* ---------- 音素 → IPA + 中文发音要点 ---------- */
  var PHONEME_TIPS = {
    iy: ['/iː/', '长音“衣”：嘴角往两边拉开，比中文“衣”更长更紧'],
    ih: ['/ɪ/', '短音：舌头放松，别拉成长音 iː'],
    eh: ['/e/', '短“诶”：嘴微张，舌前部抬起'],
    ae: ['/æ/', '嘴张大，介于“啊”和“诶”之间，下巴放低'],
    aa: ['/ɑː/', '长“啊”：嘴张大，舌身后缩'],
    ah: ['/ʌ/', '短促的“啊”：嘴半开，声音短而松'],
    ao: ['/ɔː/', '圆唇长“奥”'],
    oo: ['/ʊ/', '短“乌”：嘴唇略圆，别拖长'],
    uw: ['/uː/', '长“乌”：嘴唇收圆前突'],
    uh: ['/ʊ/', '短“乌”'],
    ax: ['/ə/', '弱读的“呃”：最放松的元音，非重读音节常读它'],
    er: ['/ɜːr/', '卷舌“儿”：舌中部抬起并卷舌'],
    ar: ['/ɑːr/', '“啊”+ 卷舌'],
    ir: ['/ɪər/', '“衣”滑向“儿”'],
    ur: ['/ʊər/', '“乌”滑向“儿”'],
    ey: ['/eɪ/', '从“诶”滑向“衣”'],
    ay: ['/aɪ/', '从“啊”滑向“衣”'],
    oy: ['/ɔɪ/', '从“奥”滑向“衣”'],
    ow: ['/oʊ/', '从“欧”滑向“乌”'],
    aw: ['/aʊ/', '从“啊”滑向“乌”'],
    th: ['/θ/', '舌尖轻放上下齿之间，送气不振动；别读成 s 或 t'],
    dh: ['/ð/', '舌尖轻放齿间、声带振动；别读成 d 或 z'],
    r: ['/r/', '舌尖卷起但不碰上颚，嘴唇略圆；别读成 l'],
    l: ['/l/', '舌尖顶上齿龈；词尾 l 要收住，别吞掉'],
    v: ['/v/', '上齿轻咬下唇、声带振动；别读成 w'],
    w: ['/w/', '双唇收圆、不咬唇'],
    sh: ['/ʃ/', '“嘘”音，嘴唇略前突'],
    zh: ['/ʒ/', '“日”的浊音，声带振动'],
    ch: ['/tʃ/', '“吃”音：先阻塞再送气'],
    jh: ['/dʒ/', '“知”的浊音'],
    ng: ['/ŋ/', '舌根抵住软腭、鼻腔出声；别读成“恩格”'],
    hh: ['/h/', '轻送气，不要摩擦太重'],
    b: ['/b/', '双唇爆破、声带振动'],
    p: ['/p/', '双唇爆破、送气'],
    d: ['/d/', '舌尖抵上齿龈爆破'],
    t: ['/t/', '舌尖抵上齿龈、送气；词尾别加“呃”'],
    g: ['/g/', '舌根爆破'],
    k: ['/k/', '舌根爆破、送气'],
    f: ['/f/', '上齿咬下唇、送气'],
    s: ['/s/', '舌尖靠近上齿龈、送气'],
    z: ['/z/', '同 s 但声带振动'],
    m: ['/m/', '双唇闭合、鼻腔出声'],
    n: ['/n/', '舌尖抵上齿龈、鼻腔出声'],
    y: ['/j/', '“衣”的滑音'],
    tr: ['/tr/', 't + r 连读'],
    dr: ['/dr/', 'd + r 连读'],
    ts: ['/ts/', '“次”音'],
    dz: ['/dz/', '“兹”的浊音']
  };

  function phonemeInfo(sym) {
    var k = String(sym || '').toLowerCase().replace(/[^a-z]/g, '');
    return PHONEME_TIPS[k] || null;
  }

  /* 把讯飞音素串成 IPA，重读音节前加 ˈ */
  function ipaOfWord(w) {
    if (!w || !w.syls || !w.syls.length) return '';
    var parts = [];
    for (var i = 0; i < w.syls.length; i++) {
      var s = w.syls[i];
      if (s.accent) parts.push('ˈ');
      for (var j = 0; j < s.phones.length; j++) {
        var info = phonemeInfo(s.phones[j].sym);
        parts.push(info ? info[0].replace(/\//g, '') : s.phones[j].sym);
      }
    }
    return '/' + parts.join('') + '/';
  }

  function wordInfo(w) {
    var sym = w && w.worst ? w.worst.sym : '';
    var info = sym ? phonemeInfo(sym) : null;
    return {
      ipa: ipaOfWord(w),
      sym: sym,
      tip: info ? info[1] : '跟读标准音频，注意重音位置和词尾收尾。'
    };
  }

  function diagnoseWord(w, force) {
    var info = wordInfo(w);
    if (w.dp === 16) {
      return {
        word: w.word, type: 'miss', title: '漏读', score: 0,
        ipa: info.ipa, tip: '放慢速度，把每个音节都读出来，尤其是词尾的辅音。',
        text: '这个词没读出来，或者声音太小被引擎吞掉了。'
      };
    }
    if (w.dp === 128) {
      return {
        word: w.word, type: 'wrong', title: '读成了别的词', score: w.score,
        ipa: info.ipa, tip: '对着标准音频逐音节跟读，先慢后快。',
        text: '引擎听到的是另一个词，通常是漏掉或读错了某个音节。'
      };
    }
    if (w.score >= 75 && !force) return null;

    var syl = w.weakSyl;
    var ph = w.worst;
    if (syl && syl.phones && syl.phones.length) {
      for (var i = 0; i < syl.phones.length; i++) {
        var cand = syl.phones[i];
        if (cand.sym && cand.gwpp < (ph ? ph.gwpp : 0)) ph = cand;
      }
    }
    var weak = ph ? phonemeInfo(ph.sym) : null;
    return {
      word: w.word, type: force ? 'weak' : 'pron',
      title: weak ? ('音节 ' + weak[0] + ' 偏弱') : '发音偏弱',
      score: w.score, ipa: info.ipa,
      text: '这个词 ' + Math.round(w.score) + ' 分' +
        (syl && syl.serr ? '，其中有一处音节没读准' : '') + '。',
      tip: weak ? weak[1] : '跟读标准音频，注意重音和词尾。'
    };
  }

  /* ---------- 生成分析报告 ---------- */
  function analyze(r) {
    var words = (r && r.words) || [];
    var misses = [], extras = [], wrongs = [], ranked = [];

    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (w.dp === 16) misses.push(w);
      else if (w.dp === 32) extras.push(w);
      else if (w.dp === 128) wrongs.push(w);
      if (w.dp !== 32) ranked.push(w);
    }
    ranked.sort(function (a, b) { return a.score - b.score; });

    var issues = [];
    for (var k = 0; k < ranked.length && issues.length < 4; k++) {
      var d = diagnoseWord(ranked[k]);
      if (d) issues.push(d);
    }

    /* 分数都很高时，也挑两个相对最弱的音节给建议 */
    if (issues.length < 2) {
      var picked = {};
      for (var q = 0; q < issues.length; q++) picked[issues[q].word] = 1;
      for (var m2 = 0; m2 < ranked.length && issues.length < 2; m2++) {
        var wd = ranked[m2];
        if (picked[wd.word]) continue;
        if (!wd.weakSyl || wd.weakSyl.score <= 0 || wd.weakSyl.score >= 85) continue;
        var dx = diagnoseWord(wd, true);
        if (dx) issues.push(dx);
      }
    }

    var total = r.total || 0;
    var verdict = total >= 90 ? '非常接近标准发音'
      : total >= 80 ? '整体不错，有几个音需要修'
        : total >= 60 ? '能听懂，但错误比较明显'
          : total > 0 ? '问题较多，建议放慢速度逐词练'
            : '没有拿到有效分数，先确认麦克风';

    var lowWords = ranked.filter(function (x) { return x.score > 0 && x.score < 60; });
    var weakSyls = ranked.filter(function (x) {
      return x.weakSyl && x.weakSyl.score > 0 && x.weakSyl.score < 80;
    });
    var names = function (arr) {
      return arr.slice(0, 6).map(function (x) { return x.word; }).join('、');
    };

    var dims = {
      accuracy: {
        score: r.accuracy,
        text: '准确度看每个音是否读对：' +
          (lowWords.length ? lowWords.length + ' 个词低于 60 分（' + names(lowWords) + '）' : '没有明显读错的词') +
          (weakSyls.length ? '；相对最弱的是 ' + names(weakSyls) +
            '（最低的音节 ' + Math.round(weakSyls[0].weakSyl.score) + ' 分）' : '') +
          (wrongs.length ? '；' + wrongs.length + ' 个词被听成了别的词' : '') + '。',
        tip: '先挑分数最低的 2~3 个词，对着标准音频逐音节跟读，再读整句。'
      },
      fluency: {
        score: r.fluency,
        text: '流畅度看语速和停顿：这次大约 ' + Math.round(r.rate || 0) + ' 词/分' +
          ((r.rate || 0) > 170 ? '，偏快，容易吞音' : (r.rate || 0) < 100 ? '，偏慢，停顿偏多' : '，速度正常') + '。',
        tip: '按意群停顿，不要一个词一个词地读；长句先分成两段再连起来。'
      },
      integrity: {
        score: r.integrity,
        text: '完整度看有没有漏读：这次漏读 ' + misses.length + ' 个词' +
          (misses.length ? '（' + names(misses) + '）' : '') +
          (extras.length ? '，另外多读了 ' + extras.length + ' 个词' : '') + '。',
        tip: misses.length ? '漏读多半是读太快或声音太小，指着原文逐词读一遍。' : '保持现在的完整度就好。'
      }
    };

    return {
      verdict: verdict,
      dims: dims,
      issues: issues,
      misses: misses,
      extras: extras,
      rate: r.rate || 0,
      audioSeconds: r.audioSeconds || 0
    };
  }

  /* ---------- 讯飞协议帧 ---------- */
  function ssbFrame(appId, text, category) {
    return {
      common: { app_id: appId },
      business: {
        sub: 'ise',
        ent: 'en_vip',
        category: category || 'read_sentence',
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
    if (!data || !data.url) {
      /* 常见原因：把网页地址、GitHub Pages 地址填进来了 */
      throw new Error('这个地址返回的不是签名服务，检查是否填成了网页地址');
    }
    if (!data.app_id) throw new Error('签名服务没有返回 app_id');
    return data;
  }

  /* ---------- 保存地址时自检 ---------- */
  async function check(base) {
    if (!isDirect(base)) return '已保存（wss 代理地址，部署后才能验证）';
    var info = await requestSign(base, 'hello');
    return '连接正常，app_id ' + info.app_id;
  }

  /* ---------- 会话管理（供「停止」按钮调用） ---------- */
  var current = null;
  var currentRec = null;

  function stopCurrent() {
    var s = current;
    if (!s || typeof s.stop !== 'function') return;
    s.stop();
  }

  /* ---------- 主流程：读一句 → 返回评分 ---------- */
  async function evaluate(sentence, progress, opts) {
    if (!available()) throw new Error('未配置评测服务地址，请到设置里填写');

    /* 必须在点击的同步调用里唤醒音频上下文（iOS 限制） */
    kickAudio();

    var base = proxyUrl();
    var direct = isDirect(base);
    var category = (opts && opts.category) || 'read_sentence';
    var wsUrl = '';
    var appId = '';

    if (direct) {
      var sign = await requestSign(base, sentence);
      wsUrl = sign.url;
      appId = sign.app_id;
    } else {
      wsUrl = base + (base.indexOf('?') >= 0 ? '&' : '?') +
        'text=' + encodeURIComponent(sentence) + '&category=' + encodeURIComponent(category);
    }

    return new Promise(function (resolve, reject) {
      var ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';

      var rec = new Recorder();
      var started = false;
      var settled = false;
      var lastResult = null;
      var sentBytes = 0;
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
        stopCapture();
        try { rec.stop(); } catch (e) { }
        currentRec = null;
        try {
          if (ws.readyState === 0 || ws.readyState === 1) ws.close();
        } catch (e) { }
        if (current === session) current = null;
      }

      function stopCapture() {
        if (opts && typeof opts.onStop === 'function') {
          try { opts.onStop(); } catch (e) { }
        }
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
        if (result) result.audioSeconds = sentBytes / 32000;   /* 16k × 16bit */
        cleanup();
        resolve(result);
      }

      /* 「停止」按钮：停止录音并给讯飞发最后一帧 */
      session.stop = function () {
        if (settled) return;
        session.stopped = true;
        sendFinal();
        stopCapture();
        try { rec.stop(); } catch (e) { }
      };

      ws.onopen = async function () {
        try {
          if (direct) ws.send(JSON.stringify(ssbFrame(appId, sentence, category)));
          if (session.stopped) { sendFinal(); return; }

          await rec.start(function (pcm) {
            if (settled || session.stopped || ws.readyState !== 1) return;
            sentBytes += pcm.byteLength;
            /* 讯飞协议：首帧 aus=1 / 中间 aus=2 / 末帧 aus=4，data.status 音频阶段固定 1 */
            var aus = started ? 2 : 1;
            started = true;
            ws.send(JSON.stringify({
              business: { cmd: 'auw', aus: aus },
              data: { status: 1, data: b64(pcm) }
            }));
          });

          if (opts && typeof opts.onStream === 'function' && rec.stream) {
            try { opts.onStream(rec.stream); } catch (e) { }
          }
          currentRec = rec;
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
    analyze: analyze,
    wordInfo: wordInfo,
    phonemeInfo: phonemeInfo,
    level: function () { return currentRec && currentRec.level ? currentRec.level() : 0; },
    check: check,
    _stop: stopCurrent
  };
})();
