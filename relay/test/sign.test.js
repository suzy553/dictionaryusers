'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSignedUrl, handleRequest } = require('../sign.js');

const ENV = {
  XF_APPID: 'test-appid',
  XF_APIKEY: 'test-key',
  XF_APISECRET: 'test-secret',
  ALLOW_ORIGIN: 'https://suzy553.github.io',
  RATE_LIMIT: '60',
};

function req(over) {
  return Object.assign(
    {
      method: 'GET',
      path: '/sign',
      headers: { origin: 'https://suzy553.github.io' },
      query: {},
      ip: '127.0.0.1',
    },
    over
  );
}

test('签名与独立实现（.NET HMAC）结果一致', () => {
  const url = buildSignedUrl('test-key', 'test-secret', new Date('2026-10-30T08:00:00Z'));
  const u = new URL(url);

  assert.equal(u.protocol, 'wss:');
  assert.equal(u.host, 'ise-api.xfyun.cn');
  assert.equal(u.pathname, '/v2/open-ise');
  assert.equal(u.searchParams.get('host'), 'ise-api.xfyun.cn');
  assert.equal(u.searchParams.get('date'), 'Fri, 30 Oct 2026 08:00:00 GMT');

  const auth = Buffer.from(u.searchParams.get('authorization'), 'base64').toString('utf8');
  assert.match(auth, /api_key="test-key"/);
  assert.match(auth, /algorithm="hmac-sha256"/);
  assert.match(auth, /headers="host date request-line"/);
  assert.match(auth, /signature="pVlv3KKM2QgEYjD5Uu8jvolr0wuCFzfEbWMpuaCOyMI="/);
});

test('GET /sign 返回可用的 wss 地址', () => {
  const r = handleRequest(req(), ENV);
  assert.equal(r.statusCode, 200);
  assert.equal(r.headers['Access-Control-Allow-Origin'], 'https://suzy553.github.io');
  assert.equal(r.headers['Cache-Control'], 'no-store');

  const body = JSON.parse(r.body);
  assert.equal(body.app_id, 'test-appid');
  assert.equal(body.expires_in, 300);
  const u = new URL(body.url);
  assert.equal(u.protocol, 'wss:');
  assert.equal(u.host, 'ise-api.xfyun.cn');
});

test('CORS 预检返回 204 且允许 GET', () => {
  const r = handleRequest(req({ method: 'OPTIONS' }), ENV);
  assert.equal(r.statusCode, 204);
  assert.match(r.headers['Access-Control-Allow-Methods'], /GET/);
  assert.equal(r.headers['Access-Control-Allow-Origin'], 'https://suzy553.github.io');
});

test('陌生来源被拒绝', () => {
  const r = handleRequest(req({ headers: { origin: 'https://evil.example' } }), ENV);
  assert.equal(r.statusCode, 403);
});

test('缺少密钥时返回 500 且说明原因', () => {
  const r = handleRequest(req(), { ALLOW_ORIGIN: '*' });
  assert.equal(r.statusCode, 500);
  assert.match(JSON.parse(r.body).error, /XF_APPID/);
});

test('未知路径返回 404', () => {
  const r = handleRequest(req({ path: '/nope' }), ENV);
  assert.equal(r.statusCode, 404);
});

test('兼容 API 网关的阶段前缀路径', () => {
  const r = handleRequest(req({ path: '/release/sign' }), ENV);
  assert.equal(r.statusCode, 200);
  assert.equal(r.isBase64Encoded, false);
});

test('超过限流返回 429', () => {
  const env = Object.assign({}, ENV, { RATE_LIMIT: '2' });
  const ip = '203.0.113.7';
  assert.equal(handleRequest(req({ ip }), env).statusCode, 200);
  assert.equal(handleRequest(req({ ip }), env).statusCode, 200);
  assert.equal(handleRequest(req({ ip }), env).statusCode, 429);
});

test('腾讯云 SCF 事件格式可用', async () => {
  const { main_handler } = require('../sign.js');
  const r = await main_handler({
    httpMethod: 'GET',
    path: '/sign',
    headers: { origin: 'https://suzy553.github.io' },
    queryString: {},
    requestContext: { identity: { sourceIp: '198.51.100.9' } },
  }, {});
  // 该 handler 读 process.env，这里只验证不抛错、结构正确
  assert.ok([200, 500].includes(r.statusCode));
  assert.equal(typeof r.body, 'string');
});
