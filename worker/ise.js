/**
 * Cloudflare Worker · 讯飞语音评测（ISE）WebSocket 代理
 *
 * 作用：APISecret 只存在 Worker 环境变量里，前端永远拿不到。
 * 前端把 16k/16bit/单声道 PCM 音频流式发上来，Worker 转发给讯飞，
 * 讯飞返回 XML 评分，Worker 原样回传给前端解析。
 *
 * 部署：
 *   cd worker
 *   npm i -D wrangler
 *   npx wrangler secret put XF_APPID
 *   npx wrangler secret put XF_APIKEY
 *   npx wrangler secret put XF_APISECRET
 *   npx wrangler secret put ALLOW_ORIGIN     # https://suzy553.github.io
 *   npx wrangler deploy
 *
 * 前端连接：
 *   wss://<worker>.workers.dev/ise?text=<题目文本>&category=read_sentence
 */

const HOST = 'ise-api.xfyun.cn';
const PATH = '/v2/open-ise';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = env.ALLOW_ORIGIN || '*';

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (url.pathname !== '/ise') {
      return new Response('not found', { status: 404 });
    }

    const upgrade = request.headers.get('Upgrade') || '';
    if (upgrade.toLowerCase() !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const text = (url.searchParams.get('text') || '').slice(0, 500);
    const category = url.searchParams.get('category') || 'read_sentence';
    if (!text) return new Response('missing text', { status: 400 });

    /* 1. 生成讯飞鉴权 URL（APISecret 只在这里出现） */
    const authUrl = await signUrl(env.XF_APIKEY, env.XF_APISECRET);

    /* 2. 连接讯飞 */
    let upstream;
    try {
      upstream = await fetch(authUrl, { headers: { Upgrade: 'websocket' } });
    } catch (e) {
      return new Response('upstream connect failed: ' + e.message, { status: 502 });
    }
    const upWs = upstream.webSocket;
    if (!upWs) return new Response('upstream not websocket', { status: 502 });
    upWs.accept();

    /* 3. 建立到浏览器的 WebSocket */
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    /* 4. 讯飞 → 浏览器 */
    upWs.addEventListener('message', (ev) => {
      try { server.send(ev.data); } catch (e) { }
    });
    upWs.addEventListener('close', () => {
      try { server.close(1000, 'upstream closed'); } catch (e) { }
    });
    upWs.addEventListener('error', () => {
      try { server.close(1011, 'upstream error'); } catch (e) { }
    });

    /* 5. 浏览器 → 讯飞（首帧自动补 ssb 参数帧） */
    let sentParams = false;
    server.addEventListener('message', (ev) => {
      try {
        if (!sentParams) {
          sentParams = true;
          upWs.send(JSON.stringify({
            common: { app_id: env.XF_APPID },
            business: {
              sub: 'ise',
              ent: 'en_vip',
              category: category,
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
              group: 'adult',
            },
            data: { status: 0 },
          }));
        }
        upWs.send(ev.data);
      } catch (e) {
        try { server.close(1011, 'relay failed'); } catch (err) { }
      }
    });

    server.addEventListener('close', () => {
      try { upWs.close(1000, 'client closed'); } catch (e) { }
    });

    return new Response(null, { status: 101, webSocket: client });
  },
};

/* 讯飞 HMAC-SHA256 签名 */
async function signUrl(apiKey, apiSecret) {
  const date = new Date().toUTCString();               // RFC1123, GMT
  const origin = `host: ${HOST}\ndate: ${date}\nGET ${PATH} HTTP/1.1`;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(origin));
  const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  const authOrigin =
    `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
  const authorization = btoa(authOrigin);

  const qs = new URLSearchParams({
    authorization,
    date,
    host: HOST,
  });
  return `wss://${HOST}${PATH}?${qs.toString()}`;
}
