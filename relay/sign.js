/**
 * 讯飞语音评测（ISE）签名服务 —— 国内云函数版
 *
 * 浏览器先请求 /sign 拿到一个 5 分钟有效的 wss 地址，然后直连讯飞。
 * APISecret 只存在于云函数的环境变量里，前端永远拿不到。
 *
 * 支持三种运行方式：
 *   1) 腾讯云 SCF + API 网关：入口 sign.main_handler
 *   2) 腾讯云 CloudBase / 阿里云 FC（事件格式兼容 httpMethod + queryStringParameters）
 *   3) 本地调试：node sign.js  （默认 http://127.0.0.1:8787/sign）
 *
 * 环境变量：
 *   XF_APPID       讯飞 APPID
 *   XF_APIKEY      讯飞 APIKey
 *   XF_APISECRET   讯飞 APISecret
 *   ALLOW_ORIGIN   允许的前端来源，多个用逗号分隔；默认 *（建议填自己的站点）
 *   RATE_LIMIT     每个 IP 每分钟最多签发次数，默认 60
 */

'use strict';

const crypto = require('node:crypto');
const http = require('node:http');

const XF_HOST = 'ise-api.xfyun.cn';
const XF_PATH = '/v2/open-ise';
const SIGN_TTL = 300; // 秒

/* ------------------------------------------------------------------ */
/* 签名                                                                */
/* ------------------------------------------------------------------ */

/**
 * 生成讯飞 WSS 鉴权地址（HMAC-SHA256，参数放在 URL 上，浏览器可直接连）
 * @param {string} apiKey
 * @param {string} apiSecret
 * @param {Date}   [date] 便于测试固定时间
 * @returns {string} wss://ise-api.xfyun.cn/v2/open-ise?authorization=...
 */
function buildSignedUrl(apiKey, apiSecret, date) {
  const d = (date || new Date()).toUTCString();
  const origin = `host: ${XF_HOST}\ndate: ${d}\nGET ${XF_PATH} HTTP/1.1`;
  const signature = crypto.createHmac('sha256', apiSecret).update(origin).digest('base64');
  const authOrigin =
    `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = Buffer.from(authOrigin).toString('base64');
  const qs = new URLSearchParams({ authorization, date: d, host: XF_HOST });
  return `wss://${XF_HOST}${XF_PATH}?${qs}`;
}

/* ------------------------------------------------------------------ */
/* 配置 / 限流                                                          */
/* ------------------------------------------------------------------ */

function readConfig(env) {
  const e = env || process.env;
  return {
    appid: e.XF_APPID || '',
    apikey: e.XF_APIKEY || '',
    apisecret: e.XF_APISECRET || '',
    allowOrigins: String(e.ALLOW_ORIGIN || '*')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    rateLimit: Number(e.RATE_LIMIT || 60) || 60,
  };
}

const buckets = new Map();

function takeToken(ip, limit) {
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || b.reset <= now) {
    b = { count: 0, reset: now + 60_000 };
    buckets.set(ip, b);
  }
  b.count += 1;
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) if (v.reset <= now) buckets.delete(k);
  }
  return b.count <= limit;
}

/* ------------------------------------------------------------------ */
/* CORS                                                                */
/* ------------------------------------------------------------------ */

function corsHeaders(origin, allowOrigins) {
  if (allowOrigins.includes('*')) {
    return { 'Access-Control-Allow-Origin': '*' };
  }
  if (origin && allowOrigins.includes(origin)) {
    return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
  }
  return {};
}

function originAllowed(origin, allowOrigins) {
  if (allowOrigins.includes('*')) return true;
  if (!origin) return true; // curl / 非浏览器调用
  return allowOrigins.includes(origin);
}

/* ------------------------------------------------------------------ */
/* 请求处理                                                            */
/* ------------------------------------------------------------------ */

function json(statusCode, headers, obj) {
  return {
    statusCode,
    isBase64Encoded: false,
    headers: Object.assign(
      { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      headers
    ),
    body: JSON.stringify(obj),
  };
}

/**
 * @param {{method:string,path:string,headers:object,query:object,ip:string}} req
 * @param {object} [env]
 */
function handleRequest(req, env) {
  const cfg = readConfig(env);
  const method = String(req.method || 'GET').toUpperCase();
  const path = String(req.path || '/').replace(/\/+$/, '') || '/';
  const origin = (req.headers && (req.headers.origin || req.headers.Origin)) || '';
  const cors = corsHeaders(origin, cfg.allowOrigins);

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      isBase64Encoded: false,
      headers: Object.assign({}, cors, {
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '600',
      }),
      body: '',
    };
  }

  if (method !== 'GET') {
    return json(405, cors, { error: '只支持 GET' });
  }

  /* 兼容 API 网关带阶段前缀的路径，如 /release/sign */
  if (path !== '/' && !path.endsWith('/sign')) {
    return json(404, cors, { error: 'not found' });
  }

  if (!originAllowed(origin, cfg.allowOrigins)) {
    return json(403, cors, { error: '来源不允许：' + origin });
  }

  if (!cfg.appid || !cfg.apikey || !cfg.apisecret) {
    return json(500, cors, {
      error: '服务端未配置环境变量 XF_APPID / XF_APIKEY / XF_APISECRET',
    });
  }

  if (!takeToken(req.ip || 'unknown', cfg.rateLimit)) {
    return json(429, cors, { error: '请求太频繁，请稍后再试' });
  }

  return json(200, cors, {
    url: buildSignedUrl(cfg.apikey, cfg.apisecret),
    app_id: cfg.appid,
    expires_in: SIGN_TTL,
  });
}

/* ------------------------------------------------------------------ */
/* 云函数入口                                                           */
/* ------------------------------------------------------------------ */

/**
 * 腾讯云 SCF 函数 URL / 事件函数（兼容 CloudBase、阿里云 FC 的字段）
 * 控制台里执行方法填：sign.main_handler
 */
async function main_handler(event) {
  event = event || {};
  const ctx = event.requestContext || {};
  const headers = event.headers || {};
  /* 函数 URL 用 x-scf-remote-addr 传客户端 IP；API 网关用 x-forwarded-for */
  const ip =
    headers['x-scf-remote-addr'] ||
    (headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    (ctx.identity && ctx.identity.sourceIp) ||
    ctx.sourceIp ||
    'unknown';

  return handleRequest({
    method: event.httpMethod || ctx.httpMethod || 'GET',
    path: event.path || ctx.path || '/',
    headers,
    query: event.queryString || event.queryStringParameters || {},
    ip,
  });
}

/* ------------------------------------------------------------------ */
/* 本地调试                                                             */
/* ------------------------------------------------------------------ */

function loadDotEnv(file) {
  try {
    const txt = require('node:fs').readFileSync(file, 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
      }
    }
  } catch {
    /* 没有 .env 就用现有环境变量 */
  }
}

if (require.main === module) {
  loadDotEnv(require('node:path').join(__dirname, '.env'));
  const port = Number(process.env.PORT || 8787);

  http
    .createServer((req, res) => {
      const u = new URL(req.url, 'http://127.0.0.1');
      let out;
      try {
        out = handleRequest({
          method: req.method,
          path: u.pathname,
          headers: req.headers,
          query: Object.fromEntries(u.searchParams),
          ip: req.socket.remoteAddress || 'local',
        });
      } catch (e) {
        out = json(500, {}, { error: e.message });
      }
      res.writeHead(out.statusCode, out.headers);
      res.end(out.body);
    })
    .listen(port, () => {
      console.log(`签名服务已启动：http://127.0.0.1:${port}/sign`);
      const c = readConfig();
      console.log(c.appid && c.apikey && c.apisecret ? '环境变量：已配置' : '环境变量：缺少 XF_APPID / XF_APIKEY / XF_APISECRET');
    });
}

module.exports = { buildSignedUrl, handleRequest, main_handler };
