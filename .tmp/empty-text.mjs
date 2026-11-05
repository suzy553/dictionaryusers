/* 验证：空文本是否会让讯飞 ISE 返回 8195 */
const SIGN = 'https://1521209936-bs5jkml793.ap-guangzhou.tencentscf.com';
const text = process.argv[2] || '';
const sign = await (await fetch(SIGN + '?svc=ise')).json();
const ws = new WebSocket(sign.url);
const pcm = Buffer.alloc(1280);
let sent = 0, done = false;
const timer = setTimeout(() => finish('timeout'), 15000);
function finish(tag, extra) {
  if (done) return;
  done = true;
  clearTimeout(timer);
  try { ws.close(); } catch {}
  console.log(JSON.stringify(text), tag, extra || '');
  process.exit(0);
}
ws.onopen = () => {
  ws.send(JSON.stringify({
    common: { app_id: sign.app_id },
    business: {
      sub: 'ise', ent: 'en_vip', category: 'read_sentence', cmd: 'ssb',
      text: '\uFEFF' + text, tte: 'utf-8', ttp_skip: true, aue: 'raw',
      auf: 'audio/L16;rate=16000', rstcd: 'utf8', rst: 'entirety',
      ise_unite: '1', extra_ability: 'multi_dimension', group: 'adult',
    },
    data: { status: 0 },
  }));
  const iv = setInterval(() => {
    if (sent < 5) {
      ws.send(JSON.stringify({
        business: { cmd: 'auw', aus: sent === 0 ? 1 : 2 },
        data: { status: 1, data: pcm.toString('base64') },
      }));
      sent++;
    } else {
      clearInterval(iv);
      ws.send(JSON.stringify({ business: { cmd: 'auw', aus: 4 }, data: { status: 2, data: '' } }));
    }
  }, 40);
};
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.code !== 0) return finish('error', m.code + ' ' + m.message);
  if (Number(m.data && m.data.status) === 2) finish('done');
};
