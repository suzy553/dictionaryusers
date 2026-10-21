/* __E2__ */
window.addEventListener('unhandledrejection',function(e){try{document.title='REJ: '+((e.reason&&(e.reason.message||e.reason))||'')}catch(_){}});
window.addEventListener('error',function(e){try{document.title='ERR: '+e.message+' @'+e.lineno}catch(_){}});
/* __E__ */
window.addEventListener('unhandledrejection',function(e){try{document.title='REJ: '+((e.reason&&(e.reason.message||e.reason))||'')}catch(_){}});
window.addEventListener('error',function(e){try{document.title='ERR: '+e.message+' @'+e.lineno}catch(_){}});
/* ==========================================================================
   小越背单词
   纯前端、离线可用、无需构建。数据只存在本机 localStorage。
   ========================================================================== */
'use strict';

const STORE_KEY = 'vocab.shelf.v1';
const BOX_DAYS = [0, 1, 2, 4, 7, 15, 30, 60];
const BOX_NAME = ['新词', '第1天', '第2天', '第4天', '第7天', '第15天', '第30天', '第60天'];
const COLORS = ['#58cc02', '#1cb0f6', '#ff9600', '#ce82ff', '#ff4b4b', '#ffc800', '#00cd9c', '#ff86d0'];

/* 学习路径：每关多少词、每个国家几关 */
const NODE_SIZE = 20;
const NODES_PER_CHAPTER = 10;
const HEARTS_PER_DAY = 20;
const XP = { good: 10, hard: 5, again: 0 };

/* 环游世界的章节风景（纯色 + emoji，无需外部图片） */
const COUNTRIES = [
  { name: '中国', emoji: '🏯', tag: '汉字之城', img: 'cn', sky: ['#fff1e0', '#ffd9b8'] },
  { name: '日本', emoji: '⛩️', tag: '樱花小径', img: 'jp', sky: ['#ffe9f0', '#ffc9dd'] },
  { name: '泰国', emoji: '🐘', tag: '雨林之国', img: 'th', sky: ['#eafaf0', '#bff0d0'] },
  { name: '印度', emoji: '🕌', tag: '香料集市', img: 'in', sky: ['#fff6dd', '#ffe2a3'] },
  { name: '希腊', emoji: '🏛️', tag: '爱琴海边', img: 'gr', sky: ['#e9f7ff', '#c4e9ff'] },
  { name: '意大利', emoji: '🍕', tag: '水城威尼斯', img: 'it', sky: ['#fff0e6', '#ffd2b3'] },
  { name: '法国', emoji: '🗼', tag: '塞纳河畔', img: 'fr', sky: ['#f2ecff', '#d9c8ff'] },
  { name: '英国', emoji: '🎡', tag: '伦敦雾', img: 'gb', sky: ['#eef2ff', '#cfd9ff'] },
  { name: '挪威', emoji: '🏔️', tag: '峡湾深处', img: 'no', sky: ['#eaf4ff', '#c6dfff'] },
  { name: '瑞士', emoji: '🏔️', tag: '阿尔卑斯', img: 'ch', sky: ['#eef8ee', '#c8ecc8'] },
  { name: '荷兰', emoji: '🌷', tag: '风车与运河', img: 'nl', sky: ['#eef6ff', '#cfe6ff'] },
  { name: '西班牙', emoji: '🏰', tag: '巴塞罗那', img: 'es', sky: ['#fff2e2', '#ffd2a0'] },
  { name: '俄罗斯', emoji: '🪆', tag: '红场雪夜', img: 'ru', sky: ['#f0f4ff', '#cdd8ff'] },
  { name: '德国', emoji: '🏰', tag: '新天鹅堡', img: 'de', sky: ['#eef6ee', '#c9e6c9'] },
  { name: '美国', emoji: '🗽', tag: '自由之城', img: 'us', sky: ['#eef4ff', '#c9d8ff'] },
  { name: '加拿大', emoji: '🍁', tag: '枫叶之国', img: 'ca', sky: ['#fff0ee', '#ffd0c9'] },
  { name: '澳洲', emoji: '🦘', tag: '悉尼港湾', img: 'au', sky: ['#eaf6ff', '#c2e0ff'] },
  { name: '新西兰', emoji: '🐑', tag: '中土世界', img: 'nz', sky: ['#eefaf4', '#c6f0dd'] },
  { name: '韩国', emoji: '🏮', tag: '首尔街头', img: 'kr', sky: ['#fdeeff', '#f0c8ff'] },
  { name: '越南', emoji: '⛵', tag: '下龙湾', img: 'vn', sky: ['#e9faf6', '#b9efe0'] },
  { name: '土耳其', emoji: '🕌', tag: '博斯普鲁斯', img: 'tr', sky: ['#fff2e8', '#ffd4b8'] },
  { name: '印度尼西亚', emoji: '🌺', tag: '千岛之国', img: 'id', sky: ['#fff1e3', '#ffd0a8'] },
  { name: '菲律宾', emoji: '🏝️', tag: '七千岛屿', img: 'ph', sky: ['#fff4e2', '#ffd9a8'] },
  { name: '马来西亚', emoji: '🏙️', tag: '双子塔', img: 'my', sky: ['#eef0ff', '#c8cfff'] },
  { name: '新加坡', emoji: '🦁', tag: '狮城夜色', img: 'sg', sky: ['#eaf2ff', '#c2d4ff'] },
  { name: '阿联酋', emoji: '🏗️', tag: '沙漠之城', img: 'ae', sky: ['#fff3dd', '#ffd79a'] },
  { name: '奥地利', emoji: '🎻', tag: '音乐之都', img: 'at', sky: ['#f5fae8', '#dcf0b8'] },
  { name: '芬兰', emoji: '🌌', tag: '极光玻璃屋', img: 'fi', sky: ['#e9f0ff', '#c0d4ff'] },
  { name: '丹麦', emoji: '⛵', tag: '新港彩屋', img: 'dk', sky: ['#fff2e6', '#ffd6b0'] },
  { name: '瑞典', emoji: '🏰', tag: '斯德哥尔摩', img: 'se', sky: ['#fff4e8', '#ffd8b8'] }
];

const PET_ENABLED = false;   /* 爱宠模块已下架（素材有 IP 风险，待重新设计） */
/* ---------------- 小工具 ---------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const pad = n => String(n).padStart(2, '0');
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shiftDay = n => { const d = new Date(); d.setDate(d.getDate() + n); return dateKey(d); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; };
const wordKey = w => String(w).toLowerCase();

let toastTimer;
function toast(msg, ms = 2000) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---------------- 状态 ---------------- */
function defaultState() {
  return {
    v: 1,
    activeBook: 'oxford3000',
    settings: {
      dailyNew: 20, dailyReview: 20,
      accent: 'us', autoplay: true, sound: true, showEnDef: false, liveBg: true,
      reminder: '07:00', theme: 'day'
    },
    progress: {},          // { bookId: { word: {b,d,r,w,last} } }
    history: {},           // { 'YYYY-MM-DD': {n,r,c,t} }
    stats: { streak: 0, lastStudy: '', total: 0, correct: 0, xp: 0 },
    hearts: { n: HEARTS_PER_DAY, date: '' },
    // v200 新增三组状态；老存档没有这些字段时由 loadState 补齐
    checkin: { last: '', streak: 0 },
    challenge: { date: '', id: '', progress: 0, done: false },
    achv: {}
  };
}

let state = loadState();
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    const d = defaultState();
    const merged = {
      ...d, ...s,
      settings: { ...d.settings, ...(s.settings || {}) },
      stats: { ...d.stats, ...(s.stats || {}) },
      hearts: { ...d.hearts, ...(s.hearts || {}) }
    };
    // v200：老用户升级时补齐新字段，脏数据也不能让首页报错
    if (!merged.checkin || typeof merged.checkin !== 'object' || Array.isArray(merged.checkin)) {
      merged.checkin = { last: '', streak: 0 };
    }
    if (typeof merged.checkin.last !== 'string') merged.checkin.last = '';
    if (!Number.isFinite(merged.checkin.streak)) merged.checkin.streak = 0;
    if (!merged.challenge || typeof merged.challenge !== 'object' || Array.isArray(merged.challenge)) {
      merged.challenge = { date: '', id: '', progress: 0, done: false };
    }
    if (!merged.achv || typeof merged.achv !== 'object' || Array.isArray(merged.achv)) merged.achv = {};
    return merged;
  } catch (e) { console.warn('读取进度失败', e); return defaultState(); }
}
function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  catch (e) { console.warn('保存失败', e); toast('存储空间不足，可能无法保存进度'); }
}

/* 今日记录 */
function todayRec() {
  const k = dateKey();
  if (!state.history[k]) state.history[k] = { n: 0, r: 0, c: 0, t: 0, xp: 0 };
  return state.history[k];
}

/* 当前词书自己的今日新词/复习数：从这本词书的进度记录推导，
   换词书后首页的"今日任务"跟着换书，不会带着上一本的数字 */
function bookTodayRec(bookId = state.activeBook) {
  const p = progressOf(bookId);
  const t = dateKey();
  let n = 0, r = 0;
  for (const k in p) {
    const rec = p[k];
    if (!rec) continue;
    if (rec.dt === t) n++;
    else if (rec.last === t) r++;
  }
  return { n, r };
}

/* ---------------- 首次引导 ---------------- */
let obStep = 1, obBook = '', obGoal = 20;

function initOnboard() {
  const box = document.getElementById('onboard');
  if (!box || state.onboarded) return;

  obBook = state.activeBook || (bookIndex[0] && bookIndex[0].id) || '';
  obGoal = state.settings.dailyNew || 20;

  const books = document.getElementById('obBooks');
  if (books) {
    books.innerHTML = bookIndex.map(b =>
      `<button class="ob-book${b.id === obBook ? ' on' : ''}" data-id="${b.id}">${b.title}<em>${b.count} 词</em></button>`
    ).join('');
    books.addEventListener('click', ev => {
      const b = ev.target.closest('.ob-book');
      if (!b) return;
      obBook = b.dataset.id;
      books.querySelectorAll('.ob-book').forEach(x => x.classList.toggle('on', x === b));
    });
  }

  const goal = document.getElementById('obGoal');
  if (goal) {
    goal.addEventListener('click', ev => {
      const b = ev.target.closest('button[data-n]');
      if (!b) return;
      obGoal = Number(b.dataset.n);
      goal.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    });
  }

  const next = document.getElementById('obNext');
  if (next) next.onclick = () => {
    if (obStep < 3) { goObStep(obStep + 1); return; }
    finishOnboard();
  };
  const skip = document.getElementById('obSkip');
  if (skip) skip.onclick = () => finishOnboard(true);

  goObStep(1);
  box.classList.add('is-open');
}

function goObStep(n) {
  obStep = n;
  document.querySelectorAll('.ob-step').forEach(s => s.classList.toggle('is-on', Number(s.dataset.step) === n));
  document.querySelectorAll('.ob-dots i').forEach((d, i) => d.classList.toggle('on', i < n));
  const next = document.getElementById('obNext');
  if (next) next.querySelector('span').textContent = n === 3 ? '开始背单词' : '下一步';
}

async function finishOnboard(skipped) {
  state.onboarded = true;
  if (!skipped) {
    if (obBook && obBook !== state.activeBook) {
      state.activeBook = obBook;
      await loadBook(obBook);
    }
    state.settings.dailyNew = obGoal;
    const t = document.getElementById('obTime');
    if (t && t.value) state.settings.reminder = t.value;
  }
  saveState();
  const box = document.getElementById('onboard');
  if (box) box.classList.remove('is-open');
  renderAll();
  if (!skipped) {
    toast('开始吧！每天进步一点点', 2600);
    // 按钮写的是“开始背单词”，就真的进第一张卡，不再让用户回首页多点一次
    setTimeout(() => { if (!session && remainingNew() > 0) startSession('learn'); }, 320);
  }
}

/* ---------------- 爱心 & 经验 ---------------- */
function ensureHearts() {
  const today = dateKey();
  if (!state.hearts || state.hearts.date !== today) {
    state.hearts = { n: HEARTS_PER_DAY, date: today };
    saveState();
  }
}
function heartsLeft() { return state.hearts ? state.hearts.n : HEARTS_PER_DAY; }

function addXp(n) { state.stats.xp = (state.stats.xp || 0) + n; }

/* 等级曲线：每级所需经验 100 → 135 → 182 …（×1.35） */
function levelInfo(xp = state.stats.xp || 0) {
  let lv = 1, need = 100, acc = 0;
  while (xp >= acc + need && lv < 99) { acc += need; lv++; need = Math.round(need * 1.35); }
  return { lv, cur: xp - acc, need };
}

/* ==========================================================================
   v200 · 每日签到 / 每日挑战 / 成就
   只新增状态字段（checkin / challenge / achv），不动 SRS、爱心与学习流程
   ========================================================================== */

const CHECKIN_XP = 5;
const CHECKIN_HEARTS = 2;
const CHALLENGE_XP = 10;

/* 挑战池：每天用日期做种子挑一个，同一天刷新后还是同一个 */
const CHALLENGES = [
  { id: 'correct30', name: '答对 30 个词', goal: 30, unit: '个', cur: () => Math.floor(todayRec().c || 0) },
  { id: 'review1', name: '完成 1 次复习', goal: 1, unit: '次', cur: () => (((state.challenge && state.challenge.revDone) || (todayRec().r || 0) > 0) ? 1 : 0) },
  { id: 'streak10', name: '连续答对 10 个', goal: 10, unit: '个', cur: () => Math.min(10, (state.challenge && state.challenge.best) || 0) },
  { id: 'new10', name: '学 10 个新词', goal: 10, unit: '个', cur: () => Math.min(10, todayRec().n || 0) },
  { id: 'acc80', name: '答对率不低于 80%', goal: 80, unit: '%', needTen: true, cur: () => { const t = todayRec(); return (t.t || 0) >= 10 ? Math.round((t.c || 0) / t.t * 100) : 0; } },
  { id: 'pet3', name: '在宠物页互动 3 次', goal: 3, unit: '次', cur: () => Math.min(3, (state.challenge && state.challenge.pats) || 0) }
];

function challengeById(id) { return CHALLENGES.find(c => c.id === id); }

/* 日期 → 稳定的 32 位种子（FNV-1a），保证同一天挑到同一个挑战 */
function dateSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* ---------------- 签到 ---------------- */
function ensureDailyCheckin() {
  if (!state.checkin || typeof state.checkin !== 'object' || Array.isArray(state.checkin)) {
    state.checkin = { last: '', streak: 0 };
  }
  if (typeof state.checkin.last !== 'string') state.checkin.last = '';
  if (!Number.isFinite(state.checkin.streak)) state.checkin.streak = 0;
  state.checkin.streak = Math.max(0, Math.floor(state.checkin.streak));
  return state.checkin;
}

function checkinDoneToday() { return ensureDailyCheckin().last === dateKey(); }

/* 连续天数：今天/昨天签过才算数，断了就从 0 重新开始 */
function effectiveCheckinStreak() {
  const c = ensureDailyCheckin();
  if (c.last === dateKey() || c.last === shiftDay(-1)) return c.streak;
  return 0;
}

function doCheckIn() {
  const c = ensureDailyCheckin();
  if (c.last === dateKey()) return;              // 一天只能签一次
  c.streak = c.last === shiftDay(-1) ? c.streak + 1 : 1;
  c.last = dateKey();

  ensureHearts();
  state.hearts.n = Math.min(HEARTS_PER_DAY, heartsLeft() + CHECKIN_HEARTS);
  addXp(CHECKIN_XP);
  const t = todayRec();
  t.xp = (t.xp || 0) + CHECKIN_XP;
  saveState();

  renderHome();
  const num = document.getElementById('ckStreak');
  if (num) { num.classList.remove('is-pop'); void num.offsetWidth; num.classList.add('is-pop'); }
  toast(`签到成功 +${CHECKIN_XP} XP`, 2200);
  checkAchievements();
}

function renderCheckin() {
  const c = ensureDailyCheckin();
  const done = c.last === dateKey();
  const streak = effectiveCheckinStreak();
  const num = document.getElementById('ckStreak');
  if (num) num.textContent = streak;
  const sub = document.getElementById('ckSub');
  if (sub) sub.textContent = done ? `明天再来，已连续 ${streak} 天` : `签到领 ${CHECKIN_XP} XP + ${CHECKIN_HEARTS} 颗心`;
  const btn = document.getElementById('ckBtn');
  if (btn) {
    btn.textContent = done ? '已签到' : '签到';
    btn.classList.toggle('is-done', done);
    btn.disabled = done;
  }
  updateAchvBadge();
}

/* ---------------- 每日挑战 ---------------- */
function ensureDailyChallenge() {
  const today = dateKey();
  if (!state.challenge || typeof state.challenge !== 'object' || Array.isArray(state.challenge)
    || state.challenge.date !== today || !challengeById(state.challenge.id)) {
    const def = CHALLENGES[dateSeed(today) % CHALLENGES.length];
    state.challenge = { date: today, id: def.id, progress: 0, done: false, best: 0, chain: 0, pats: 0, revDone: false };
    saveState();
  }
  const c = state.challenge;
  if (!Number.isFinite(c.progress)) c.progress = 0;
  if (!Number.isFinite(c.best)) c.best = 0;
  if (!Number.isFinite(c.chain)) c.chain = 0;
  if (!Number.isFinite(c.pats)) c.pats = 0;
  c.done = !!c.done;
  c.revDone = !!c.revDone;
  return c;
}

/* 只重算进度，不渲染、不弹提示 */
function recalcChallenge() {
  const c = ensureDailyChallenge();
  const def = challengeById(c.id) || CHALLENGES[0];
  const raw = Number(def.cur()) || 0;
  // 答对率要显示真实百分比；其余挑战封顶到目标值即可
  const _prev = c.progress;
  c.progress = def.needTen
    ? Math.max(0, Math.floor(raw))
    : Math.max(0, Math.min(def.goal, Math.floor(raw)));
  if (_prev !== c.progress) saveState();   /* 修复：进度变了立刻落盘 */
  return { c, def };
}

/* 重算 + 完成判定 + 渲染（答题/复习/宠物互动后调用） */
function refreshChallenge() {
  const { c, def } = recalcChallenge();
  let justDone = false;
  if (!c.done && c.progress >= def.goal) {
    c.done = true;
    justDone = true;
    const t = todayRec();
    t.xp = (t.xp || 0) + CHALLENGE_XP;
    addXp(CHALLENGE_XP);
  }
  saveState();
  renderChallenge();
  if (justDone) {
    toast(`挑战完成 +${CHALLENGE_XP} XP`, 2400);
    checkAchievements();
  }
  return c.done;
}

function bumpChallengeAnswer(kind) {
  const c = ensureDailyChallenge();
  if (kind === 'good') {
    c.chain = (c.chain || 0) + 1;
    c.best = Math.max(c.best || 0, c.chain);
  } else {
    c.chain = 0;
  }
  refreshChallenge();
}

function bumpChallengePet() {
  const c = ensureDailyChallenge();
  c.pats = (c.pats || 0) + 1;
  refreshChallenge();
}

function renderChallenge() {
  const c = ensureDailyChallenge();
  const def = challengeById(c.id) || CHALLENGES[0];
  const card = document.getElementById('chCard');
  const nameEl = document.getElementById('chName');
  const countEl = document.getElementById('chCount');
  const barEl = document.getElementById('chBar');
  if (!card || !nameEl) return;

  let name = def.name;
  let text = `${c.progress}/${def.goal}`;
  if (def.needTen) {
    // 答对率挑战要求至少 10 题，没答够就先提示题量
    const t = todayRec();
    if ((t.t || 0) < 10) { name = `${def.name}（至少 10 题）`; text = `${t.t || 0}/10 题`; }
    else text = `${c.progress}%/${def.goal}%`;
  } else if (def.unit === '%') {
    text = `${c.progress}%/${def.goal}%`;
  }

  nameEl.textContent = name;
  if (countEl) countEl.textContent = text;
  if (barEl) {
    const pct = Math.min(100, c.progress / Math.max(1, def.goal) * 100);
    barEl.style.width = (c.done ? 100 : pct) + '%';
  }
  card.classList.toggle('is-done', !!c.done);
}

/* ---------------- 成就 ---------------- */
const ACHV = [
  { id: 'first_day', name: '初次见面', desc: '完成第一次学习', icon: '🌱' },
  { id: 'streak7', name: '七日不断', desc: '连续签到 7 天', icon: '🔥' },
  { id: 'words100', name: '百词斩', desc: '累计学过 100 词', icon: '💯' },
  { id: 'words500', name: '五百强', desc: '累计学过 500 词', icon: '🏆' },
  { id: 'book_done', name: '全书通关', desc: '背完任意一本词书', icon: '📚' },
  { id: 'perfect10', name: '十连对', desc: '单次会话连续答对 10 个', icon: '⚡' }
];

function totalLearnedWords() {
  let n = 0;
  const all = state.progress || {};
  for (const b in all) {
    const p = all[b];
    if (p && typeof p === 'object') n += Object.keys(p).length;
  }
  return n;
}

function anyBookDone() {
  if (!Array.isArray(bookIndex) || !bookIndex.length) return false;
  for (const b of bookIndex) {
    const p = (state.progress || {})[b.id];
    if (p && typeof p === 'object' && b.count && Object.keys(p).length >= b.count) return true;
  }
  return false;
}

function achvUnlocked(id) {
  return !!(state.achv && typeof state.achv === 'object' && state.achv[id]);
}

function unlockAchv(id) {
  if (achvUnlocked(id)) return false;
  const def = ACHV.find(a => a.id === id);
  if (!def) return false;
  if (!state.achv || typeof state.achv !== 'object' || Array.isArray(state.achv)) state.achv = {};
  state.achv[id] = Date.now();
  saveState();
  toast(`🏅 解锁成就：${def.name}`, 2600);
  return true;
}

function checkAchievements(ctx) {
  const c = ctx || {};
  if (((state.stats && state.stats.total) || 0) > 0 || totalLearnedWords() > 0) unlockAchv('first_day');
  if (effectiveCheckinStreak() >= 7) unlockAchv('streak7');
  const learned = totalLearnedWords();
  if (learned >= 100) unlockAchv('words100');
  if (learned >= 500) unlockAchv('words500');
  if (anyBookDone()) unlockAchv('book_done');
  if ((c.goodStreak || 0) >= 10) unlockAchv('perfect10');

  updateAchvBadge();
  const panel = document.getElementById('achvPanel');
  if (panel && panel.classList.contains('is-open')) renderAchvPanel();
}

function updateAchvBadge() {
  const el = document.getElementById('achvNum');
  if (!el) return;
  const n = ACHV.filter(a => achvUnlocked(a.id)).length;
  el.textContent = n;
  el.classList.toggle('is-zero', n === 0);
}

function fmtAchvDate(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

function renderAchvPanel() {
  const grid = document.getElementById('achvGrid');
  if (!grid) return;
  const got = ACHV.filter(a => achvUnlocked(a.id)).length;
  const cnt = document.getElementById('achvCount');
  if (cnt) cnt.textContent = `${got} / ${ACHV.length}`;
  grid.innerHTML = ACHV.map(a => {
    const ts = state.achv && state.achv[a.id];
    return `<div class="achv-item${ts ? ' is-on' : ''}">`
      + `<span class="achv-ico">${ts ? a.icon : '🔒'}</span>`
      + `<b class="achv-name">${a.name}</b>`
      + `<em class="achv-desc">${a.desc}</em>`
      + `<span class="achv-date">${ts ? '解锁于 ' + fmtAchvDate(ts) : '未解锁'}</span>`
      + `</div>`;
  }).join('');
}

function openAchv() {
  renderAchvPanel();
  const el = document.getElementById('achvPanel');
  if (el) el.classList.add('is-open');
  lockScrollIfNeeded();
}

function closeAchv() {
  const el = document.getElementById('achvPanel');
  if (el) el.classList.remove('is-open');
  lockScrollIfNeeded();
}

/* ---------------- 词库 ---------------- */
let bookIndex = [];
const bookCache = {};
let curBook = null;

async function fetchJSON(url) {
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json();
}

async function initBooks() {
  const idx = await fetchJSON('data/books/index.json');
  bookIndex = idx.books || [];
  if (!bookIndex.some(b => b.id === state.activeBook)) state.activeBook = bookIndex[0]?.id;
  await loadBook(state.activeBook);
}

let wordIndexMap = new Map();

async function loadBook(id) {
  if (!id) return null;
  if (!bookCache[id]) bookCache[id] = await fetchJSON(`data/books/${id}.json`);
  curBook = bookCache[id];
  wordIndexMap = new Map(curBook.words.map((w, i) => [wordKey(w.w), i]));
  return curBook;
}

function progressOf(bookId = state.activeBook) {
  if (!state.progress[bookId]) state.progress[bookId] = {};
  return state.progress[bookId];
}

/* ---------------- 选词 ---------------- */
function dueWords(limit = 999) {
  const p = progressOf();
  const today = dateKey();
  return (curBook?.words || [])
    .filter(w => { const s = p[wordKey(w.w)]; return s && s.d && s.d <= today; })
    .sort((a, b) => {
      const sa = p[wordKey(a.w)], sb = p[wordKey(b.w)];
      return (sa.d || '').localeCompare(sb.d || '') || (sb.w || 0) - (sa.w || 0);
    })
    .slice(0, limit);
}

function newWords(limit) {
  if (limit <= 0) return [];
  const p = progressOf();
  const out = [];
  for (const w of curBook?.words || []) {
    if (p[wordKey(w.w)]) continue;
    out.push(w);
    if (out.length >= limit) break;
  }
  return out;
}

function remainingNew() {
  return Math.max(0, state.settings.dailyNew - bookTodayRec().n);
}
function remainingReview() {
  return Math.max(0, state.settings.dailyReview - bookTodayRec().r);
}

/* ---------------- 发音 ---------------- */
let voices = [];
function refreshVoices() {
  if (!('speechSynthesis' in window)) return;
  voices = speechSynthesis.getVoices() || [];
}
if ('speechSynthesis' in window) {
  refreshVoices();
  speechSynthesis.addEventListener?.('voiceschanged', refreshVoices);
  setTimeout(refreshVoices, 400);
}
function pickVoice(lang) {
  const norm = v => (v.lang || '').replace('_', '-').toLowerCase();
  return voices.find(v => norm(v) === lang)
    || voices.find(v => norm(v).startsWith(lang.slice(0, 2)))
    || null;
}
function playWord(word, accent) {
  /* 策略：先播在线音频（任何设备都能出声），失败再用系统 TTS。
     原因：很多手机的浏览器没有英文语音包，TTS 会静默失败。 */
  const type = accent === 'uk' ? 1 : 2;
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`;

  try {
    if (!window.__phonAudio) window.__phonAudio = new Audio();
    const au = window.__phonAudio;
    au.onerror = () => { ttsFallback(word, accent); };
    au.src = url;
    const p = au.play();
    if (p && p.catch) p.catch(() => ttsFallback(word, accent));
    return;
  } catch (e) { }

  ttsFallback(word, accent);
}

/* TTS 兜底：没网或音频播不了时用 */
function ttsFallback(word, accent) {
  const lang = accent === 'uk' ? 'en-GB' : 'en-US';
  if (!('speechSynthesis' in window)) { toast('这台设备放不出声音'); return; }
  try {
    const v = pickVoice(lang);
    const u = new SpeechSynthesisUtterance(word);
    if (v) u.voice = v;
    u.lang = lang; u.rate = 0.88; u.volume = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch (e) { toast('这台设备放不出声音'); }
}

/* ---------------- 音效（WebAudio 合成，无需音频文件） ---------------- */
let audioCtx = null;
function beep(kind) {
  if (!state.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const notes = kind === 'ok' ? [[660, 0], [990, 0.09]] : kind === 'no' ? [[190, 0]] : [[520, 0], [780, .08], [1040, .16]];
    notes.forEach(([f, t]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = kind === 'no' ? 'sawtooth' : 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, now + t);
      g.gain.exponentialRampToValueAtTime(kind === 'no' ? 0.12 : 0.16, now + t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.18);
      o.connect(g).connect(audioCtx.destination);
      o.start(now + t); o.stop(now + t + 0.2);
    });
  } catch (e) { /* 静默 */ }
}

/* ---------------- 撒花 ---------------- */
const fx = $('#fx');
const fxc = fx.getContext('2d');
let parts = [], fxRaf = 0;
function sizeFx() { fx.width = innerWidth * devicePixelRatio; fx.height = innerHeight * devicePixelRatio; }
addEventListener('resize', sizeFx); sizeFx();

function confetti(n = 90) {
  const W = fx.width, H = fx.height, dpr = devicePixelRatio;
  for (let i = 0; i < n; i++) {
    parts.push({
      x: W / 2 + (Math.random() - .5) * W * .5,
      y: H * .42,
      vx: (Math.random() - .5) * 13 * dpr,
      vy: (-Math.random() * 13 - 4) * dpr,
      g: 0.42 * dpr,
      s: (Math.random() * 6 + 4) * dpr,
      r: Math.random() * 6.28,
      vr: (Math.random() - .5) * .3,
      c: COLORS[Math.random() * COLORS.length | 0],
      life: 1
    });
  }
  if (!fxRaf) loopFx();
}
function loopFx() {
  fxc.clearRect(0, 0, fx.width, fx.height);
  parts = parts.filter(p => p.life > 0 && p.y < fx.height + 60);
  for (const p of parts) {
    p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.995; p.r += p.vr;
    p.life -= 0.004;
    fxc.save(); fxc.translate(p.x, p.y); fxc.rotate(p.r);
    fxc.globalAlpha = Math.max(0, p.life);
    fxc.fillStyle = p.c;
    fxc.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
    fxc.restore();
  }
  if (parts.length) fxRaf = requestAnimationFrame(loopFx);
  else { fxRaf = 0; fxc.clearRect(0, 0, fx.width, fx.height); }
}

/* ---------------- 主界面渲染 ---------------- */
function bookMeta(id) { return bookIndex.find(b => b.id === id); }

function renderHome() {
  const rec = todayRec();
  const br = bookTodayRec();
  const goal = state.settings.dailyNew;
  const done = br.n;
  const pct = clamp(done / Math.max(1, goal), 0, 1);
  // 供吉祥物气泡使用（此前未定义，答过词再回首页会 ReferenceError）
  const leftNew = Math.max(0, goal - done);



  const dc = document.getElementById('dayCount');
  const startDay = state.startedAt || dateKey();
  const dayN = Math.max(1, Math.floor((Date.parse(dateKey()) - Date.parse(startDay)) / 86400000) + 1);
  if (dc) dc.textContent = `今天是你第 ${dayN} 天`;
  $('#streakNum').textContent = displayStreak();

  // 爱心
  ensureHearts();
  const hp = heartsLeft();
  updateHeartsUI();

  // 等级细带
  const lv = levelInfo();
  $('#lvNum').textContent = lv.lv;
  $('#xpToday').textContent = '+' + (rec.xp || 0);
  $('#lvBar').style.width = Math.min(100, (lv.cur / Math.max(1, lv.need)) * 100) + '%';
  $('#lvXp').textContent = `${lv.cur}/${lv.need}`;

  // 当前词书 & 已学词数（后面多处要用）
  const meta = bookMeta(state.activeBook);
  const learned = Object.keys(progressOf()).length;
  const total = meta?.count || 0;
  const bpct = total ? Math.round(learned / total * 100) : 0;
  const learnedCount = learned;

  const tbEl = document.getElementById('tbBook');
  if (tbEl) tbEl.textContent = meta?.title || '选择词书';

  // 今日任务
  const due = dueWords(999).length;
  const revTarget = state.settings.dailyReview;
  const revGoal = Math.min(revTarget, due + br.r);
  const newDone = goal > 0 && done >= goal;
  const hasRev = revGoal > 0;
  const revDone = hasRev ? br.r >= revGoal : false;
  const setText = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
  setText('#taskNewNum', `${done}/${goal}`);
  // 数字只跟当前词书走：没复习完显示还差多少，复习完了显示今天复习了几个
  setText('#taskRevNum', hasRev ? `${revDone ? br.r : due} 词 ›` : `${learned} 词 ›`);
  const nameR = document.querySelector('#taskRev .t-name');
  if (nameR) nameR.textContent = hasRev ? '复习' : '已学';
  setText('#taskCount', `${(newDone ? 1 : 0) + (revDone ? 1 : 0)} / ${hasRev ? 2 : 1}`);
  const rowR = document.getElementById('taskRev');
  if (rowR) rowR.classList.toggle('idle', !hasRev);
  const tkN = $('#tickNew'); if (tkN) tkN.classList.toggle('on', newDone);
  const tkR = $('#tickRev'); if (tkR) tkR.classList.toggle('on', revDone);

  // 连续打卡：最近 7 天
  const dots = [];
  for (let i = 6; i >= 0; i--) {
    const key = shiftDay(-i);
    const hh = state.history[key];
    dots.push({ on: !!(hh && (hh.n + hh.r) > 0), today: i === 0 });
  }
  setText('#weekCount', dots.filter(d => d.on).length);
  setText('#streakDays', `${displayStreak()} 天`);

  // 词书进度（meta/learned 已在上方定义）

  const fab = $('#btnStart');
  const cta = document.getElementById('ctaLabel');
  const allDone = newDone && (hasRev ? revDone : true);
  const badge = document.getElementById('doneBadge');
  if (badge) badge.hidden = !allDone;
  if (fab) {
    fab.disabled = hp <= 0;
    fab.classList.toggle('is-complete', allDone && hp > 0);
  }
  if (cta) {
    cta.textContent = hp <= 0 ? '今天的心用完了'
      : allDone ? '今日已完成 ✓'
        : done >= goal && goal > 0 ? (due > 0 ? '复习旧词' : '再学几个新词')
          : done > 0 ? '继续学习' : '开始今天的学习';
  }


  // v200：签到条 + 每日挑战（只读渲染，完成判定在答题/复习/互动时触发）
  ensureDailyCheckin();
  ensureDailyChallenge();
  renderCheckin();
  renderChallenge();
}


/* ---------------- 活照片：飘落光斑 ---------------- */
function initParticles() {
  const box = document.getElementById('bgFx');
  if (!box || box.childElementCount) return;
  const n = 14;
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i');
    const size = 4 + Math.random() * 5;
    d.style.left = (Math.random() * 100) + '%';
    d.style.width = size.toFixed(1) + 'px';
    d.style.height = size.toFixed(1) + 'px';
    d.style.animationDuration = (14 + Math.random() * 16).toFixed(1) + 's';
    d.style.animationDelay = (-Math.random() * 20).toFixed(1) + 's';
    box.appendChild(d);
  }
}

/* ---------------- 视频底图（针对微信 X5 / iOS 做了兼容） ---------------- */
let videoBgReady = false;

/* ---------------- 已下架模块兼容层 ---------------- */
/* 爱宠模块因素材版权问题整体移除，保留空实现以兼容旧调用点 */
function petHappyNow() { return false; }
function petMood() { return 'idle'; }
function addPetStock() { }
function usePetItem() { return false; }
function updatePetMeters() { }
function flashOwl() { }
function renderPet() { }
function onPetTabEnter() { }
function onPetTabLeave() { }
function cleanupPetTimers() { }

/* ---------------- 主题 ---------------- */
function resolveTheme() {
  const mode = state.settings.theme || 'day';
  return mode === 'night' ? 'night' : 'day';
}

function applyTheme() {
  const t = resolveTheme();
  document.documentElement.setAttribute('data-theme', t);
  try { applyPhoto(); } catch (e) { }
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', t === 'night' ? '#0e1a22' : '#58cc02');
}
function displayStreak() {
  const last = state.stats.lastStudy;
  if (!last) return 0;
  if (last === dateKey() || last === shiftDay(-1)) return state.stats.streak;
  return state.stats.streak > 0 ? 0 : 0;
}

/* ---------------- 词书封面图案（程序化 SVG） ---------------- */
const BOOK_ART = {
  oxford3000: { bg: ['#FFE1F0', '#FFB6D9'], ink: '#C2185B', art: 'book' },
  voa:        { bg: ['#E4F8E9', '#A9EBBE'], ink: '#2E7D32', art: 'mic' },
  cet4:       { bg: ['#FFF0DC', '#FFD08A'], ink: '#B45309', art: 'cap4' },
  cet6:       { bg: ['#FFE0E0', '#FFAFAF'], ink: '#B91C1C', art: 'cap6' },
  ielts:      { bg: ['#FDE7F3', '#F7B4D8'], ink: '#BE185D', art: 'plane' },
  ielts7000:  { bg: ['#E6F6E9', '#A8E4B6'], ink: '#15803D', art: 'plane' },
  toefl:      { bg: ['#E6F3E9', '#B2E6C2'], ink: '#15803D', art: 'torch' },
  kaoyan:     { bg: ['#F0E6FF', '#CDB4FF'], ink: '#6D28D9', art: 'target' },
  gre:        { bg: ['#E3F0FF', '#B7D8FF'], ink: '#1D4ED8', art: 'flask' }
};

function bookArtSVG(kind, ink) {
  const s = `stroke="${ink}" stroke-width="3.4" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  switch (kind) {
    case 'book': return `<svg viewBox="0 0 48 48"><path d="M10 12h13a5 5 0 0 1 5 5v19a4 4 0 0 0-4-4H10z" ${s}/><path d="M38 12H25a5 5 0 0 0-5 5v19a4 4 0 0 1 4-4h14z" ${s}/><path d="M24 17v19" ${s}/></svg>`;
    case 'mic': return `<svg viewBox="0 0 48 48"><rect x="19" y="8" width="10" height="20" rx="5" ${s}/><path d="M13 22a11 11 0 0 0 22 0" ${s}/><path d="M24 33v7M18 40h12" ${s}/></svg>`;
    case 'cap4':
    case 'cap6': return `<svg viewBox="0 0 48 48"><path d="M24 10 6 19l18 9 18-9z" ${s}/><path d="M14 23v9c0 3 4.5 5 10 5s10-2 10-5v-9" ${s}/><text x="24" y="43" font-size="13" font-weight="800" fill="${ink}" text-anchor="middle" stroke="none">${kind === 'cap4' ? '4' : '6'}</text></svg>`;
    case 'plane': return `<svg viewBox="0 0 48 48"><path d="M8 28 40 12l-9 26-7-10z" ${s}/><path d="M24 28l7-8" ${s}/><path d="M6 38c4 3 9 3 13 0" ${s} opacity=".55"/></svg>`;
    case 'torch': return `<svg viewBox="0 0 48 48"><path d="M24 8c5 5 7 9 7 13a7 7 0 0 1-14 0c0-4 2-8 7-13z" ${s}/><path d="M21 28v12h6V28" ${s}/><path d="M16 40h16" ${s}/></svg>`;
    case 'target': return `<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="15" ${s}/><circle cx="24" cy="24" r="8" ${s}/><circle cx="24" cy="24" r="2.4" fill="${ink}" stroke="none"/></svg>`;
    case 'flask': return `<svg viewBox="0 0 48 48"><path d="M20 8h8v11l9 17a3 3 0 0 1-2.6 4.5H13.6A3 3 0 0 1 11 36l9-17z" ${s}/><path d="M16 31h16" ${s}/></svg>`;
    default: return '';
  }
}

function bookCoverHTML(b) {
  const a = BOOK_ART[b.id] || { bg: ['#EEF4EE', '#D8E8DA'], ink: '#3A5C46', art: 'book' };
  return `<div class="book-cover" style="background:linear-gradient(150deg,${a.bg[0]},${a.bg[1]})">${bookArtSVG(a.art, a.ink)}</div>`;
}

/* 卡片底纹：同款图案放大做水印 */
function bookWaterHTML(b) {
  const a = BOOK_ART[b.id] || { art: 'book', ink: '#3A5C46' };
  return `<span class="book-water" aria-hidden="true">${bookArtSVG(a.art, a.ink)}</span>`;
}
function renderBooks() {
  const grid = $('#bookGrid');
  grid.innerHTML = '';
  bookIndex.slice().sort((a, b) => a.count - b.count).forEach(b => {
    const p = state.progress[b.id] || {};
    const learned = Object.keys(p).length;
    const pct = b.count ? learned / b.count * 100 : 0;
    const el = document.createElement('button');
    el.className = 'book-card' + (b.id === state.activeBook ? ' is-active' : '');
    const art = BOOK_ART[b.id] || { bg: ['#EEF4EE', '#D8E8DA'], art: 'book' };
    el.style.setProperty('--tint', art.bg[1]);
    el.innerHTML = `
      ${bookCoverHTML(b)}
      <div class="book-title">${esc(b.title)}</div>
      <div class="book-sub">${esc(b.subtitle || '')}</div>
      <div class="book-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
      <div class="book-foot"><span>${learned} / ${b.count}</span><span>${esc(b.tag || '')}</span></div>`;
    el.onclick = async () => {
      const switched = b.id !== state.activeBook;
      if (switched) {
        state.activeBook = b.id; saveState();
        await loadBook(b.id);
        renderAll();
        toast(`已切换到《${b.title}》`);
      }
      // 直接继续学这本的新词；没有新词就复习，保证点了有反应
      setTimeout(() => {
        if (remainingNew() > 0) startSession('learn');
        else startSession('review');
      }, switched ? 380 : 80);
    };
    grid.appendChild(el);
  });
  if (!bookIndex.length) grid.innerHTML = '<div class="empty">词库加载失败</div>';
}

function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function todayLearnedWords() {
  const p = progressOf();
  const t = shiftDay(0);
  return (curBook?.words || []).filter(w => {
    const rec = p[wordKey(w.w)];
    if (!rec) return false;
    return rec.dt === t || rec.last === t;
  });
}

function yesterdayWords() {
  const p = progressOf();
  const y = shiftDay(-1);
  return (curBook?.words || []).filter(w => {
    const rec = p[wordKey(w.w)];
    return rec && rec.d === y;
  });
}

function wrongWordList() {
  const p = progressOf();
  return (curBook?.words || [])
    .filter(w => (p[wordKey(w.w)]?.w || 0) > 0)
    .sort((a, b) => (p[wordKey(b.w)].w) - (p[wordKey(a.w)].w));
}

function totalLearnedWords() {
  const set = new Set();
  const all = state.progress || {};
  for (const bid in all) {
    const p = all[bid] || {};
    for (const k in p) set.add(k);
  }
  return set.size;
}

function reviewPool() {
  const y = yesterdayWords();
  if (y.length) return { words: y, kind: 'yesterday' };
  const t = todayLearnedWords();
  if (t.length) return { words: t, kind: 'today' };
  const d = dueWords(999);
  if (d.length) return { words: d, kind: 'due' };
  return { words: [], kind: 'none' };
}

function renderReview() {
  const p = progressOf();
  const due = dueWords(999);
  const pool = reviewPool();
  const wrongs = wrongWordList();

  const setT = (sel, v) => { const el = $(sel); if (el) el.textContent = v; };
  setT('#rvWordCount', pool.words.length || wrongs.length ? (pool.words.length || 0) : 0);
  setT('#rvWrongCount', wrongs.length);

  const legend = $('#boxLegend');
  if (legend) {
    const accAll = state.stats.total ? Math.round(state.stats.correct / state.stats.total * 100) : null;
    legend.innerHTML = `
      <span class="legend-chip">已学 ${totalLearnedWords()} 词</span>
      <span class="legend-chip">今天到期 ${due.length}</span>
      <span class="legend-chip">正确率 ${accAll === null ? '—' : accAll + '%'}</span>`;
  }
}

let rvMode = 'words';

function openReviewDetail(mode) {
  rvMode = mode;
  const home = $('#rvHome'), detail = $('#rvDetail');
  const list = $('#rvDetailList');
  const title = $('#rvDetailTitle');
  const startBtn = $('#rvStartBtn');
  if (!home || !detail || !list) return;

  let words, poolKind = 'none';
  if (mode === 'wrong') {
    words = wrongWordList();
  } else {
    const pool = reviewPool();
    words = pool.words;
    poolKind = pool.kind;
  }
  if (title) {
    title.textContent = mode === 'wrong' ? '错题复习'
      : poolKind === 'today' ? '今日新词复习'
      : poolKind === 'due' ? '到期复习'
      : '单词复习';
  }
  if (startBtn) startBtn.disabled = words.length === 0;

  if (!words.length) {
    list.innerHTML = mode === 'wrong'
      ? '<div class="empty">还没有错词<br>答错的单词会自动回到这里</div>'
      : '<div class="empty">还没有可复习的词<br>先背几个新词，回来就能复习</div>';
  } else {
    const p = progressOf();
    list.innerHTML = words.map((w, i) => {
      const rec = p[wordKey(w.w)] || {};
      const ph = w.ph || '';
      const def = (w.t || []).slice(0, 1).join('；');
      return `<div class="rv-item" data-i="${i}">
        <div class="rv-item-main"><b>${esc(w.w)}</b>${ph ? `<em>/${esc(ph)}/</em>` : ''}
          <span class="rv-tap">轻点看释义</span>
        </div>
        <div class="rv-item-sub">${esc(def)}</div>
        ${mode === 'wrong' && rec.w ? `<span class="rv-badge">错 ${rec.w} 次</span>` : ''}
      </div>`;
    }).join('');
  }

  list.querySelectorAll('.rv-item').forEach(it => {
    it.onclick = () => it.classList.toggle('is-open');
  });

  home.hidden = true;
  detail.hidden = false;
}

function closeReviewDetail() {
  const home = $('#rvHome'), detail = $('#rvDetail');
  if (home) home.hidden = false;
  if (detail) detail.hidden = true;
}
function renderSettings() {
  $('#valDailyNew').textContent = state.settings.dailyNew;
  $('#valDailyReview').textContent = state.settings.dailyReview;
  $$('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.themeMode === (state.settings.theme || 'auto')));
  $$('#segAccent button').forEach(b => b.classList.toggle('on', b.dataset.accent === state.settings.accent));
  $('#chkAutoplay').checked = state.settings.autoplay;
  $('#chkSound').checked = state.settings.sound;
  $('#chkEnDef').checked = state.settings.showEnDef;
  $('#inpRemind').value = state.settings.reminder;
  $('#notifyHint').textContent = notifyHint();
}

function notifyHint() {
  if (!('Notification' in window)) return '这台设备/浏览器不支持网页通知，用下面的日历提醒更可靠。';
  if (Notification.permission === 'granted') return '已开启。注意：网页通知只有在 App 打开时才能弹出，7 点定时请用日历提醒。';
  if (Notification.permission === 'denied') return '你之前拒绝过通知权限，需要在浏览器设置里手动允许。';
  return '网页通知只能在你打开 App 时提醒，真正每天 7 点请用上面的日历提醒。';
}

function updateHeartsUI() {
  const hp = heartsLeft();
  const a = $('#heartNum'); if (a) a.textContent = hp;
  const b = $('#sessHeart'); if (b) b.textContent = hp;
  const chip = $('#heartChip');
  if (chip) {
    chip.classList.toggle('low', hp > 0 && hp <= 5);
    chip.classList.toggle('empty', hp <= 0);
  }
}

/* ---------------- 环游世界学习路径 ---------------- */
let pathInfos = [];

function chapterOfNode(n) {
  return COUNTRIES[Math.floor(n / NODES_PER_CHAPTER) % COUNTRIES.length];
}

/* ---------------- 国家风景（程序化 SVG） ---------------- */
const COUNTRY_ISO = {
  '中国':'cn','日本':'jp','泰国':'th','印度':'in','埃及':'eg','希腊':'gr',
  '意大利':'it','法国':'fr','英国':'gb','冰岛':'is','挪威':'no','俄罗斯':'ru',
  '美国':'us','加拿大':'ca','巴西':'br','澳洲':'au','新西兰':'nz','韩国':'kr',
  '越南':'vn','土耳其':'tr'
};
function countryFlag(name) {
  const c = COUNTRY_ISO[name];
  return c ? `<img class="ch-flag" src="data/flags/${c}.webp" alt="">` : '';
}
const COUNTRY_SHAPE = {
  '中国': 'pagoda', '日本': 'torii', '泰国': 'temple', '印度': 'dome',
  '埃及': 'pyramid', '希腊': 'column', '意大利': 'colosseum', '法国': 'tower',
  '英国': 'bigben', '冰岛': 'mountain', '挪威': 'fjord', '俄罗斯': 'onion',
  '美国': 'liberty', '加拿大': 'maple', '巴西': 'palm', '澳洲': 'uluru',
  '新西兰': 'mountain', '韩国': 'hanok', '越南': 'boat', '土耳其': 'mosque'
};

function landmarkPath(shape) {
  switch (shape) {
    case 'pagoda': return '<path d="M-16 0 h32 l-4 -7 h-24 z M-12 -7 h24 l-3 -6 h-18 z M-8 -13 h16 l-2 -5 h-12 z M-2 -18 h4 v-4 h-4 z"/>';
    case 'torii': return '<path d="M-18 -2 h36 v4 h-36 z M-14 -8 h28 v4 h-28 z M-12 -8 v-16 h4 v16 z M8 -8 v-16 h4 v16 z"/>';
    case 'temple': return '<path d="M-18 0 h36 v-3 h-36 z M-14 -3 l4 -12 h20 l4 12 z M0 -15 v-6"/><circle cx="0" cy="-24" r="3"/>';
    case 'dome': return '<path d="M-16 0 h32 v-9 h-32 z"/><path d="M-13 -9 a13 13 0 0 1 26 0 z"/><path d="M0 -22 v-5"/>';
    case 'pyramid': return '<path d="M-20 0 L-4 -26 L12 0 z M2 0 L14 -16 L26 -1 z"/>';
    case 'column': return '<path d="M-18 0 h36 v-3 h-36 z M-12 -3 h24 v-16 h-24 z M-16 -19 h32 v-3 h-32 z"/>';
    case 'colosseum': return '<path d="M-20 0 h40 v-14 a20 10 0 0 0 -40 0 z M-12 -4 h4 v6 h-4 z M-4 -4 h4 v6 h-4 z M4 -4 h4 v6 h-4 z"/>';
    case 'tower': return '<path d="M-6 0 h12 l-2 -18 h-8 z M-10 -18 h20 v-4 h-20 z M0 -22 v-8"/>';
    case 'bigben': return '<path d="M-6 0 h12 v-20 h-12 z M-9 -20 h18 l-9 -10 z"/><circle cx="0" cy="-14" r="3.5" fill="none" stroke-width="2"/>';
    case 'mountain': return '<path d="M-24 0 L-8 -20 L4 -6 L12 -16 L26 0 z"/>';
    case 'fjord': return '<path d="M-24 0 L-14 -16 L-6 -4 L4 -18 L14 -2 L24 0 z"/>';
    case 'onion': return '<path d="M0 -30 c8 6 8 14 0 16 c-8 -2 -8 -10 0 -16 z M-3 -14 h6 v14 h-6 z"/>';
    case 'liberty': return '<path d="M-4 0 h8 v-18 h-8 z M0 -18 v-8"/><circle cx="0" cy="-29" r="3"/><path d="M-6 -26 l-6 -6"/>';
    case 'maple': return '<path d="M0 -26 l4 9 8 -3 -3 8 8 3 -8 4 3 7 -12 -4 -12 4 3 -7 -8 -4 8 -3 -3 -8 8 3 z"/>';
    case 'palm': return '<path d="M0 0 v-20 M0 -20 c-8 -6 -14 -4 -18 2 c8 -2 12 0 18 2 M0 -20 c8 -6 14 -4 18 2 c-8 -2 -12 0 -18 2 M0 -20 c-4 -8 -2 -12 2 -16 c2 6 2 10 -2 16"/>';
    case 'uluru': return '<path d="M-26 0 c6 -14 16 -20 26 -20 s20 8 26 20 z"/>';
    case 'hanok': return '<path d="M-18 0 h36 v-10 h-36 z M-22 -10 l22 -12 22 12 z"/>';
    case 'boat': return '<path d="M-18 0 h36 l-6 -8 h-24 z M0 -8 v-14 l12 8 z"/>';
    case 'mosque': return '<path d="M-16 0 h32 v-12 h-32 z"/><path d="M-10 -12 a10 10 0 0 1 20 0 z"/><path d="M10 -6 v-18 l3 4"/>';
    default: return '<path d="M-20 0 h40 v-12 h-40 z"/>';
  }
}

function countrySceneSVG(country, seed) {
  const shape = COUNTRY_SHAPE[country.name] || 'mountain';
  const [c1, c2] = country.sky;
  const sunX = 24 + (seed * 17) % 52;
  return `<svg viewBox="0 0 120 90" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="sky${seed}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
    </defs>
    <rect width="120" height="90" fill="url(#sky${seed})"/>
    <circle cx="${sunX}" cy="24" r="10" fill="#fff" opacity=".55"/>
    <path d="M0 62 q22 -14 44 -2 q26 -12 46 2 q16 -6 30 0 v28 H0 z" fill="#ffffff" opacity=".55"/>
    <path d="M0 70 q30 -10 60 0 q30 10 60 0 v20 H0 z" fill="#2E7D52" opacity=".22"/>
    <g transform="translate(96 82) scale(0.62)" fill="#4A3A28" opacity=".72">${landmarkPath(shape)}</g>
  </svg>`;
}

function sceneURL(country, seed) {
  const svg = countrySceneSVG(country, seed);
  // 注意：style 属性用双引号，这里必须用单引号，且把内部的单引号编码掉
  const enc = encodeURIComponent(svg).replace(/'/g, '%27');
  return "url('data:image/svg+xml," + enc + "')";
}
let openChapters = new Set();

function renderPath() {
  const wrap = $('#pathWrap');
  if (!wrap) return;
  if (!curBook) { wrap.innerHTML = ''; return; }

  const words = curBook.words;
  const p = progressOf();
  const totalNodes = Math.ceil(words.length / NODE_SIZE);
  const chapters = Math.ceil(totalNodes / NODES_PER_CHAPTER);

  // 逐关统计，顺序解锁
  pathInfos = [];
  let unlocked = true;
  for (let n = 0; n < totalNodes; n++) {
    const ws = words.slice(n * NODE_SIZE, (n + 1) * NODE_SIZE);
    let learned = 0;
    for (const w of ws) if (p[wordKey(w.w)]) learned++;
    /* 两种达成方式：全部词学完，或者闯关通过 */
    const quizPassed = !!(state.quizPass && state.quizPass[n]);
    const done = (learned >= ws.length) || quizPassed;
    pathInfos.push({ n, ws, learned, size: ws.length, done, unlocked, quizPassed });
    unlocked = unlocked && done;
  }

  // 当前进度所在章节（学过日本就定位日本）
  const firstUndone = pathInfos.findIndex(i => !i.done);
  const curChapter = firstUndone < 0 ? chapters - 1 : Math.floor(firstUndone / NODES_PER_CHAPTER);
  const autoOpen = openChapters.size === 0;   // 首次进入：全部收起，随后动画展开当前章

  let html = '';
  for (let c = 0; c < chapters; c++) {
    const country = COUNTRIES[c % COUNTRIES.length];
    const s = c * NODES_PER_CHAPTER;
    const e = Math.min(s + NODES_PER_CHAPTER, totalNodes);
    let lc = 0, sc = 0;
    for (let n = s; n < e; n++) { lc += pathInfos[n].learned; sc += pathInfos[n].size; }
    const pct = sc ? (lc / sc * 100) : 0;

    const isOpen = openChapters.has(c);
    const doneNodes = pathInfos.slice(s, e).filter(i => i.done).length;
    html += `<section class="chapter ${isOpen ? 'is-open' : ''}" data-ch="${c}">
      <header class="chapter-head" role="button" tabindex="0" style="--sky1:${country.sky[0]};--sky2:${country.sky[1]};background-image:${country.img ? `url('data/countries/${country.img}.jpg')` : sceneURL(country, c)}">
        <h3>${countryFlag(country.name)}${country.name}</h3>
        <p>${country.tag} · 第 ${c + 1} 章 · ${lc}/${sc} 词</p>
        <div class="ch-emoji">${country.emoji}</div>
        <div class="ch-progress"><i style="width:${pct.toFixed(1)}%"></i></div>
        <span class="ch-meta">${doneNodes}/${e - s} 关</span>
        <span class="ch-caret" aria-hidden="true">›</span>
      </header>
      <div class="chapter-body" style="height:${(e - s) * 76}px">`;

    const pts = [];
    for (let i = 0; i < e - s; i++) {
      const n = s + i;
      pts.push([50 + Math.sin(n * 0.9) * 26, i * 76 + 26]);
    }
    const d = pts.map((pt, i) => `${i ? 'L' : 'M'}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join(' ');
    html += `<svg class="path-line" viewBox="0 0 100 ${(e - s) * 76}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${d}" vector-effect="non-scaling-stroke"/></svg>`;

    for (let i = 0; i < e - s; i++) {
      const n = s + i, info = pathInfos[n];
      const x = 50 + Math.sin(n * 0.9) * 26;
      const st = info.done ? 'done' : (info.unlocked ? 'current' : 'locked');
      const badge = info.done ? '✓' : (info.unlocked ? '' : '🔒');
      const ang = 140 + (n * 23) % 70;
      html += `<button class="node ${st}" data-node="${n}"
        style="left:calc(${x.toFixed(1)}% - 32px);top:${i * 76}px;--sky1:${country.sky[0]};--sky2:${country.sky[1]};--ang:${ang}deg;--scene:${sceneURL(country, c)}"
        aria-label="第 ${n + 1} 关 · ${country.name}，已学 ${info.learned}/${info.size}">
        <span class="face">${country.emoji}</span>${badge ? `<i class="badge">${badge}</i>` : ''}</button>`;
    }
    html += '</div></section>';
  }
  wrap.innerHTML = html;

  wrap.querySelectorAll('.chapter-head').forEach(h => {
    h.onclick = () => {
      const sec = h.parentElement;
      const c = Number(sec.dataset.ch);
      const open = !sec.classList.contains('is-open');
      sec.classList.toggle('is-open', open);
      if (open) openChapters.add(c); else openChapters.delete(c);
    };
  });

  // 预取当前章与下一章的背景图（切关不再白屏）
  try {
    const _cc = (typeof curChapter === 'number') ? curChapter : 0;
    const _nc = Math.min(chapters - 1, _cc + 1);
    [_cc, _nc].forEach(ci => {
      const cty = COUNTRIES[ci % COUNTRIES.length];
      if (cty && cty.img) { const im = new Image(); im.src = 'data/countries/' + cty.img + '.jpg'; }
    });
  } catch (e) { }

  if (autoOpen) {
    const target = wrap.querySelector(`.chapter[data-ch="${curChapter}"]`);
    // 先让浏览器画一帧"全收起"的状态，再加类触发展开过渡
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (!target) return;
        target.classList.add('is-open');
        openChapters.add(curChapter);
        setTimeout(() => target.scrollIntoView({ block: 'start', behavior: 'smooth' }), 260);
      }, 180);
    });
  } else {
    const cur = wrap.querySelector('.chapter.is-open');
    if (cur) setTimeout(() => cur.scrollIntoView({ block: 'start', behavior: 'smooth' }), 120);
  }
}

function startNodeSession(info) {
  const p = progressOf();
  const fresh = info.ws.filter(w => !p[wordKey(w.w)]);
  // 关卡所属国家 -> 背单词页模糊背景
  const country = COUNTRIES[Math.floor(info.n / NODES_PER_CHAPTER) % COUNTRIES.length];
  applyStudyBg(country);
  startSession('node', fresh.length ? fresh : info.ws);
}

function renderAll() {
  renderHome();
  requestAnimationFrame(syncScene);
  setTimeout(syncScene, 120);
  setTimeout(syncScene, 400);
  setTimeout(syncScene, 900);
  renderBooks();
  renderReview();
  renderSettings();
  renderPath();
  if (typeof renderPet === 'function') renderPet();
}

/* ---------------- 面板下拉：露出完整画面 ---------------- */
function initSheetDrag() {
  const sheet = document.querySelector('#screen-home .sheet');
  const grab = sheet && sheet.querySelector('.sheet-grab');
  if (!sheet || !grab) return;
  if (sheet.dataset.drag) return;
  sheet.dataset.drag = '1';

  let startY = 0, dy = 0, dragging = false, moved = false;
  const maxDown = () => {
    const tabH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tab-h')) || 64;
    return Math.max(0, sheet.offsetHeight - tabH - 30);
  };

  const setY = y => { sheet.style.transform = 'translateY(' + y + 'px)'; };

  const collapse = () => {
    sheet.classList.add('is-collapsed');
    sheet.style.transition = 'transform .34s cubic-bezier(.2,.9,.3,1)';
    setY(maxDown());
  };
  const expand = () => {
    sheet.classList.remove('is-collapsed');
    sheet.style.transition = 'transform .34s cubic-bezier(.2,.9,.3,1)';
    setY(0);
  };

  grab.addEventListener('pointerdown', e => {
    dragging = true; moved = false; startY = e.clientY; dy = 0;
    sheet.style.transition = 'none';
    try { grab.setPointerCapture(e.pointerId); } catch (err) { }
  });

  grab.addEventListener('pointermove', e => {
    if (!dragging) return;
    dy = e.clientY - startY;
    if (Math.abs(dy) > 4) moved = true;
    // 已收起时从收起位置继续拖
    const base = sheet.classList.contains('is-collapsed') ? maxDown() : 0;
    const y = Math.min(maxDown(), Math.max(0, base + dy));
    setY(y);
  });

  const finish = e => {
    if (!dragging) return;
    dragging = false;
    const base = sheet.classList.contains('is-collapsed') ? maxDown() : 0;
    const y = Math.min(maxDown(), Math.max(0, base + dy));
    if (!moved) {                       // 只是点了一下 → 切换
      sheet.classList.contains('is-collapsed') ? expand() : collapse();
      return;
    }
    if (y > maxDown() * 0.35) collapse(); else expand();
  };
  // 进场：先呈现整幅画面，再让面板缓缓升起
  const introDown = () => {
    sheet.style.transition = 'none';
    setY(maxDown());
  };
  const intro = () => {
    if (sheet.dataset.introDone === '1') return;
    sheet.dataset.introDone = '1';
    sheet.style.transition = 'transform 1.35s cubic-bezier(.25,.9,.3,1)';
    setY(0);
  };
  window.__sheetIntroDown = introDown;
  window.__sheetIntro = intro;
  window.__startIntro = () => { introDown(); setTimeout(intro, 320); };

  // 调试/截图用：?sheet=down 直接呈现收起态
  if (new URLSearchParams(location.search).get('sheet') === 'down') {
    setTimeout(collapse, 500);
  }

  grab.addEventListener('pointerup', finish);
  grab.addEventListener('pointercancel', finish);
  grab.addEventListener('pointerleave', e => { if (dragging) finish(e); });
}
/* ---------------- 开屏动画 ---------------- */

/* 判断是否应该走"省流模式"：弱网、省流量、或内存很小的设备 */
function prefersLiteAssets() {
  try {
    if (navigator.connection) {
      const c = navigator.connection;
      if (c.saveData) return true;
      const t = c.effectiveType || '';
      if (t === 'slow-2g' || t === '2g' || t === '3g') return true;
    }
    if (navigator.deviceMemory && navigator.deviceMemory <= 2) return true;
  } catch (e) { }
  return false;
}

function initSplash() { /* 素材已下架，静态显示 */ }
/* ---------------- 图片底图 ---------------- */
let photoBg = { day: '', night: '' };

function applyPhoto() {
  const html = document.documentElement;
  const scene = document.querySelector('.bg-scene');
  if (!scene) return;
  const night = html.getAttribute('data-theme') === 'night';
  const url = night ? (photoBg.night || photoBg.day) : photoBg.day;
  const heroEl = document.getElementById('heroView');
  if (heroEl) heroEl.style.backgroundImage = url ? `url("${url}")` : '';
  if (url) {
    scene.style.backgroundImage = `url("${url}")`;
    scene.style.backgroundSize = 'cover';
    scene.style.backgroundPosition = 'center';
    scene.style.backgroundRepeat = 'no-repeat';
    html.classList.add('has-photo-bg');
  } else {
    scene.style.backgroundImage = '';
    html.classList.remove('has-photo-bg');
  }
}

function initPhotoBg() {
  const list = ['data/bg-day.jpg'];   /* 只留真实存在的，避免 404 噪音 */
  let i = 0;
  const step = () => {
    if (i >= list.length) { applyPhoto(); return; }
    const url = list[i++];
    const img = new Image();
    img.onload = () => { photoBg.day = url; photoBg.ratio = img.naturalWidth / Math.max(1, img.naturalHeight); applyPhoto(); };
    img.onerror = step;
    img.src = url;
  };
  step();
}
/* 已知会劫持网页视频、弹自家播放器的浏览器 */
const HIJACK_UA = /(MQQBrowser|QQBrowser|MicroMessenger|UCBrowser|Quark|HuaweiBrowser|MiuiBrowser|baiduboxapp)/i;

function videoHijackRisk() {
  try { return HIJACK_UA.test(navigator.userAgent || ''); } catch (e) { return false; }
}

/* 退回纯静态图，并记住这个浏览器别再试了 */
function fallbackToStill(silent) {
  const v = document.getElementById('bgVideo');
  document.documentElement.classList.remove('has-video-bg');
  if (v) {
    try { v.pause(); } catch (e) { }
    v.removeAttribute('src');
    try { v.load(); } catch (e) { }
  }
  state.settings.videoBlocked = true;
  saveState();
  /* 静默处理，不打扰用户 */
}

function initVideoBg() { /* 素材已下架，静态显示 */ }
function offerPlayButton() {
  const box = document.getElementById('heroQuote');
  if (!box || document.getElementById('bgPlayBtn')) return;
  if (document.documentElement.classList.contains('has-video-bg')) return;
  const b = document.createElement('button');
  b.id = 'bgPlayBtn';
  b.type = 'button';
  b.className = 'bg-play-pill';
  b.textContent = '▶ 开启动态背景';
  b.onclick = ev => {
    ev.stopPropagation();
    state.settings.forceVideo = true;
    state.settings.videoBlocked = false;
    saveState();
    document.documentElement.classList.remove('has-video-bg');
    initVideoBg();
    b.textContent = '正在加载…';
    setTimeout(() => {
      if (document.documentElement.classList.contains('has-video-bg')) b.remove();
      else { b.textContent = '这个浏览器不支持，已用静态图'; setTimeout(() => b.remove(), 2200); }
    }, 2600);
  };
  box.appendChild(b);
}
/* ---------------- 首页每日一句 ---------------- */
async function initQuote() {
  const el = document.getElementById('gNewsText');
  if (!el) return;
  try {
    const d = await fetchJSON('data/quotes.json');
    const list = d.quotes || [];
    if (!list.length) throw new Error('empty');
    const day = Math.floor(Date.now() / 86400000);
    const q = list[day % list.length];
    el.textContent = q.en;
    const zh = document.getElementById('quoteZh');
    if (zh) zh.textContent = (q.by ? '— ' + q.by + ' · ' : '— ') + (q.zh || '');
    const inl = document.getElementById('gNewsInline');
    if (inl) inl.textContent = q.en + (q.by ? ' — ' + q.by : '');
  } catch (e) {
    el.textContent = 'The journey of a thousand miles begins with a single step.';
  }
}

/* ---------------- 新闻 ---------------- */
async function initNews() {
  try {
    const n = await fetchJSON('data/news.json');
    const items = n.items || [];
    if (!items.length) throw new Error('empty');
    const it = items[0];
    const nDate = $('#newsDate');
    if (nDate) nDate.textContent = it.date || '';
    const nTitle = $('#newsTitle');
    if (nTitle) nTitle.textContent = it.title || '';
    const nDesc = $('#newsDesc');
    if (nDesc) nDesc.textContent = it.summary || '';
    const link = $('#newsLink');
    if (link) {
      if (it.link) { link.href = it.link; link.style.display = ''; } else link.style.display = 'none';
    }
    const card = $('#newsCard');
    if (card) card.style.display = '';
  } catch (e) {
    const gLine = document.getElementById('gNewsText');
    if (gLine) gLine.textContent = '今天没有新闻';
    const card = $('#newsCard');
    if (card) card.style.display = 'none';
  }
}

/* ---------------- 学习会话 ---------------- */
let session = null;
/* 结算页给用户的"下一步"：act = learn / review / books / home */
let sumNext = { act: 'home', msg: '' };

function applyStudyBg(country) {
  const bgEl = document.getElementById('sessBg');
  if (!bgEl) return;
  if (!country) {
    const infos = (typeof pathInfos !== 'undefined' && pathInfos) ? pathInfos : [];
    const cur = infos.find(i => !i.done) || infos[infos.length - 1];
    if (cur) country = COUNTRIES[Math.floor(cur.n / NODES_PER_CHAPTER) % COUNTRIES.length];
  }
  if (country && country.img) {
    bgEl.src = 'data/countries/' + country.img + '.jpg';
    bgEl.style.display = 'block';
  } else {
    bgEl.removeAttribute('src');
    bgEl.style.display = 'none';
  }
}

function suggestNextBook() {
  const others = bookIndex.filter(b => b.id !== state.activeBook).sort((a, b) => a.count - b.count);
  const next = others[0];
  const done = bookIndex.find(b => b.id === state.activeBook);
  if (!next) {
    toast('所有词书都背完啦，太厉害了 🎉', 2600);
    return;
  }
  const msg = `${done ? `《${done.title}》全书背完啦 🎉 推荐接着背《${next.title}》` : `推荐背《${next.title}》`}`;
  toast(msg, 3200);
  go('books');
  setTimeout(() => {
    const cards = document.querySelectorAll('.book-card');
    for (const c of cards) {
      if (c.textContent.includes(next.title)) {
        c.classList.add('is-suggest');
        c.scrollIntoView({ block: 'center', behavior: 'smooth' });
        break;
      }
    }
  }, 420);
}

function lockScrollIfNeeded() {
  const anyOpen = document.getElementById('session')?.classList.contains('is-open')
    || document.getElementById('summary')?.classList.contains('is-open')
    || document.getElementById('achvPanel')?.classList.contains('is-open');
  document.documentElement.classList.toggle('overlay-open', !!anyOpen);
}

function startSession(kind, override) {
  if (heartsLeft() <= 0) { toast('今天的心用完了，明天 0 点恢复 ❤️'); return; }
  let queue = [];

  if (override && override.length) {
    queue = override.map(w => ({ w, isNew: !progressOf()[wordKey(w.w)] }));
  } else if (kind === 'review') {
    let pool = dueWords(state.settings.dailyReview);
    if (!pool.length) pool = todayLearnedWords();   // 没有到期的，就复习今天刚学的
    queue = pool.map(w => ({ w, isNew: false }));
  } else {
    const rev = dueWords(remainingReview()).map(w => ({ w, isNew: false }));
    // 每日额度用完也继续给新词：一次再来一批，学到不想学为止
    const quota = remainingNew();
    const batch = quota > 0 ? quota : Math.max(state.settings.dailyNew || 20, 10);
    const nw = newWords(batch).map(w => ({ w, isNew: true }));
    queue = [...rev, ...nw];
  }

  if (!queue.length) {
    if (kind === 'review') toast('暂无到期要复习的词');
    else if (!newWords(1).length) suggestNextBook();
    else toast('这本词书已经背完啦');
    return;
  }

  session = {
    kind,
    queue,
    i: 0,
    total: queue.length,
    answered: 0,
    correct: 0,
    newCount: 0,
    reviewCount: 0,
    revealed: false,
    lockAns: false
  };
  applyStudyBg(null);
  $('#session').classList.add('is-open'); lockScrollIfNeeded();
  $('#summary').classList.remove('is-open');
  showCard();
}

function showCard() {
  if (!session) return;
  if (session.i >= session.queue.length) return finishSession();

  const item = session.queue[session.i];
  const w = item.w;
  session.revealed = false;
  session.lockAns = false;

  const p = progressOf()[wordKey(w.w)];
  const isReview = !item.isNew && !!p;

  const card = $('#wordCard');
  card.classList.remove('revealed', 'shake', 'flash-ok', 'pop');

  // 这一关属于哪个国家 —— 整张卡变成那里的风景
  const idx = wordIndexMap.get(wordKey(w.w)) || 0;
  const country = chapterOfNode(Math.floor(idx / NODE_SIZE));
  card.style.setProperty('--sky1', country.sky[0]);
  card.style.setProperty('--sky2', country.sky[1]);
  const em = $('#cardEmoji');
  if (em) em.textContent = country.emoji;

  $('#wcBadge').textContent = isReview ? '复习' : '新词';
  $('#wcBadge').className = 'wc-badge' + (isReview ? ' rev' : '');
  $('#wcWord').textContent = w.w;
  $('#wcUs').textContent = w.us ? `/${w.us}/` : '—';
  $('#wcUk').textContent = w.uk ? `/${w.uk}/` : '—';

  $('#wcTrans').innerHTML = (w.t || []).map(t => `<div>${esc(t)}</div>`).join('');
  const def = $('#wcDef');
  def.textContent = state.settings.showEnDef && w.d ? w.d : '';
  def.style.display = state.settings.showEnDef && w.d ? '' : 'none';

  const sent = $('#wcSent'), sentZh = $('#wcSentZh');
  if (w.s) {
    sent.innerHTML = highlight(w.s, w.w);
    sentZh.textContent = w.sz || '';
    sentZh.style.display = w.sz ? '' : 'none';
    sent.style.display = '';
  } else {
    sent.innerHTML = '<span class="none">这个词暂无例句</span>';
    sentZh.style.display = 'none';
    sent.style.display = '';
  }

  $('#feedback').className = 'feedback';
  $('#feedback').textContent = '';
  $('#sessActions').classList.remove('hidden');
  $('#sessNext').classList.add('hidden');
  updateSessBar();

  if (state.settings.autoplay) setTimeout(() => playWord(w.w, state.settings.accent), 180);
}

function highlight(sentence, word) {
  const safe = esc(sentence);
  const stem = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/(ate|ing|ed|es|s)$/i, '');
  try {
    return safe.replace(new RegExp(`\\b(${stem}[a-z]*)`, 'gi'), '<b>$1</b>');
  } catch (e) { return safe; }
}

function updateSessBar() {
  if (!session) return;
  const pct = session.answered / Math.max(1, session.total);
  $('#sessBar').style.width = (pct * 100) + '%';
  $('#sessDone').textContent = session.answered;
  $('#sessTotal').textContent = session.total;
  const sh = $('#sessHeart');
  if (sh) sh.textContent = heartsLeft();
}

function revealCard() {
  if (!session || session.revealed) return;
  session.revealed = true;
  $('#wordCard').classList.add('revealed');
}

/* 学习页吉祥物情绪（缺失时安全降级） */
function mascotMood(mood) {
  try {
    const el = document.getElementById('sessMascot') || document.querySelector('.sess-mascot');
    if (!el) return;
    el.classList.remove('is-happy', 'is-sad');
    if (mood === 'happy') el.classList.add('is-happy');
    if (mood === 'sad') el.classList.add('is-sad');
  } catch (e) { }
}

function answer(kind) {
  if (!session || session.lockAns) return;
  if (!session.revealed) { revealCard(); toast('先看一眼释义，再判断'); return; }

  const item = session.queue[session.i];
  const w = item.w;
  const key = wordKey(w.w);
  const p = progressOf();
  const rec = p[key] || { b: 0, d: dateKey(), r: 0, w: 0, last: '' };
  const isFirstSeen = !p[key];
  if (isFirstSeen) rec.dt = dateKey();

  if (kind === 'good') {
    rec.b = clamp((rec.b || 0) + 1, 0, 7);
    rec.r = (rec.r || 0) + 1;
    rec.d = shiftDay(BOX_DAYS[rec.b]);
    session.correct++;
    beep('ok');
    mascotMood('happy');
    $('#wordCard').classList.add('flash-ok', 'pop');
    giveFeedback('ok', pick(['太棒了！', '记牢了 👏', '很好，继续保持', '这个稳了']) + `　下次复习：${BOX_NAME[rec.b]}`);
  } else if (kind === 'hard') {
    rec.b = clamp(rec.b || 1, 1, 7);
    rec.d = shiftDay(1);
    session.correct += 0.5;
    beep('mid');
    mascotMood('happy');
    giveFeedback('ok', `有点印象就好　明天再见一次`);
  } else {
    rec.b = 0;
    rec.w = (rec.w || 0) + 1;
    rec.d = dateKey();
    session.correct += 0;
    beep('no');
    mascotMood('sad');
    addPetStock(item.isNew ? 'food' : 'water', 1);
    state.hearts.n = Math.max(0, heartsLeft() - 1);
    updateHeartsUI();
    if (state.hearts.n === 5 && !state.hearts.warned) {
      state.hearts.warned = true;
      saveState();
      toast('还剩 5 颗心，答错会扣光哦 ❤️', 2600);
    }
    $('#wordCard').classList.add('shake');
    giveFeedback('no', `没关系，记下来　马上再考你一次`);
    if (!item.repeated && session.queue.length < 400) {
      session.queue.push({ ...item, repeated: true });
      session.total = session.queue.length;
    }
  }
  rec.last = dateKey();
  p[key] = rec;

  const t = todayRec();
  if (!item.repeated) {          // 同一词本次重复考核不重复计数
    if (isFirstSeen && item.isNew) { t.n++; session.newCount++; }
    else { t.r++; session.reviewCount++; }
    t.t++;
    if (kind === 'good') t.c++;
    else if (kind === 'hard') t.c += 0.5;

    state.stats.total++;
    if (kind === 'good') state.stats.correct++;
    else if (kind === 'hard') state.stats.correct += 0.5;

    addXp(XP[kind] || 0);
    t.xp = (t.xp || 0) + (XP[kind] || 0);
  }

  session.answered++;
  session.lockAns = true;

  // v200：每日挑战进度 + 「十连对」成就（同一个词的重复考核不重复计）
  if (!item.repeated) {
    if (kind === 'good') {
      session.goodStreak = (session.goodStreak || 0) + 1;
      session.maxGoodStreak = Math.max(session.maxGoodStreak || 0, session.goodStreak);
    } else {
      session.goodStreak = 0;
    }
    bumpChallengeAnswer(kind);
    checkAchievements({ goodStreak: session.maxGoodStreak || 0 });
  }

  saveState();
  updateSessBar();

  $('#sessActions').classList.add('hidden');
  $('#sessNext').classList.remove('hidden');
  $('#btnNext').focus({ preventScroll: true });
}

function pick(a) { return a[Math.random() * a.length | 0]; }

function giveFeedback(cls, text) {
  const el = $('#feedback');
  el.className = 'feedback show ' + cls;
  el.textContent = text;
}

function nextCard() {
  if (!session) return;
  if (heartsLeft() <= 0) { finishSession('hearts'); return; }
  session.i++;
  showCard();
}

function finishSession(reason) {
  setTimeout(lockScrollIfNeeded, 60);
  const s = session;
  const rec = todayRec();

  // 连击只在今天第一次真正学习时更新
  if (state.stats.lastStudy !== dateKey() && (rec.n > 0 || rec.r > 0)) {
    state.stats.streak = (state.stats.lastStudy === shiftDay(-1) ? state.stats.streak + 1 : 1);
    state.stats.lastStudy = dateKey();
  } else if (rec.n > 0 || rec.r > 0) {
    state.stats.lastStudy = dateKey();
  }

  // v200：复习会话完成 → 推进「完成 1 次复习」；学习结束 → 检查成就
  if (s.kind === 'review' && s.answered > 0) ensureDailyChallenge().revDone = true;
  saveState();
  refreshChallenge();
  checkAchievements();

  const answered = s.answered || 1;
  const acc = Math.round((s.correct / answered) * 100);
  const nextEl = $('#sumNext');
  if (reason === 'hearts') {
    sumNext = { act: 'home', msg: '今天先到这里，明天 0 点恢复 20 颗心' };
    $('#sumEmoji').textContent = '💔';
    $('#sumTitle').textContent = '心用完了';
    $('#sumSub').textContent = '今天先到这里，明天 0 点恢复 20 颗心';
    $('#btnSumClose').textContent = '明天再来';
  } else {
    // 学完之后明确告诉用户下一步去哪儿，而不是只弹一句"继续加油"
    const left = remainingNew();
    const due = dueWords(999).length;
    const wrongs = wrongWordList().length;
    const bookEmpty = !newWords(1).length;
    let act = 'home', msg = '';
    if (!bookEmpty && left > 0) { act = 'learn'; msg = `还差 ${left} 个新词，接着学吧`; }
    else if (due > 0) { act = 'review'; msg = `还有 ${due} 个词今天要复习`; }
    else if (wrongs > 0) { act = 'review'; msg = `错词本里还有 ${wrongs} 个词，建议再巩固一遍`; }
    else if (bookEmpty) { act = 'books'; msg = '这本词书背完啦，去书架换一本继续'; }
    else { act = 'home'; msg = '今天的目标完成啦，明天见 👋'; }
    sumNext = { act, msg };
    $('#sumEmoji').textContent = '🎉';
    $('#sumTitle').textContent = s.answered === 0 ? '这次没有答题' : pick(['今天完成啦！', '漂亮，收工！', '稳得一批 🎯']);
    $('#sumSub').textContent = `连击 ${displayStreak()} 天 · 正确率 ${acc}% · Lv.${levelInfo().lv}`;
    $('#btnSumClose').textContent = act === 'learn' ? '继续学习' : act === 'review' ? '去复习' : act === 'books' ? '去书架' : '明天见';
  }
  if (nextEl) nextEl.textContent = sumNext.msg;
  $('#sumNew').textContent = s.newCount;
  $('#sumReview').textContent = s.reviewCount;
  $('#sumAcc').textContent = acc + '%';

  $('#session').classList.remove('is-open');
  $('#summary').classList.add('is-open');
  confetti(acc >= 60 ? 120 : 60);
  beep('win');
  session = null;
  renderAll();
}

function quitSession() {
  setTimeout(lockScrollIfNeeded, 60);
  if (!session) return;
  const done = session.answered;
  session = null;
  $('#session').classList.remove('is-open');
  if (done > 0) toast(`已保存 ${done} 个词的进度`);
  renderAll();
}

/* ---------------- 提醒（ICS） ---------------- */
function downloadICS() {
  const [h, m] = (state.settings.reminder || '07:00').split(':').map(Number);
  const d = new Date(); d.setHours(h, m, 0, 0);
  const f = x => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
  const end = new Date(d.getTime() + 15 * 60000);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//XiaoYue//CN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:xiaoyue-${Date.now()}@local`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${f(d)}`,
    `DTEND:${f(end)}`,
    'RRULE:FREQ=DAILY',
    'SUMMARY:背单词 📚',
    'DESCRIPTION:打开「小越背单词」，完成今天的学习目标',
    'BEGIN:VALARM', 'TRIGGER:-PT0M', 'ACTION:DISPLAY', 'DESCRIPTION:该背单词啦', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `背单词提醒-${state.settings.reminder.replace(':', '')}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast('已下载，打开它导入到系统日历即可');
}

async function enableNotify() {
  if (!('Notification' in window)) return toast('这台设备不支持网页通知');
  const perm = await Notification.requestPermission();
  renderSettings();
  if (perm === 'granted') {
    toast('通知已开启（仅在 App 打开时有效）');
    maybeNotifyToday();
  } else toast('未获得通知权限');
}

function maybeNotifyToday() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const left = remainingNew();
  if (left <= 0) return;
  const [h, m] = (state.settings.reminder || '07:00').split(':').map(Number);
  const now = new Date();
  if (now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
  if (sessionStorage.getItem('notified-' + dateKey())) return;
  sessionStorage.setItem('notified-' + dateKey(), '1');
  new Notification('该背单词啦 📚', {
    body: `今天还有 ${left} 个新词没背`,
    icon: 'icons/icon-192.png', tag: 'daily'
  });
}

/* ---------------- 设置项交互 ---------------- */
function bindSettings() {
  $$('[data-step]').forEach(btn => {
    btn.onclick = () => {
      const k = btn.dataset.step, d = Number(btn.dataset.d);
      const min = k === 'dailyNew' ? 5 : 5, max = 100;
      state.settings[k] = clamp(state.settings[k] + d, min, max);
      saveState(); renderSettings(); renderHome();
    };
  });

  $$('#themeSeg button').forEach(b => {
    b.onclick = () => {
      state.settings.theme = b.dataset.themeMode;
      saveState(); applyTheme(); renderSettings();
      toast(b.textContent === '自动' ? '已跟随系统' : `已切到${b.textContent}模式`);
    };
  });

  $$('#segAccent button').forEach(b => {
    b.onclick = () => {
      state.settings.accent = b.dataset.accent;
      saveState(); renderSettings();
      if (curBook) {
        const w = session ? session.queue[session.i].w.w : null;
        if (w) playWord(w, state.settings.accent);
      }
    };
  });

  $('#chkAutoplay').onchange = e => { state.settings.autoplay = e.target.checked; saveState(); };
  $('#chkSound').onchange = e => { state.settings.sound = e.target.checked; saveState(); };
  $('#chkEnDef').onchange = e => { state.settings.showEnDef = e.target.checked; saveState(); };

  const lbEl = $('#chkLiveBg');
  if (lbEl) lbEl.onchange = e => {
    state.settings.liveBg = e.target.checked;
    saveState();
    if (!e.target.checked) {
      fallbackToStill(true);
      toast('已关闭动态背景', 1800);
    } else {
      state.settings.videoBlocked = false;
      saveState();
      initVideoBg();
    }
  };

  const fvEl = $('#chkForceVideo');
  if (fvEl) fvEl.onchange = e => {
    state.settings.forceVideo = e.target.checked;
    state.settings.videoBlocked = false;
    saveState();
    document.documentElement.classList.remove('has-video-bg');
    if (e.target.checked) {
      initVideoBg();
    } else {
      fallbackToStill(true);
    }
  };
  $('#inpRemind').onchange = e => { state.settings.reminder = e.target.value || '07:00'; saveState(); renderSettings(); };

  $('#btnIcs').onclick = downloadICS;
  $('#btnNotify').onclick = enableNotify;

  /* ---------- 数据导出 / 导入（规范版） ---------- */
  const BACKUP_KEY = 'vocab.shelf.lastBackup';
  let pendingImport = null;     // 解析后的待导入数据

  function dataCount() {
    try { return Object.keys(state.progress || {}).length; } catch (e) { return 0; }
  }

  function dataBytes() {
    try { return new Blob([JSON.stringify(state)]).size; } catch (e) { return 0; }
  }

  function fmtBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }

  function refreshDataStats() {
    const box = $('#dataStats');
    if (!box) return;
    const last = localStorage.getItem(BACKUP_KEY);
    const lastTxt = last
      ? '上次备份 ' + new Date(Number(last)).toLocaleDateString('zh-CN')
      : '还没有备份过';
    box.innerHTML = '已学 <b>' + dataCount() + '</b> 个词 · 占用 <b>' + fmtBytes(dataBytes())
      + '</b> · ' + lastTxt + '<br>进度只存在这台设备上，不联网、不上传。换手机或清缓存会丢失。';
  }

  $('#btnExport').onclick = () => {
    const payload = {
      _app: 'xiaoyue-vocab',
      _version: 1,
      _exportedAt: new Date().toISOString(),
      _words: dataCount(),
      state: state
    };
    const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    const d = new Date();
    const stamp = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0')
      + String(d.getDate()).padStart(2, '0') + '-' + String(d.getHours()).padStart(2, '0')
      + String(d.getMinutes()).padStart(2, '0');
    a.href = URL.createObjectURL(blob);
    a.download = 'xiaoyue-backup-' + stamp + '.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    localStorage.setItem(BACKUP_KEY, String(Date.now()));
    refreshDataStats();
    toast('已导出 ' + dataCount() + ' 个词的进度');
  };

  $('#btnImport').onclick = () => $('#fileImport').click();
  $('#fileImport').onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      /* 兼容老格式（直接是 state）与新格式（带 _meta 包装） */
      const data = raw && raw.state ? raw.state : raw;
      if (!data || typeof data !== 'object' || !data.progress) throw new Error('bad format');

      const words = Object.keys(data.progress).length;
      pendingImport = data;

      const info = $('#impInfo');
      if (info) {
        info.innerHTML =
          '文件：<b>' + f.name + '</b><br>' +
          '里面包含 <b>' + words + '</b> 个词的进度<br>' +
          '当前设备已有 <b>' + dataCount() + '</b> 个词';
      }
      $('#importSheet').classList.add('is-open');
    } catch (err) {
      toast('导入失败：不是有效的备份文件');
    }
    e.target.value = '';
  };

  function closeImportSheet() {
    $('#importSheet').classList.remove('is-open');
    pendingImport = null;
  }

  $('#impCancel').onclick = closeImportSheet;
  $('#importSheet').onclick = ev => { if (ev.target.id === 'importSheet') closeImportSheet(); };

  $('#impReplace').onclick = async () => {
    if (!pendingImport) return;
    if (!confirm('确定用备份覆盖当前全部进度？当前数据会被替换。')) return;
    const data = pendingImport;
    closeImportSheet();
    state = { ...defaultState(), ...data };
    saveState();
    await loadBook(state.activeBook);
    renderAll();
    refreshDataStats();
    toast('已覆盖导入');
  };

  $('#impMerge').onclick = async () => {
    if (!pendingImport) return;
    const data = pendingImport;
    closeImportSheet();

    const cur = state.progress || {};
    const inc = data.progress || {};
    const res = (typeof XYCore !== 'undefined' && XYCore.mergeProgress)
      ? XYCore.mergeProgress(cur, inc)
      : { merged: Object.assign({}, inc, cur), added: 0, updated: 0, kept: 0 };
    const added = res.added, updated = res.updated;
    state.progress = res.merged;

    /* 其它字段：缺的补上，已有的保留当前 */
    for (const key of Object.keys(data)) {
      if (key === 'progress') continue;
      if (state[key] == null) state[key] = data[key];
    }
    saveState();
    await loadBook(state.activeBook);
    renderAll();
    refreshDataStats();
    toast('已合并：新增 ' + added + ' 个词，更新 ' + updated + ' 个');
  };

  refreshDataStats();

  $('#btnReset').onclick = () => {
    if (!confirm('确定清空所有学习进度？此操作不可恢复。')) return;
    state = defaultState();
    if (bookIndex[0]) state.activeBook = bookIndex[0].id;
    saveState();
    loadBook(state.activeBook).then(renderAll);
    toast('已清空');
  };
}

/* ---------------- 导航 ---------------- */
function go(tab) {
  /* 目标页面不存在时回退首页，避免整屏空白 */
  if (!document.getElementById('screen-' + tab)) tab = 'home';
  document.documentElement.classList.toggle('on-home', tab === 'home');
  $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === tab));
  $$('.screen').forEach(s => s.classList.toggle('is-active', s.id === 'screen-' + tab));
  try { if (tab === 'pet' && !document.getElementById('screen-pet')) { /* 爱宠已下架 */ } else if (tab === 'pet') onPetTabEnter(); else onPetTabLeave(); } catch (e) { }
  if (tab === 'learn') { openChapters.clear(); renderPath(); }
  if (tab === 'review') renderReview();
  if (tab === 'books') renderBooks();
  if (tab === 'settings') renderSettings();
  scrollTo({ top: 0, behavior: 'smooth' });
}

/* ---------------- 事件绑定 ---------------- */
function bindEvents() {
  $$('.tab').forEach(t => t.onclick = () => go(t.dataset.tab));
  $('#btnSettingsQuick').onclick = () => go('settings');

  const pw = $('#pathWrap');
  if (pw) pw.onclick = ev => {
    const btn = ev.target.closest('.node');
    if (!btn) return;
    const info = pathInfos[Number(btn.dataset.node)];
    if (!info) return;
    if (!info.unlocked && !info.done) { toast('先完成前面那一关哦～'); return; }
    startNodeSession(info);
  };

  $('#btnStart').onclick = () => startSession(remainingNew() > 0 ? 'learn' : 'review');
  const tN = $('#taskNew'); if (tN) tN.onclick = () => startSession('learn');
  const tR = $('#taskRev'); if (tR) tR.onclick = () => startSession('review');
  const tbBtn = $('#tbBook'); if (tbBtn) tbBtn.onclick = () => go('books');
  // 复习卡片：进入词表页（右上角"开始"再进单词卡）
  const rvW = $('#rvCardWords'); if (rvW) rvW.onclick = () => openReviewDetail('words');
  const rvX = $('#rvCardWrong'); if (rvX) rvX.onclick = () => openReviewDetail('wrong');
  const rvB = $('#rvBack'); if (rvB) rvB.onclick = closeReviewDetail;
  const rvS = $('#rvStartBtn'); if (rvS) rvS.onclick = () => {
    const list = rvMode === 'wrong' ? wrongWordList() : reviewPool().words;
    if (!list.length) return;
    closeReviewDetail();
    startSession('review', list);
  };

  // v200：签到按钮 + 成就入口 / 关闭
  const ckBtn = $('#ckBtn'); if (ckBtn) ckBtn.onclick = doCheckIn;
  const achvBtn = $('#achvBtn'); if (achvBtn) achvBtn.onclick = openAchv;
  const achvClose = $('#achvClose'); if (achvClose) achvClose.onclick = closeAchv;
  const achvPanel = $('#achvPanel'); if (achvPanel) achvPanel.onclick = ev => { if (ev.target === achvPanel) closeAchv(); };


  const _stBtn = document.getElementById('btnStats'); if (_stBtn) _stBtn.onclick = openStats;
  const _stClose = document.getElementById('statsClose'); if (_stClose) _stClose.onclick = closeStats;
  const _stPanel = document.getElementById('statsPanel'); if (_stPanel) _stPanel.onclick = e => { if (e.target === _stPanel) closeStats(); };
  $('#btnQuit').onclick = quitSession;
  $('#wordCard').onclick = revealCard;
  $$('.phon-btn').forEach(b => b.onclick = ev => {
    ev.stopPropagation();
    if (!session) return;
    const w = session.queue[session.i].w.w;
    b.classList.add('playing');
    playWord(w, b.dataset.play);
    setTimeout(() => b.classList.remove('playing'), 700);
  });
  $$('[data-ans]').forEach(b => b.onclick = () => answer(b.dataset.ans));
  $('#btnNext').onclick = nextCard;
  $('#btnSumClose').onclick = () => {
    $('#summary').classList.remove('is-open');
    const next = sumNext || { act: 'home', msg: '' };
    sumNext = { act: 'home', msg: '' };
    if (next.act === 'learn' && remainingNew() > 0) {
      startSession('learn');
      return;
    }
    if (next.act === 'review') go('review');
    else if (next.act === 'books') go('books');
    else go('home');
    if (next.msg) toast(next.msg, 2600);
  };

  addEventListener('keydown', e => {
    if (!$('#session').classList.contains('is-open')) return;
    if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      if (!session) return;
      if (session.lockAns) nextCard(); else revealCard();
    }
    if (e.key === '1') answer('again');
    if (e.key === '2') answer('hard');
    if (e.key === '3') answer('good');
    if (e.key === 'Escape') quitSession();
  });
}

/* ---------------- 启动 ---------------- */
/* 按实际高度摆放底图：人物脚底永远在面板上方 8px */
function syncAppHeight() {
  // iOS Safari：visualViewport 更准（工具栏收起/展开）
  const vv = window.visualViewport;
  let h = (vv && vv.height) || window.innerHeight || document.documentElement.clientHeight || 800;
  // 极小的值通常是键盘弹起，忽略，避免布局塌陷
  if (h < 320) h = window.innerHeight || 800;
  document.documentElement.style.setProperty('--app-h', Math.round(h) + 'px');
  document.documentElement.style.setProperty('--app-hh', (h / 2) + 'px');
}
function syncScene() {
  /* 构图交给 CSS（v71 固定变换），此处保留空实现便于以后扩展 */
}
async function boot() {
  document.title = '小越背单词';
  initSplash();
  syncAppHeight();

  if (new URLSearchParams(location.search).get('probe') === '1') {
    setTimeout(function () {
      var d = document.documentElement;
      var wide = [];
      document.querySelectorAll('body *').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.width > d.clientWidth + 2 && r.height > 10) {
          wide.push((el.id || el.className || el.tagName) + ':' + Math.round(r.width));
        }
      });
      document.title = 'iw=' + innerWidth + ' cw=' + d.clientWidth + ' sw=' + d.scrollWidth + ' scr=' + screen.width + ' dpr=' + devicePixelRatio + ' | ' + wide.slice(0,4).join(' , ');
    }, 2500);
  }
  window.addEventListener('resize', function(){ syncAppHeight(); syncScene(); });
  window.addEventListener('orientationchange', () => setTimeout(syncAppHeight, 300));
  if (window.visualViewport) window.visualViewport.addEventListener('resize', function(){ syncAppHeight(); syncScene(); });
  ensureHearts();
  if (state.settings.theme === 'auto') { state.settings.theme = 'day'; saveState(); }
  if (!state.startedAt) { state.startedAt = dateKey(); saveState(); }
  initPhotoBg();
  document.documentElement.classList.add('on-home');
  initVideoBg();
  initParticles();
  // 支持 ?theme=day|night 临时锁定配色（调试/截图用）
  const qTheme = new URLSearchParams(location.search).get('theme');
  if (qTheme === 'day' || qTheme === 'night') state.settings.theme = qTheme;
  applyTheme();
  if (window.matchMedia) {
    try {
      const mq = matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => applyTheme();
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange);
    } catch (e) { /* 忽略 */ }
  }
  
  if (new URLSearchParams(location.search).get('probe') === '1') {
    setTimeout(function () {
      try {
        var vw = window.innerWidth;
        var sw = document.documentElement.scrollWidth;
        var worst = '', wmax = 0;
        document.querySelectorAll('body *').forEach(function (el) {
          var r = el.getBoundingClientRect();
          if (r.right > wmax) { wmax = r.right; worst = el.tagName + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''); }
        });
        document.title = 'vw=' + vw + ' sw=' + sw + ' maxRight=' + Math.round(wmax) + ' at=' + worst;
      } catch (e) { document.title = 'PROBE-ERR:' + e.message; }
    }, 2200);
  }

  bindEvents();
  bindSettings();
  try {
    await initBooks();
  } catch (e) {
    console.error(e);
    toast('词库加载失败，请检查 data/books 目录', 4000);
  }
  renderAll();
  checkAchievements();      // v200：老用户升级时补齐已达成成就
  initNews();
  initQuote().then(function(){ setTimeout(syncScene, 60); });
  maybeNotifyToday();
  if (new URLSearchParams(location.search).get('nosetup') === '1') state.onboarded = true;
  if (new URLSearchParams(location.search).get('seed')) {
    const n = parseInt(new URLSearchParams(location.search).get('seed'), 10) || 3;
    setTimeout(() => {
      try {
        const p = progressOf();
        const ws = (curBook?.words || []).slice(0, n);
        ws.forEach(w => { p[wordKey(w.w)] = { b: 1, d: shiftDay(1), r: 1, w: 0, last: dateKey(), dt: dateKey() }; });
        const r = todayRec();
        r.n = (r.n || 0) + n;
        saveState();
        renderAll();
        go(new URLSearchParams(location.search).get('seedtab') || 'review');
        if (new URLSearchParams(location.search).get('revstart') === '1') {
          setTimeout(() => { const c = document.getElementById('rvCardWords'); if (c) c.click(); }, 500);
        }
      } catch (e) { document.title = 'SEED-FAIL: ' + e.message; }
    }, 1500);
  }
  if (new URLSearchParams(location.search).get('autograde') === '1') {
    setTimeout(() => {
      try {
        const card = document.getElementById('wordCard');
        if (card) card.click();
        setTimeout(() => {
          const g = document.querySelector('[data-ans="good"]');
          if (g) g.click();
          document.title = 'GRADED-OK';
        }, 400);
      } catch (e) { document.title = 'GRADE-FAIL: ' + e.message; }
    }, 1600);
  }
  if (new URLSearchParams(location.search).get('dbgstats') === '1') { setTimeout(function(){ try{ openStats(); }catch(e){ document.title='ST-FAIL:'+e.message; } }, 1400); }
  if (new URLSearchParams(location.search).get('dbgcheckin') === '1') {
    setTimeout(function () {
      try {
        state.hearts.n = 10; saveState();
        var b = document.getElementById('ckBtn');
        if (b) { b.click(); b.click(); b.click(); }  /* 连点 3 次测幂等 */
        document.title = 'CK streak=' + (state.checkin && state.checkin.streak) +
          ' last=' + (state.checkin && state.checkin.last) +
          ' hearts=' + (state.hearts && state.hearts.n) + ' xp=' + (state.stats && state.stats.xp || 0) + ' btn=' + (document.getElementById('ckBtn')||{}).textContent;
      } catch (e) { document.title = 'CK-FAIL: ' + e.message; }
    }, 1500);
  }
  if (new URLSearchParams(location.search).get('dbgachv') === '1') {
    setTimeout(function () {
      try { var a = document.getElementById('achvBtn'); if (a) a.click(); } catch (e) {}
    }, 1500);
  }
  if (new URLSearchParams(location.search).get('autobk') === '1') {
    setTimeout(() => { const c = document.querySelector('.book-card'); if (c) c.click(); }, 1200);
  }
  if (new URLSearchParams(location.search).get('study') === '1') {
    setTimeout(() => { try { startNodeSession(pathInfos[0]); } catch (e) { } }, 900);
  }
  const _pm = new URLSearchParams(location.search).get('petmood');
  if (new URLSearchParams(location.search).get('petdemo') === '1') {
    state.pet = { name: '木木枭', gender: 'boy', food: 38, water: 52, foodStock: 7, waterStock: 3, pats: 0, lastDay: dateKey() };
    if (_pm === 'hungry') { state.pet.food = 12; state.pet.water = 60; }
    if (_pm === 'thirsty') { state.pet.food = 70; state.pet.water = 10; }
    if (_pm === 'happy') { state.pet.happyUntil = Date.now() + 600000; }
    renderPet();
  }
  initOnboard();
  initSheetDrag();

  // 支持 #home/#books/#review/#settings 直接打开某个页面，方便分享与调试
  const q = new URLSearchParams(location.search);
  const wantBook = q.get('book');
  if (wantBook && bookIndex.some(b => b.id === wantBook) && wantBook !== state.activeBook) {
    state.activeBook = wantBook;
    saveState();
    await loadBook(wantBook);
    renderAll();
  }
  const tab = q.get('tab') || location.hash.replace('#', '');
  if (['home', 'learn', 'pet', 'books', 'review', 'settings'].includes(tab)) go(tab);
  if (q.get('start') === '1') setTimeout(() => startSession('learn'), 300);
  if (q.get('reveal') === '1') setTimeout(revealCard, 900);

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW 注册失败', err));
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      renderHome(); maybeNotifyToday();
      if (petScreenActive()) onPetTabEnter();
    } else {
      if (petScreenActive()) onPetTabLeave();
    }
  });
}

document.addEventListener('DOMContentLoaded', boot);

/* iOS speech unlock：首次触摸时热身，之后 speechSynthesis 才可用 */
(function () {
  var unlocked = false;
  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try {
      if ('speechSynthesis' in window) {
        var u = new SpeechSynthesisUtterance(' ');
        u.volume = 0; u.rate = 10;
        window.speechSynthesis.speak(u);
        window.speechSynthesis.cancel();
      }
    } catch (e) { }
    document.removeEventListener('touchstart', unlock, true);
    document.removeEventListener('touchend', unlock, true);
    document.removeEventListener('click', unlock, true);
  }
  document.addEventListener('touchstart', unlock, true);
  document.addEventListener('touchend', unlock, true);
  document.addEventListener('click', unlock, true);
})();

/* 离开页面/切后台时兜底落盘，防止未保存的改动丢失 */
(function () {
  var flush = function () { try { saveState(); } catch (e) { } };
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') flush();
  });
})();

/* ---------------- 学习统计 ---------------- */
function statsDays() {
  const h = state.history || {};
  return Object.keys(h).filter(k => (h[k] || {}).n || (h[k] || {}).r).length;
}

function statsTotals() {
  const h = state.history || {};
  let n = 0, r = 0, c = 0, t = 0;
  for (const k in h) {
    const d = h[k] || {};
    n += d.n || 0; r += d.r || 0; c += d.c || 0; t += d.t || 0;
  }
  return { n, r, c, t };
}

function last7() {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const key = shiftDay(-i);
    const d = (state.history || {})[key] || {};
    out.push({ key, label: key.slice(5), n: d.n || 0, r: d.r || 0 });
  }
  return out;
}

function renderStats() {
  const grid = document.getElementById('statsGrid');
  const chart = document.getElementById('statsChart');
  const books = document.getElementById('statsBooks');
  if (!grid) return;

  const tot = statsTotals();
  const acc = tot.t ? Math.round(tot.c / tot.t * 100) : null;
  const learned = totalLearnedWords();
  const days = statsDays();
  const streak = displayStreak();

  const card = (k, v, sub) =>
    `<div class="stat-card"><div class="sc-k">${k}</div><div class="sc-v">${v}</div><div class="sc-s">${sub || ''}</div></div>`;

  grid.innerHTML =
    card('累计学过', learned + ' <small>词</small>', '所有词书去重') +
    card('学习天数', days + ' <small>天</small>', '有记录的日期') +
    card('连续天数', streak + ' <small>天</small>', '当前连击') +
    card('正确率', acc === null ? '—' : acc + '%', tot.t ? `共答 ${tot.t} 次` : '还没有数据') +
    card('新词总数', (tot.n || 0) + ' <small>个</small>', '累计学习新词') +
    card('复习总数', (tot.r || 0) + ' <small>个</small>', '累计复习次数');

  // 近 7 天柱状图
  const days7 = last7();
  const max = Math.max(1, ...days7.map(d => d.n + d.r));
  chart.innerHTML = days7.map(d => {
    const hn = Math.round(d.n / max * 100);
    const hr = Math.round(d.r / max * 100);
    return `<div class="bar-col">
      <div class="bar-stack">
        <i class="bar-n" style="height:${hn}%"></i>
        <i class="bar-r" style="height:${hr}%"></i>
      </div>
      <div class="bar-lb">${d.label}</div>
    </div>`;
  }).join('');

  // 词书进度
  const rows = (bookIndex || []).map(b => {
    const p = state.progress[b.id] || {};
    const n = Object.keys(p).length;
    const pct = b.count ? Math.round(n / b.count * 100) : 0;
    return `<div class="stat-book">
      <div class="sb-t">${esc(b.title)}</div>
      <div class="sb-bar"><i style="width:${pct}%"></i></div>
      <div class="sb-n">${n}/${b.count}</div>
    </div>`;
  }).join('');
  books.innerHTML = rows || '<div class="empty">词库加载中</div>';
}

function openStats() {
  renderStats();
  const p = document.getElementById('statsPanel');
  if (p) p.classList.add('is-open');
}
function closeStats() {
  const p = document.getElementById('statsPanel');
  if (p) p.classList.remove('is-open');
}
