'use strict';
/* ============================================================
   رحلة حفظ جزء عمَّ — تطبيق الأطفال
   كل البيانات محلية (localStorage) ولكل مستخدم مساحته الخاصة.
   ============================================================ */
(function () {

/* ------------------------- 0) مساعدات عامة ------------------------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const ar = (n) => String(n == null ? '' : n).replace(/\d/g, (d) => AR_DIGITS[+d]);
const pad3 = (n) => String(n).padStart(3, '0');
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const TOTAL_AYAT = 564;
const SRS_DAYS = [1, 2, 4, 7, 15, 30, 60];
const ROUTES = ['home', 'wird', 'memorize', 'test', 'rewards', 'certs', 'settings'];

const todayKey = (d) => {
  const x = new Date((d || new Date()).getTime() - (d || new Date()).getTimezoneOffset() * 60000);
  return x.toISOString().slice(0, 10);
};
const shiftDay = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return todayKey(d);
};
const fmtDate = (iso) => {
  try {
    return new Date(iso + 'T12:00:00').toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' });
  } catch (e) { return iso; }
};
const DAY_NAMES = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'u' + Date.now() + Math.random().toString(16).slice(2));
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
};
const pickOne = (arr) => arr[Math.floor(Math.random() * arr.length)];
const stripHarakat = (w) => String(w || '').replace(/[\u064B-\u0652\u0670\u0640\u06D6-\u06ED]/g, '');
const wordsOf = (s, a) => (QURAN_JUZ30[s].ayat[a - 1] || '').split(' ').filter(Boolean);
const ayahText = (s, a) => (QURAN_JUZ30[s].ayat[a - 1] || '');
const surahName = (s) => (QURAN_JUZ30[s] ? QURAN_JUZ30[s].name : '');
const portionKey = (s, from, to) => s + ':' + from + '-' + to;
const pLabel = (s, from, to) => 'سورة ' + surahName(s) + ' · الآيات ' + ar(from) + '–' + ar(to);
const mmss = (sec) => ar(Math.floor(sec / 60)) + ':' + ar(String(sec % 60).padStart(2, '0'));

/* ------------------------- 1) التخزين ------------------------- */
const K = {
  users: 'jz_users_v1',
  session: 'jz_session_v1',
  data: (id) => 'jz_data_v1_' + id,
  theme: 'juz_theme'
};

function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

function readJSON(k, fb) {
  const raw = lsGet(k);
  if (!raw) return fb;
  try { return JSON.parse(raw); } catch (e) { return fb; }
}
function writeJSON(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; }
  catch (e) { toast('تعذّر حفظ البيانات على هذا الجهاز (المساحة ممتلئة؟)', 'err', 4200); return false; }
}

const getUsers = () => readJSON(K.users, []);
const saveUsers = (list) => writeJSON(K.users, list);
const loadData = (id) => readJSON(K.data(id), null);

/* ------------------------- 2) كلمات المرور ------------------------- */
const te = new TextEncoder();
function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBytes(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
async function derivePass(pass, saltB64, iter) {
  const key = await crypto.subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: b64ToBytes(saltB64), iterations: iter, hash: 'SHA-256' },
    key, 256
  );
  return bufToB64(bits);
}
async function makePass(pass) {
  const salt = bufToB64(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await derivePass(pass, salt, 120000);
  return { alg: 'PBKDF2-SHA256', iter: 120000, salt: salt, hash: hash };
}
async function checkPass(pass, rec) {
  if (!rec) return false;
  const h = await derivePass(pass, rec.salt, rec.iter || 120000);
  return h === rec.hash;
}

/* ------------------------- 3) التحقق من المدخلات ------------------------- */
function normLogin(raw) {
  let s = String(raw || '').trim();
  s = s.replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
  s = s.replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
  if (s.indexOf('@') > -1) return { type: 'email', value: s.toLowerCase() };
  const digits = s.replace(/[\s\-()]/g, '');
  return { type: 'phone', value: digits };
}
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
const isPhone = (s) => /^\+?\d{8,15}$/.test(s);

/* ------------------------- 4) الحالة ------------------------- */
let USER = null;
let D = null;
let authMode = 'login';
let pickedAvatar = '🦁';
let pickedWird = 3;

const state = {
  route: 'home',
  params: {},
  mem: null,
  testIntro: null,
  back: 'home',
  test: null,
  hide: false,
  shown: new Set(),
  repeat: 1,
  modalOpen: false,
  confirmCb: null,
  cert: null,
  pickerMode: 'memorize'
};

/* ------------------------- 5) بيانات المستخدم ------------------------- */
function defaultData() {
  return {
    v: 1,
    stars: 0,
    streak: { count: 0, best: 0, last: null },
    portions: [],
    tests: [],
    badges: [],
    prizes: [],
    certs: [],
    days: {},
    settings: { wird: 3, sound: true },
    onboarded: false,
    createdAt: todayKey()
  };
}
function normalizeData() {
  if (!D || typeof D !== 'object') D = defaultData();
  const def = defaultData();
  Object.keys(def).forEach((k) => { if (D[k] == null) D[k] = def[k]; });
  if (!Array.isArray(D.portions)) D.portions = [];
  if (!Array.isArray(D.tests)) D.tests = [];
  if (!Array.isArray(D.badges)) D.badges = [];
  if (!Array.isArray(D.prizes)) D.prizes = [];
  if (!Array.isArray(D.certs)) D.certs = [];
  if (!D.streak || typeof D.streak !== 'object') D.streak = { count: 0, best: 0, last: null };
  if (!D.days || typeof D.days !== 'object') D.days = {};
  D.settings = Object.assign({ wird: 3, sound: true }, D.settings || {});
  D.settings.wird = clamp(+D.settings.wird || 3, 2, 8);
  D.stars = Math.max(0, +D.stars || 0);
}
function saveD() { if (USER && D) writeJSON(K.data(USER.id), D); }
function dayRec(key) {
  const k = key || todayKey();
  if (!D.days[k]) D.days[k] = { learned: 0, tests: 0, stars: 0 };
  return D.days[k];
}

/* ------------------------- 6) خطة الحفظ ------------------------- */
function planAll(size) {
  const w = clamp(+size || 3, 2, 8);
  const out = [];
  for (let s = 114; s >= 78; s--) {
    const n = QURAN_JUZ30[s].ayat.length;
    for (let i = 0; i < n; i += w) {
      const from = i + 1;
      const to = Math.min(i + w, n);
      out.push({ s: s, from: from, to: to, key: portionKey(s, from, to) });
    }
  }
  return out;
}
const learnedSet = () => new Set(D.portions.map((p) => p.key));
function nextNewPortion() {
  const done = learnedSet();
  return planAll(D.settings.wird).find((p) => !done.has(p.key)) || null;
}
function dueReviews() {
  const t = todayKey();
  return D.portions
    .filter((p) => !p.next || p.next <= t)
    .sort((a, b) => String(a.next || '').localeCompare(String(b.next || '')));
}
function upcomingReviews(limit) {
  const t = todayKey();
  return D.portions
    .filter((p) => p.next && p.next > t)
    .sort((a, b) => String(a.next).localeCompare(String(b.next)))
    .slice(0, limit || 5);
}
function isLearned(key) { return D.portions.some((p) => p.key === key); }
function getPortion(s, from, to) {
  const key = portionKey(s, from, to);
  return D.portions.find((p) => p.key === key) || null;
}

function completeSurahs() {
  const cov = {};
  D.portions.forEach((p) => { cov[p.s] = (cov[p.s] || 0) + (p.to - p.from + 1); });
  return Object.keys(cov).map(Number)
    .filter((s) => QURAN_JUZ30[s] && cov[s] >= QURAN_JUZ30[s].ayat.length)
    .sort((a, b) => a - b);
}
function stats() {
  let ayahs = 0;
  D.portions.forEach((p) => { ayahs += (p.to - p.from + 1); });
  return {
    ayahs: ayahs,
    portions: D.portions.length,
    surahs: completeSurahs().length,
    stars: D.stars,
    streak: D.streak.count,
    bestStreak: D.streak.best || D.streak.count,
    tests: D.tests.length,
    perfect: D.tests.filter((t) => t.pct === 100).length,
    reviews: D.portions.reduce((a, p) => a + (p.tests || 0), 0),
    prizes: D.prizes.length
  };
}
function avgScore() {
  if (!D.tests.length) return 0;
  return Math.round(D.tests.reduce((a, t) => a + (t.pct || 0), 0) / D.tests.length);
}

/* ------------------------- 7) المستويات والنجوم ------------------------- */
const LEVELS = [
  { min: 0, name: 'مبتدئ', ico: '🌱' },
  { min: 100, name: 'متعلّم', ico: '🌿' },
  { min: 250, name: 'حافظ صغير', ico: '📖' },
  { min: 500, name: 'نجم الحفظ', ico: '⭐' },
  { min: 900, name: 'بطل جزء عم', ico: '👑' },
  { min: 1500, name: 'حافظ متقن', ico: '🏅' }
];
function levelInfo(stars) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (stars >= LEVELS[i].min) idx = i;
  const cur = LEVELS[idx];
  const next = LEVELS[idx + 1] || null;
  return {
    cur: cur, next: next, num: idx + 1,
    pct: next ? Math.round(((stars - cur.min) / (next.min - cur.min)) * 100) : 100
  };
}
function addStars(n) {
  const amount = Math.max(0, Math.round(n));
  D.stars += amount;
  dayRec().stars += amount;
  saveD();
  renderChrome();
  checkBadges();
  return amount;
}
function touchStreak() {
  const t = todayKey();
  if (D.streak.last === t) return;
  const y = shiftDay(-1);
  D.streak.count = (D.streak.last === y) ? (D.streak.count + 1) : 1;
  D.streak.last = t;
  D.streak.best = Math.max(D.streak.best || 0, D.streak.count);
  saveD();
}

/* ------------------------- 8) الأوسمة والجوائز ------------------------- */
const BADGES = [
  { id: 'first_wird', ico: '🌱', title: 'أول خطوة', desc: 'أول ورد حفظ', test: (s) => s.portions >= 1, prog: (s) => [s.portions, 1] },
  { id: 'surah_first', ico: '🕌', title: 'أول سورة', desc: 'سورة كاملة', test: (s) => s.surahs >= 1, prog: (s) => [s.surahs, 1] },
  { id: 'surah_three', ico: '🏅', title: 'ثلاث سور', desc: '٣ سور كاملة', test: (s) => s.surahs >= 3, prog: (s) => [s.surahs, 3] },
  { id: 'surah_ten', ico: '🏆', title: 'عشر سور', desc: '١٠ سور كاملة', test: (s) => s.surahs >= 10, prog: (s) => [s.surahs, 10] },
  { id: 'ayah_50', ico: '✨', title: 'خمسون آية', desc: '٥٠ آية محفوظة', test: (s) => s.ayahs >= 50, prog: (s) => [s.ayahs, 50] },
  { id: 'ayah_150', ico: '🌟', title: 'مئة وخمسون', desc: '١٥٠ آية', test: (s) => s.ayahs >= 150, prog: (s) => [s.ayahs, 150] },
  { id: 'ayah_300', ico: '💎', title: 'ثلاث مئة', desc: '٣٠٠ آية', test: (s) => s.ayahs >= 300, prog: (s) => [s.ayahs, 300] },
  { id: 'juz_master', ico: '👑', title: 'خاتم الجزء', desc: 'إتمام ٥٦٤ آية', test: (s) => s.ayahs >= TOTAL_AYAT, prog: (s) => [s.ayahs, TOTAL_AYAT] },
  { id: 'streak_3', ico: '🔥', title: 'ثلاثة أيام', desc: 'انتظام ٣ أيام', test: (s) => s.bestStreak >= 3, prog: (s) => [s.bestStreak, 3] },
  { id: 'streak_7', ico: '🚀', title: 'أسبوع كامل', desc: 'انتظام ٧ أيام', test: (s) => s.bestStreak >= 7, prog: (s) => [s.bestStreak, 7] },
  { id: 'streak_30', ico: '🗓️', title: 'شهر انتظام', desc: '٣٠ يومًا متتاليًا', test: (s) => s.bestStreak >= 30, prog: (s) => [s.bestStreak, 30] },
  { id: 'tests_5', ico: '🎯', title: 'خمسة اختبارات', desc: '٥ اختبارات تسميع', test: (s) => s.tests >= 5, prog: (s) => [s.tests, 5] },
  { id: 'perfect', ico: '💯', title: 'تسميع كامل', desc: '١٠٠٪ في اختبار', test: (s) => s.perfect >= 1, prog: (s) => [s.perfect, 1] },
  { id: 'stars_100', ico: '⭐', title: 'مئة نجمة', desc: '١٠٠ نجمة', test: (s) => s.stars >= 100, prog: (s) => [s.stars, 100] },
  { id: 'stars_500', ico: '🌠', title: 'خمس مئة نجمة', desc: '٥٠٠ نجمة', test: (s) => s.stars >= 500, prog: (s) => [s.stars, 500] },
  { id: 'reviews_20', ico: '📖', title: 'مراجع مجتهد', desc: '٢٠ مراجعة', test: (s) => s.reviews >= 20, prog: (s) => [s.reviews, 20] }
];

const PRIZES = [
  { id: 'p50', cost: 50, ico: '🎖️', title: 'بطاقة بطل الأسبوع', desc: 'شارة تعلّقها في غرفتك' },
  { id: 'p150', cost: 150, ico: '🍦', title: 'اختر حلواك المفضلة', desc: 'مكافأة من ماما أو بابا' },
  { id: 'p300', cost: 300, ico: '🎡', title: 'نزهة عائلية', desc: 'رحلة قصيرة مع العائلة' },
  { id: 'p500', cost: 500, ico: '🎁', title: 'هدية خاصة', desc: 'هدية تختارها بنفسك' },
  { id: 'p1000', cost: 1000, ico: '🏆', title: 'المكافأة الكبرى', desc: 'احتفال عائلي بإتمام الجزء' }
];

function checkBadges() {
  if (!D) return;
  const st = stats();
  const newly = [];
  BADGES.forEach((b) => {
    if (D.badges.indexOf(b.id) === -1 && b.test(st)) {
      D.badges.push(b.id);
      newly.push(b);
    }
  });
  if (!newly.length) return;
  saveD();
  newly.forEach((b) => toast('وسام جديد: ' + b.title + ' ' + b.ico, 'gold', 4200));
  confetti(80);
  sfx('win');
  if (state.route === 'rewards') renderView();
}

/* ------------------------- 9) تنبيهات وأصوات ------------------------- */
function toast(msg, type, ms) {
  const box = $('#kToasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'k-toast' + (type === 'ok' ? ' k-toast--ok' : type === 'err' ? ' k-toast--err' : type === 'gold' ? ' k-toast--gold' : '');
  const ico = type === 'ok' ? '✅' : type === 'err' ? '⚠️' : type === 'gold' ? '⭐' : '💡';
  el.innerHTML = '<span>' + ico + '</span><span>' + esc(msg) + '</span>';
  box.appendChild(el);
  setTimeout(function () {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px)';
    setTimeout(function () { el.remove(); }, 280);
  }, ms || 2600);
}

let AC = null;
function sfx(name) {
  if (!D || !D.settings || !D.settings.sound) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!AC) AC = new Ctx();
    if (AC.state === 'suspended') AC.resume();
    const now = AC.currentTime;
    let seq;
    if (name === 'win') seq = [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.31]];
    else if (name === 'ok') seq = [[660, 0], [880, 0.09]];
    else if (name === 'bad') seq = [[196, 0], [165, 0.13]];
    else seq = [[440, 0]];
    seq.forEach(function (p) {
      const o = AC.createOscillator();
      const g = AC.createGain();
      o.type = name === 'bad' ? 'sawtooth' : 'sine';
      o.frequency.value = p[0];
      const t = now + p[1];
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.13, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(AC.destination);
      o.start(t); o.stop(t + 0.32);
    });
  } catch (e) {}
}

let confParts = [], confRAF = 0;
function confetti(n) {
  const cv = $('#kConfetti');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width = window.innerWidth;
  const H = cv.height = window.innerHeight;
  const colors = ['#c9a227', '#3fa3c4', '#1fae7c', '#e96a5b', '#7c6cf0', '#f2a500', '#ffffff'];
  for (let i = 0; i < (n || 80); i++) {
    confParts.push({
      x: Math.random() * W,
      y: -20 - Math.random() * H * 0.4,
      vx: (Math.random() - 0.5) * 3,
      vy: 2 + Math.random() * 4,
      s: 5 + Math.random() * 7,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.2,
      c: colors[Math.floor(Math.random() * colors.length)],
      life: 1
    });
  }
  if (confRAF) return;
  const start = performance.now();
  function frame(t) {
    ctx.clearRect(0, 0, W, H);
    confParts.forEach(function (p) {
      p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vy += 0.045;
      if (p.y > H + 30) p.life = 0;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    });
    confParts = confParts.filter(function (p) { return p.life > 0; });
    if (confParts.length && t - start < 4000) {
      confRAF = requestAnimationFrame(frame);
    } else {
      confRAF = 0;
      ctx.clearRect(0, 0, W, H);
    }
  }
  confRAF = requestAnimationFrame(frame);
}

/* ------------------------- 10) مشغّل تلاوة الحصري ------------------------- */
const audioEl = $('#kAudio');
const AQ = { queue: [], i: 0, repeat: 1, left: 1, cur: null, fb: false, playing: false };

function audioSrc(s, a) {
  return 'https://everyayah.com/data/Husary_128kbps/' + pad3(s) + pad3(a) + '.mp3';
}
function audioFallback(s, a) {
  const g = QURAN_JUZ30[s].g[a - 1];
  return 'https://cdn.islamic.network/quran/audio/128/ar.husary/' + g + '.mp3';
}
function loadCurrent() {
  const item = AQ.queue[AQ.i];
  if (!item) { stopAudio(); return; }
  AQ.cur = item;
  AQ.left = AQ.repeat || 1;
  AQ.fb = false;
  AQ.playing = true;
  audioEl.src = audioSrc(item.s, item.a);
  audioEl.play().catch(function () {});
  updatePlayerBar();
  updatePlayingHighlight();
}
function playRange(s, from, to, repeat) {
  AQ.queue = [];
  for (let a = from; a <= to; a++) AQ.queue.push({ s: s, a: a });
  if (!AQ.queue.length) return;
  AQ.i = 0;
  AQ.repeat = clamp(+repeat || state.repeat || 1, 1, 5);
  state.repeat = AQ.repeat;
  loadCurrent();
}
function playOne(s, a, repeat) {
  AQ.queue = [{ s: s, a: a }];
  AQ.i = 0;
  AQ.repeat = clamp(+repeat || 1, 1, 5);
  loadCurrent();
}
function stopAudio() {
  try { audioEl.pause(); } catch (e) {}
  try { audioEl.removeAttribute('src'); audioEl.load(); } catch (e) {}
  AQ.queue = []; AQ.cur = null; AQ.playing = false;
  const pl = $('#kPlayer');
  if (pl) pl.hidden = true;
  updatePlayingHighlight();
}
function toggleAudioPlay() {
  if (!AQ.cur) return;
  if (audioEl.paused) audioEl.play().catch(function () {});
  else audioEl.pause();
}
function updatePlayerBar() {
  const pl = $('#kPlayer');
  if (!pl) return;
  if (!AQ.cur) { pl.hidden = true; return; }
  pl.hidden = false;
  const nameEl = $('#kPName');
  const subEl = $('#kPSub');
  const repEl = $('#kPRepeat');
  const tog = $('[data-p="toggle"]');
  if (nameEl) nameEl.textContent = 'سورة ' + surahName(AQ.cur.s);
  if (subEl) subEl.textContent = 'الآية ' + ar(AQ.cur.a) + ' · الشيخ محمود خليل الحصري';
  if (repEl) repEl.textContent = '×' + ar(AQ.repeat || 1);
  if (tog) tog.textContent = audioEl.paused ? '▶' : '⏸';
}
function updatePlayingHighlight() {
  $$('.k-ayah').forEach(function (el) {
    const match = AQ.cur && +el.dataset.s === AQ.cur.s && +el.dataset.ayah === AQ.cur.a;
    el.classList.toggle('is-playing', !!match);
  });
}
function scrollToPlaying() {
  if (!AQ.cur) return;
  const el = $('.k-ayah[data-s="' + AQ.cur.s + '"][data-ayah="' + AQ.cur.a + '"]');
  if (el && el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}
if (audioEl) {
  audioEl.addEventListener('ended', function () {
    if (AQ.left > 1) {
      AQ.left--;
      try { audioEl.currentTime = 0; audioEl.play(); } catch (e) {}
      return;
    }
    AQ.i++;
    if (AQ.i >= AQ.queue.length) {
      AQ.playing = false;
      AQ.cur = null;
      AQ.queue = [];
      const pl = $('#kPlayer');
      if (pl) pl.hidden = true;
      updatePlayingHighlight();
      return;
    }
    loadCurrent();
    scrollToPlaying();
  });
  audioEl.addEventListener('error', function () {
    const it = AQ.cur;
    if (!it) return;
    if (!AQ.fb) {
      AQ.fb = true;
      audioEl.src = audioFallback(it.s, it.a);
      audioEl.play().catch(function () {});
    } else {
      toast('تعذّر تحميل التلاوة. تحقّق من اتصال الإنترنت.', 'err', 3800);
      stopAudio();
    }
  });
  audioEl.addEventListener('play', updatePlayerBar);
  audioEl.addEventListener('pause', updatePlayerBar);
  audioEl.addEventListener('timeupdate', function () {
    const fill = $('#kPFill');
    if (!fill) return;
    const d = audioEl.duration || 0;
    fill.style.width = d ? ((audioEl.currentTime / d) * 100) + '%' : '0%';
  });
}

/* ------------------------- 11) عناصر واجهة مشتركة ------------------------- */
function ringSVG(pct, size, big, sub) {
  const r = 46;
  const C = 2 * Math.PI * r;
  const p = clamp(pct, 0, 100);
  const off = C - (C * p) / 100;
  const gid = 'kg' + Math.round(size) + '_' + Math.round(p);
  return '<div class="k-ring" style="width:' + size + 'px;height:' + size + 'px">' +
    '<svg width="' + size + '" height="' + size + '" viewBox="0 0 110 110" aria-hidden="true">' +
    '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#1fae7c"/><stop offset="1" stop-color="#3fa3c4"/>' +
    '</linearGradient></defs>' +
    '<circle class="k-ring-bg" cx="55" cy="55" r="' + r + '" fill="none" stroke-width="11"/>' +
    '<circle class="k-ring-fg" cx="55" cy="55" r="' + r + '" fill="none" stroke-width="11" style="stroke:url(#' + gid + ')" stroke-dasharray="' + C + '" stroke-dashoffset="' + off + '"/>' +
    '</svg><div class="k-ring-txt"><b>' + big + '</b><small>' + (sub || '') + '</small></div></div>';
}
function weekStrip() {
  const cells = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    const rec = D.days[key];
    const active = !!(rec && (rec.learned || rec.tests));
    cells.push('<div class="k-day' + (active ? ' is-on' : '') + (i === 0 ? ' is-today' : '') + '">' +
      '<span>' + DAY_NAMES[d.getDay()] + '</span>' +
      '<i>' + (active ? '✓' : ar(d.getDate())) + '</i></div>');
  }
  return '<div class="k-week">' + cells.join('') + '</div>';
}

/* ------------------------- 12) هيكل التطبيق ------------------------- */
function renderChrome() {
  if (!USER || !D) return;
  const lv = levelInfo(D.stars);
  const set = function (id, txt) { const el = $('#' + id); if (el) el.textContent = txt; };
  set('kSideAvatar', USER.avatar);
  set('kTopAvatar', USER.avatar);
  set('kSideName', USER.name);
  set('kTopName', USER.name);
  set('kSideLevel', lv.cur.name);
  set('kTopLevel', lv.cur.name);
  set('kSideStars', ar(D.stars));
  set('kTopStars', ar(D.stars));
  set('kNavStars', ar(D.stars) + ' ⭐');
  const sideTheme = $('#kThemeSide');
  const topTheme = $('#kThemeTop');
  const dark = document.body.classList.contains('dark');
  if (sideTheme) sideTheme.textContent = dark ? '☀️ الوضع النهاري' : '🌙 الوضع الليلي';
  if (topTheme) topTheme.textContent = dark ? '☀️' : '🌙';
}
function syncNav() {
  const active = state.route === 'test' ? 'memorize' : state.route;
  $$('.k-nav-item, .k-tab').forEach(function (b) {
    b.classList.toggle('is-on', b.dataset.go === active);
  });
}
function go(route, params, skipHash) {
  if (!ROUTES.includes(route)) route = 'home';
  if (state.route === 'test' && route !== 'test') resetTest();
  if (route === 'memorize' && !state.mem) {
    const p = nextNewPortion() || D.portions[0] || planAll(D.settings.wird)[0];
    if (p) state.mem = { s: p.s, from: p.from, to: p.to, key: p.key || portionKey(p.s, p.from, p.to) };
  }
  state.route = route;
  state.params = params || {};
  if (!skipHash) {
    try { history.replaceState(null, '', '#' + route); } catch (e) {}
  }
  renderChrome();
  renderView();
  syncNav();
  try { window.scrollTo(0, 0); } catch (e) {}
}
function renderView() {
  const main = $('#kMain');
  if (!main) return;
  let html = '';
  switch (state.route) {
    case 'home': html = viewHome(); break;
    case 'wird': html = viewWird(); break;
    case 'memorize': html = viewMemorize(); break;
    case 'test': html = viewTest(); break;
    case 'rewards': html = viewRewards(); break;
    case 'certs': html = viewCerts(); break;
    case 'settings': html = viewSettings(); break;
    default: html = viewHome();
  }
  main.innerHTML = html;
  if (state.route === 'memorize') requestAnimationFrame(updatePlayingHighlight);
}

/* ------------------------- 13) لوحة الطفل ------------------------- */
function viewHome() {
  const st = stats();
  const pct = Math.round((st.ayahs / TOTAL_AYAT) * 100);
  const next = nextNewPortion();
  const due = dueReviews();
  const day = D.days[todayKey()] || { learned: 0, tests: 0, stars: 0 };
  const newDone = day.learned > 0;
  const lv = levelInfo(D.stars);
  const h = new Date().getHours();
  const greet = h < 12 ? 'صباح الخير' : h < 17 ? 'طاب يومك' : 'مساء الخير';
  const earnedBadges = BADGES.filter(function (b) { return D.badges.indexOf(b.id) > -1; });
  const nextPrize = PRIZES.find(function (p) {
    return !D.prizes.some(function (x) { return x.id === p.id; });
  });

  const nextPrizeHtml = nextPrize ? (
    '<div class="k-card" style="margin-top:16px">' +
      '<div class="k-sec-title" style="margin:0 0 10px"><span>🎁 جائزتك القادمة</span><small>' + ar(D.stars) + ' / ' + ar(nextPrize.cost) + ' ⭐</small></div>' +
      '<div style="display:flex;align-items:center;gap:12px">' +
        '<div style="font-size:34px;line-height:1">' + nextPrize.ico + '</div>' +
        '<div style="flex:1;min-width:0"><b style="font-size:14px">' + nextPrize.title + '</b>' +
        '<div class="k-bar k-bar--gold" style="margin-top:6px"><i style="width:' + clamp((D.stars / nextPrize.cost) * 100, 0, 100) + '%"></i></div></div>' +
        '<div class="k-chip k-chip--gold">' + ar(Math.max(0, nextPrize.cost - D.stars)) + ' ⭐</div>' +
      '</div></div>'
  ) : '';

  const badgeHtml = earnedBadges.length ? (
    '<div class="k-card" style="margin-top:16px">' +
      '<div class="k-sec-title" style="margin:0 0 10px"><span>🏅 أوسمتي</span><small>' + ar(earnedBadges.length) + ' من ' + ar(BADGES.length) + '</small></div>' +
      '<div class="k-badge-strip">' + earnedBadges.slice(-6).map(function (b) {
        return '<span class="k-badge-mini"><i>' + b.ico + '</i>' + b.title + '</span>';
      }).join('') + '</div></div>'
  ) : '';

  return '' +
  '<div class="k-hero">' +
    '<div class="k-hero-main">' +
      '<div class="k-av" aria-hidden="true">' + USER.avatar + '</div>' +
      '<div><h2>' + greet + '، <span>' + esc(USER.name) + '</span> 👋</h2>' +
      '<p>' + fmtDate(todayKey()) + ' · ' + (newDone ? 'أنجزت ورد اليوم، أحسنت! 🌟' : 'وردك اليوم بانتظارك، هيا نبدأ!') + '</p></div>' +
    '</div>' +
    '<div class="k-hero-side">' +
      '<div class="k-hero-pill">🔥 <b>' + ar(D.streak.count) + '</b> يوم متتابع</div>' +
      '<div class="k-hero-pill">⭐ <b>' + ar(D.stars) + '</b> نجمة</div>' +
    '</div>' +
  '</div>' +

  '<div class="k-card k-progress-card" style="margin-top:16px">' +
    ringSVG(pct, 110, ar(pct) + '٪', 'من الجزء') +
    '<div class="k-progress-info">' +
      '<h3>أتممت ' + ar(st.ayahs) + ' من ' + ar(TOTAL_AYAT) + ' آية</h3>' +
      '<p>' + ar(st.surahs) + ' سورة كاملة · ' + ar(st.portions) + ' وردًا محفوظًا · ' + lv.cur.ico + ' ' + lv.cur.name + '</p>' +
      '<div class="k-bar"><i style="width:' + clamp(pct, 0, 100) + '%"></i></div>' +
      '<div class="k-mini-stats">' +
        '<span class="k-mini-stat">🏅 <b>' + ar(D.badges.length) + '</b> وسام</span>' +
        '<span class="k-mini-stat">📝 <b>' + ar(D.tests.length) + '</b> اختبار</span>' +
        '<span class="k-mini-stat">🎯 <b>' + ar(avgScore()) + '٪</b> متوسط النتائج</span>' +
      '</div>' +
    '</div>' +
  '</div>' +

  '<div class="k-sec-title"><span>📅 ورد اليوم</span><small>' + (newDone ? 'أنجزت حفظ اليوم ✓' : 'لم تبدأ بعد') + '</small></div>' +
  '<div class="k-grid-2">' +
    '<div class="k-plan">' +
      '<div class="k-plan-head"><div class="k-plan-ico">📖</div><div><b>حفظ جديد</b><small>' + ar(D.settings.wird) + ' آيات في الورد</small></div></div>' +
      (next
        ? '<div class="k-plan-body">سورة <b>' + surahName(next.s) + '</b><br><span class="k-range">الآيات ' + ar(next.from) + '–' + ar(next.to) + '</span></div>'
        : '<div class="k-plan-body">أتممت حفظ الجزء كاملًا! 🎉 راجع لتحافظ عليه.</div>') +
      (newDone ? '<div class="k-plan-done">✓ أنجزت حفظ اليوم</div>' : '') +
      '<button class="k-btn k-btn--primary" data-act="start-new">' + (newDone ? 'راجع حفظك' : 'ابدأ الحفظ') + ' ←</button>' +
    '</div>' +
    '<div class="k-plan k-plan--review">' +
      '<div class="k-plan-head"><div class="k-plan-ico">🔁</div><div><b>مراجعة اليوم</b><small>' + (due.length ? ar(due.length) + ' ورد مستحق' : 'لا يوجد مستحق') + '</small></div></div>' +
      (due.length
        ? '<div class="k-plan-body">' + due.slice(0, 2).map(function (p) {
            return 'سورة <b>' + surahName(p.s) + '</b> · ' + ar(p.from) + '–' + ar(p.to);
          }).join('<br>') + (due.length > 2 ? '<br><span class="k-muted">و' + ar(due.length - 2) + ' أخرى…</span>' : '') + '</div>'
        : '<div class="k-plan-body">ما شاء الله! لا مراجعات مستحقة اليوم.<br><span class="k-muted" style="font-size:12.5px">يمكنك مراجعة أي ورد محفوظ.</span></div>') +
      '<button class="k-btn ' + (due.length ? 'k-btn--gold' : 'k-btn--soft') + '" data-act="' + (due.length ? 'start-review' : 'free-review') + '">' + (due.length ? 'ابدأ المراجعة' : 'مراجعة حرة') + ' ←</button>' +
    '</div>' +
  '</div>' +

  '<div class="k-sec-title"><span>🔥 انتظامي هذا الأسبوع</span><small>أفضل سلسلة: ' + ar(D.streak.best || 0) + ' يوم</small></div>' +
  '<div class="k-card k-card--flat">' + weekStrip() + '</div>' +

  '<div class="k-sec-title"><span>⚡ اختصارات</span></div>' +
  '<div class="k-quick">' +
    '<button class="k-quick-btn" data-act="quick-test"><i>🎙️</i> تسميع سريع<small>اختبر حفظك</small></button>' +
    '<button class="k-quick-btn" data-go="rewards"><i>🏆</i> جوائزي<small>' + ar(D.prizes.length) + ' جائزة</small></button>' +
    '<button class="k-quick-btn" data-go="certs"><i>📜</i> شهاداتي<small>' + ar(availableCerts().length) + ' شهادة</small></button>' +
    '<button class="k-quick-btn" data-act="pick-portion"><i>🔀</i> اختر وردك<small>حفظ أو مراجعة</small></button>' +
  '</div>' +

  nextPrizeHtml + badgeHtml;
}

/* ------------------------- 14) ورد اليوم ------------------------- */
function viewWird() {
  const next = nextNewPortion();
  const due = dueReviews();
  const soon = upcomingReviews(4);
  const day = D.days[todayKey()] || { learned: 0, tests: 0, stars: 0 };

  const dueHtml = due.length ? due.map(function (p) {
    return '<div class="k-review-item">' +
      '<div class="k-ri-ico">📖</div>' +
      '<div class="k-ri-txt"><b>سورة ' + surahName(p.s) + '</b>' +
      '<small>الآيات ' + ar(p.from) + '–' + ar(p.to) + ' · مرحلة ' + ar((p.stage || 0) + 1) + ' من ' + ar(SRS_DAYS.length) + '</small></div>' +
      '<div class="k-ri-actions">' +
        '<button class="k-icon-btn" data-act="play-portion" data-s="' + p.s + '" data-from="' + p.from + '" data-to="' + p.to + '" aria-label="استمع">▶</button>' +
        '<button class="k-btn k-btn--sm k-btn--primary" data-act="test-portion" data-s="' + p.s + '" data-from="' + p.from + '" data-to="' + p.to + '">سمّع</button>' +
      '</div></div>';
  }).join('') : '<div class="k-empty"><span class="k-empty-ico">🌈</span>لا توجد مراجعات مستحقة اليوم.<br>أحسنت! يمكنك مراجعة أي ورد محفوظ متى شئت.</div>';

  const soonHtml = soon.length ? (
    '<div class="k-sec-title"><span>⏳ مراجعات قادمة</span><small>بعد أيام قليلة</small></div>' +
    '<div class="k-review-list">' + soon.map(function (p) {
      return '<div class="k-review-item" style="opacity:.82">' +
        '<div class="k-ri-ico" style="background:var(--k-sky-soft)">🗓️</div>' +
        '<div class="k-ri-txt"><b>سورة ' + surahName(p.s) + '</b><small>الآيات ' + ar(p.from) + '–' + ar(p.to) + ' · ' + fmtDate(p.next) + '</small></div>' +
        '<button class="k-btn k-btn--sm k-btn--ghost" data-act="play-portion" data-s="' + p.s + '" data-from="' + p.from + '" data-to="' + p.to + '">▶ استمع</button>' +
        '</div>';
    }).join('') + '</div>'
  ) : '';

  return '' +
  '<div class="k-wird-head"><div><h2>📅 وردي اليوم</h2><p>' + fmtDate(todayKey()) + ' · حفظ جديد + مراجعة</p></div>' +
    '<button class="k-btn k-btn--soft k-btn--sm" data-act="pick-portion">🔀 اختر وردًا آخر</button></div>' +

  '<div class="k-card k-card--flat" style="margin-bottom:16px;padding:14px">' + weekStrip() + '</div>' +

  '<div class="k-sec-title" style="margin-top:0"><span>📖 الحفظ الجديد</span><small>' + (day.learned ? 'أنجزت ✓' : 'لم يبدأ') + '</small></div>' +
  (next ? (
    '<div class="k-plan">' +
      '<div class="k-plan-head"><div class="k-plan-ico">🌱</div><div><b>سورة ' + surahName(next.s) + '</b><small>الآيات ' + ar(next.from) + '–' + ar(next.to) + ' · ' + ar(next.to - next.from + 1) + ' آيات</small></div></div>' +
      '<div class="k-plan-body" style="font-family:\'Amiri Quran\',serif;font-size:21px;line-height:2;color:var(--k-muted)">' +
        esc(ayahText(next.s, next.from)) + ' …' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="k-btn k-btn--primary" data-act="open-portion" data-s="' + next.s + '" data-from="' + next.from + '" data-to="' + next.to + '">📖 ابدأ الحفظ</button>' +
        '<button class="k-btn k-btn--soft" data-act="play-portion" data-s="' + next.s + '" data-from="' + next.from + '" data-to="' + next.to + '">▶ استمع أولًا</button>' +
      '</div>' +
    '</div>'
  ) : '<div class="k-empty"><span class="k-empty-ico">👑</span>أتممت حفظ جزء عمَّ كاملًا!<br>واصل المراجعة لتحافظ على حفظك.</div>') +

  '<div class="k-sec-title"><span>🔁 المراجعة المستحقة</span><small>' + (due.length ? ar(due.length) + ' ورد' : 'لا شيء') + '</small></div>' +
  '<div class="k-review-list">' + dueHtml + '</div>' +

  '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">' +
    '<button class="k-btn k-btn--gold" data-act="start-review" ' + (due.length ? '' : 'disabled') + '>🎙️ ابدأ مراجعة اليوم</button>' +
    '<button class="k-btn k-btn--ghost" data-act="free-review">📚 مراجعة حرة</button>' +
  '</div>' +

  soonHtml;
}

/* ------------------------- 15) شاشة الحفظ ------------------------- */
function viewMemorize() {
  const p = state.mem;
  if (!p) {
    return '<div class="k-empty"><span class="k-empty-ico">📖</span>لم يتم اختيار ورد بعد.<br>' +
      '<button class="k-btn k-btn--primary" data-act="pick-portion" style="margin-top:12px">اختر وردًا</button></div>';
  }
  const s = p.s;
  const ayats = QURAN_JUZ30[s].ayat;
  const learned = isLearned(p.key);
  const rows = [];
  if (p.from === 1) {
    rows.push('<div style="text-align:center;font-family:\'Amiri Quran\',serif;font-size:34px;color:var(--k-gold);margin-bottom:8px" aria-label="بسم الله الرحمن الرحيم">﷽</div>');
  }
  for (let a = p.from; a <= p.to; a++) {
    const hidden = state.hide && !state.shown.has(a);
    const wc = wordsOf(s, a).length;
    rows.push(
      '<div class="k-ayah' + (hidden ? ' is-hidden' : '') + '" data-s="' + s + '" data-ayah="' + a + '">' +
        '<div class="k-ayah-num">' + ar(a) + '</div>' +
        '<div class="k-ayah-body">' +
          '<div class="k-ayah-text">' + ayahText(s, a) + '</div>' +
          '<div class="k-ayah-tools">' +
            '<button class="k-icon-btn" data-act="play-ayah" data-s="' + s + '" data-a="' + a + '" aria-label="استمع للآية" title="استمع">▶</button>' +
            '<button class="k-icon-btn" data-act="loop-ayah" data-s="' + s + '" data-a="' + a + '" aria-label="تكرار الآية ٣ مرات" title="تكرار ×٣">🔁</button>' +
            '<button class="k-icon-btn" data-act="toggle-ayah" data-a="' + a + '" aria-label="إظهار أو إخفاء الآية" title="إظهار/إخفاء">👁️</button>' +
            '<span class="k-chip">' + ar(wc) + ' كلمات</span>' +
          '</div>' +
          '<div class="k-hide-hint">اضغط 👁️ لكشف الآية بعد التسميع</div>' +
        '</div>' +
      '</div>'
    );
  }

  return '' +
  '<div class="k-mem-head">' +
    '<div class="k-mh-ico">📖</div>' +
    '<div><h2>سورة ' + surahName(s) + '</h2>' +
      '<p>الآيات ' + ar(p.from) + '–' + ar(p.to) + ' · ' + ar(p.to - p.from + 1) + ' آيات · الجزء ٣٠</p></div>' +
    '<div class="k-mh-actions">' +
      (learned ? '<span class="k-chip k-chip--mint">✓ محفوظ</span>' : '') +
      '<button class="k-btn k-btn--ghost k-btn--sm" data-act="mem-change">🔀 تغيير</button>' +
    '</div>' +
  '</div>' +

  '<div class="k-card k-card--flat" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px;margin-bottom:14px">' +
    '<button class="k-btn k-btn--primary k-btn--sm" data-act="play-portion" data-s="' + s + '" data-from="' + p.from + '" data-to="' + p.to + '">▶ استمع للورد كاملًا</button>' +
    '<button class="k-btn k-btn--soft k-btn--sm" data-act="play-surah" data-s="' + s + '">🎧 السورة كاملة</button>' +
    '<button class="k-btn k-btn--soft k-btn--sm" data-act="cycle-repeat">🔁 التكرار ×' + ar(state.repeat) + '</button>' +
    '<button class="k-btn k-btn--sm ' + (state.hide ? 'k-btn--gold' : 'k-btn--ghost') + '" data-act="toggle-hide">' + (state.hide ? '👁️ إظهار النص' : '🙈 إخفاء النص') + '</button>' +
    '<span class="k-muted" style="font-size:11.5px;margin-inline-start:auto">💡 استمع ٣ مرات ثم سمّع من حفظك</span>' +
  '</div>' +

  rows.join('') +

  '<div class="k-mem-actions">' +
    '<button class="k-btn k-btn--mint k-btn--lg" data-act="mark-learned" ' + (learned ? 'disabled' : '') + '>' +
      (learned ? '✓ محفوظ مسبقًا' : '🎉 أتممت حفظ الورد') + '</button>' +
    '<button class="k-btn k-btn--primary k-btn--lg" data-act="test-current">🎙️ اختبرني في هذا الورد</button>' +
  '</div>' +

  '<p class="k-muted" style="text-align:center;font-size:11.5px;margin-top:16px">' +
    'التلاوة بصوت الشيخ محمود خليل الحصري رحمه الله</p>';
}

/* ------------------------- 16) محرك الاختبار والتسميع ------------------------- */
let _allWords = null;
function ALL_WORDS() {
  if (_allWords) return _allWords;
  const set = new Set();
  for (let s = 78; s <= 114; s++) {
    QURAN_JUZ30[s].ayat.forEach(function (txt) {
      txt.split(' ').forEach(function (w) {
        const bare = stripHarakat(w);
        if (bare.length >= 2 && bare.length <= 14) set.add(w);
      });
    });
  }
  _allWords = Array.from(set);
  return _allWords;
}

const REC = { mr: null, stream: null, chunks: [], timer: null, sec: 0, url: null };

function resetTest() {
  stopRecorder(true);
  state.test = null;
  state.testIntro = null;
}
function openTestIntro(p, back) {
  state.testIntro = { s: p.s, from: p.from, to: p.to, key: p.key || portionKey(p.s, p.from, p.to) };
  state.back = back || (state.route === 'test' ? state.back : state.route);
  state.test = null;
  stopRecorder(true);
  go('test');
}

function viewTest() {
  if (state.test) {
    return state.test.phase === 'result' ? viewTestResult() : viewTestQuestion();
  }
  if (!state.testIntro) {
    const p = state.mem || nextNewPortion() || D.portions[0];
    if (p) state.testIntro = { s: p.s, from: p.from, to: p.to, key: p.key || portionKey(p.s, p.from, p.to) };
  }
  if (!state.testIntro) {
    return '<div class="k-empty"><span class="k-empty-ico">📖</span>لا يوجد ورد لتسميعه بعد.<br>' +
      '<button class="k-btn k-btn--primary" data-go="home" style="margin-top:12px">ابدأ الحفظ أولًا</button></div>';
  }
  return viewTestIntro();
}

function viewTestIntro() {
  const p = state.testIntro;
  const wordsCount = p.to - p.from + 1;
  const modes = [
    { id: 'self', ico: '🙋', title: 'تسميع آية بآية', desc: 'سمّع من حفظك ثم اكشف الآية وصحّح لنفسك بصدق.' },
    { id: 'words', ico: '🧩', title: 'ترتيب الكلمات', desc: 'اضغط الكلمات بالترتيب الصحيح — تصحيح تلقائي.' },
    { id: 'blank', ico: '✏️', title: 'أكمل الفراغ', desc: 'اختر الكلمة الناقصة من الآية — تصحيح تلقائي.' },
    { id: 'record', ico: '🎙️', title: 'سجّل صوتك', desc: 'سجّل تسميعك، استمع إليه، وقارنه بتلاوة الشيخ.' }
  ];
  const recordOk = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  return '' +
  '<div class="k-test-wrap">' +
    '<div class="k-test-top">' +
      '<button class="k-icon-btn" data-act="test-back" aria-label="رجوع">→</button>' +
      '<div style="flex:1"><b style="font-size:17px">🎙️ التسميع والتصحيح</b>' +
      '<div class="k-muted" style="font-size:12px;font-weight:700">' + pLabel(p.s, p.from, p.to) + '</div></div>' +
    '</div>' +
    '<div class="k-card" style="margin-bottom:16px">' +
      '<div class="k-q-label"><b>ورد التسميع</b><span class="k-chip">' + ar(wordsCount) + ' آيات</span></div>' +
      '<div class="k-q-ayah" style="font-size:26px;padding:8px">' + esc(ayahText(p.s, p.from)) + (wordsCount > 1 ? ' <span class="k-muted" style="font-family:Cairo;font-size:16px">…</span>' : '') + '</div>' +
      '<div style="text-align:center"><button class="k-btn k-btn--soft k-btn--sm" data-act="play-portion" data-s="' + p.s + '" data-from="' + p.from + '" data-to="' + p.to + '">🎧 استمع للورد أولًا</button></div>' +
    '</div>' +
    '<div class="k-sec-title" style="margin-top:0"><span>اختر طريقة التسميع</span><small>يمكنك تجربة كل الطرق</small></div>' +
    '<div class="k-mode-grid">' +
      modes.map(function (m) {
        const off = m.id === 'record' && !recordOk;
        return '<button class="k-mode" data-act="begin-test" data-mode="' + m.id + '"' + (off ? ' title="غير مدعوم على هذا المتصفح"' : '') + '>' +
          '<i>' + m.ico + '</i><div><b>' + m.title + (off ? ' <span class="k-chip k-chip--coral" style="font-size:9px">قد لا يعمل</span>' : '') + '</b>' +
          '<small>' + m.desc + '</small></div></button>';
      }).join('') +
    '</div>' +
    '<p class="k-muted" style="text-align:center;font-size:11.5px;margin-top:16px;line-height:1.9">' +
      '💡 نصيحة: التسميع الذاتي الصادق يجعلك تحفظ أسرع. إن أخطأت، أعد الآية في المراجعة.</p>' +
  '</div>';
}

function beginTest(mode) {
  const p = state.testIntro;
  if (!p) return;
  if (mode === 'record' && !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)) {
    toast('تسجيل الصوت غير مدعوم على هذا المتصفح، سنستخدم التسميع الذاتي.', 'err', 4200);
    mode = 'self';
  }
  stopRecorder(true);
  state.test = {
    s: p.s, from: p.from, to: p.to, key: p.key, mode: mode, phase: 'q',
    i: 0, correct: 0, total: 0, items: [], results: [],
    cur: null, revealed: false, checked: false, words: [], bank: [], placed: [], wordsOk: null,
    blank: null, answered: false, chosen: -1,
    recording: false, recUrl: null, textShown: false
  };
  buildItems();
  renderView();
}

function buildItems() {
  const t = state.test;
  const all = [];
  for (let a = t.from; a <= t.to; a++) all.push(a);
  if (t.mode === 'words') {
    let pool = all.filter(function (a) { const n = wordsOf(t.s, a).length; return n >= 2 && n <= 12; });
    if (!pool.length) pool = all.slice();
    t.items = shuffle(pool).slice(0, Math.min(5, pool.length));
  } else if (t.mode === 'blank') {
    let pool = all.filter(function (a) { return wordsOf(t.s, a).length >= 3; });
    if (!pool.length) pool = all.slice();
    t.items = shuffle(pool).slice(0, Math.min(5, pool.length));
  } else {
    t.items = all.slice();
  }
  t.total = t.items.length;
  t.i = 0;
  t.correct = 0;
  t.results = [];
  prepItem();
}

function prepItem() {
  const t = state.test;
  if (!t) return;
  t.cur = t.items[t.i];
  t.revealed = false;
  t.checked = false;
  t.answered = false;
  t.chosen = -1;
  t.wordsOk = null;
  t.recUrl = null;
  t.recording = false;
  t.textShown = false;
  if (t.mode === 'words') {
    t.words = wordsOf(t.s, t.cur);
    t.placed = [];
    t.bank = shuffle(t.words.map(function (w, i) { return { w: w, i: i }; }));
  }
  if (t.mode === 'blank') {
    const words = wordsOf(t.s, t.cur);
    const cands = [];
    words.forEach(function (w, i) { if (stripHarakat(w).length >= 3) cands.push({ w: w, i: i }); });
    const target = pickOne(cands.length ? cands : [{ w: words[0], i: 0 }]);
    const targetBare = stripHarakat(target.w);
    const opts = [target.w];
    shuffle(ALL_WORDS()).forEach(function (w) {
      if (opts.length < 4 && opts.indexOf(w) === -1 && stripHarakat(w) !== targetBare) opts.push(w);
    });
    t.blank = { idx: target.i, w: target.w, opts: shuffle(opts) };
  }
}

function viewTestQuestion() {
  const t = state.test;
  const steps = t.items.map(function (_, i) {
    return '<i class="' + (i < t.i ? 'is-done' : i === t.i ? 'is-cur' : '') + '"></i>';
  }).join('');
  const head = '<div class="k-test-top">' +
    '<button class="k-icon-btn" data-act="exit-test" aria-label="إنهاء الاختبار">✕</button>' +
    '<div class="k-steps">' + steps + '</div>' +
    '<span class="k-chip">' + ar(t.i + 1) + ' / ' + ar(t.total) + '</span>' +
    '</div>';
  let body = '';
  if (t.mode === 'self') body = qSelf(t);
  else if (t.mode === 'words') body = qWords(t);
  else if (t.mode === 'blank') body = qBlank(t);
  else body = qRecord(t);
  return '<div class="k-test-wrap">' + head + body + '</div>';
}

function qSelf(t) {
  const text = ayahText(t.s, t.cur);
  return '<div class="k-q">' +
    '<div class="k-q-label"><b>سمّع الآية ' + ar(t.cur) + '</b><span class="k-chip">تسميع ذاتي</span></div>' +
    '<div class="k-q-ayah is-blurred" aria-hidden="true">' + text + '</div>' +
    '<div style="text-align:center;margin:0 0 14px">' +
      '<button class="k-btn k-btn--soft k-btn--sm" data-act="play-ayah" data-s="' + t.s + '" data-a="' + t.cur + '">🎧 اسمع من الشيخ</button>' +
    '</div>' +
    (t.revealed
      ? '<div class="k-reveal-box"><b>الآية الصحيحة — قارن تسميعك</b><p>' + text + '</p></div>' +
        '<div class="k-grade-row">' +
          '<button class="k-btn k-btn--mint" data-act="grade" data-ok="1">✓ أحسنت، صحيحة</button>' +
          '<button class="k-btn k-btn--coral" data-act="grade" data-ok="0">✗ أحتاج إعادة</button>' +
        '</div>'
      : '<button class="k-btn k-btn--primary k-btn--wide k-btn--lg" data-act="reveal">👁️ سمّعتُ، أظهر الآية للمقارنة</button>' +
        '<p class="k-muted" style="text-align:center;font-size:11.5px;margin-top:10px">سمّع بصوت واضح أولًا، ثم اكشف الآية وصحّح بصدق.</p>') +
    '</div>';
}

function qWords(t) {
  const bankHtml = t.bank.map(function (tok, idx) {
    return '<button class="k-word" data-act="word-bank" data-i="' + idx + '">' + tok.w + '</button>';
  }).join('');
  const placedHtml = t.placed.map(function (tok, idx) {
    const cls = t.checked ? (t.wordsOk ? 'is-ok' : 'is-bad') : 'is-placed';
    return '<button class="k-word ' + cls + '" data-act="word-placed" data-i="' + idx + '"' + (t.checked ? ' disabled' : '') + '>' + tok.w + '</button>';
  }).join('');
  return '<div class="k-q">' +
    '<div class="k-q-label"><b>رتّب كلمات الآية ' + ar(t.cur) + '</b><span class="k-chip">تصحيح تلقائي</span></div>' +
    '<div class="k-word-slots">' + placedHtml + '</div>' +
    '<div class="k-word-bank">' + bankHtml + '</div>' +
    (t.checked
      ? '<div class="k-reveal-box" style="background:' + (t.wordsOk ? 'var(--k-mint-soft)' : 'var(--k-coral-soft)') + ';border-color:' + (t.wordsOk ? 'var(--k-mint)' : 'var(--k-coral)') + '">' +
          '<b style="color:' + (t.wordsOk ? 'var(--k-mint)' : 'var(--k-coral)') + '">' + (t.wordsOk ? '✓ ترتيب صحيح، أحسنت!' : '✗ الترتيب الصحيح هو:') + '</b>' +
          '<p>' + t.words.join(' ') + '</p></div>' +
        '<button class="k-btn k-btn--primary k-btn--wide" data-act="next-item" style="margin-top:12px">التالي ←</button>'
      : '<p class="k-muted" style="text-align:center;font-size:11.5px;margin-top:8px">اضغط الكلمات بالترتيب. اضغط كلمة موضوعة لإرجاعها.</p>') +
    '</div>';
}

function qBlank(t) {
  const words = wordsOf(t.s, t.cur);
  const correctIdx = t.blank.opts.indexOf(t.blank.w);
  const opts = t.blank.opts.map(function (w, idx) {
    let cls = 'k-opt';
    if (t.answered) {
      if (idx === correctIdx) cls += ' is-ok';
      else if (idx === t.chosen) cls += ' is-bad';
    }
    return '<button class="' + cls + '" data-act="blank-opt" data-i="' + idx + '"' + (t.answered ? ' disabled' : '') + '>' + w + '</button>';
  }).join('');
  const rendered = words.map(function (w, i) {
    return i === t.blank.idx ? '<span class="k-blank">؟؟؟</span>' : esc(w);
  }).join(' ');
  const ok = t.chosen === correctIdx;
  return '<div class="k-q">' +
    '<div class="k-q-label"><b>أكمل الآية ' + ar(t.cur) + '</b><span class="k-chip">اختر الكلمة</span></div>' +
    '<div class="k-q-ayah">' + rendered + '</div>' +
    '<div class="k-options">' + opts + '</div>' +
    (t.answered
      ? '<div class="k-reveal-box" style="margin-top:12px;background:' + (ok ? 'var(--k-mint-soft)' : 'var(--k-coral-soft)') + ';border-color:' + (ok ? 'var(--k-mint)' : 'var(--k-coral)') + '">' +
          '<b style="color:' + (ok ? 'var(--k-mint)' : 'var(--k-coral)') + '">' + (ok ? '✓ إجابة صحيحة!' : '✗ الكلمة الصحيحة: ' + t.blank.w) + '</b></div>'
      : '') +
    '</div>';
}

function qRecord(t) {
  const text = ayahText(t.s, t.cur);
  const gradeRow = '<div class="k-grade-row">' +
    '<button class="k-btn k-btn--mint" data-act="grade" data-ok="1">✓ تسميعي صحيح</button>' +
    '<button class="k-btn k-btn--coral" data-act="grade" data-ok="0">↺ أحتاج إعادة</button>' +
    '</div>';
  let recBody;
  if (t.recording) {
    recBody = '<button class="k-btn k-btn--coral k-btn--wide" data-act="rec-toggle">⏹️ أوقف التسجيل</button>';
  } else if (t.recUrl || t.textShown) {
    recBody = (t.recUrl
        ? '<audio class="k-rec-audio" controls src="' + t.recUrl + '"></audio>'
        : '<p class="k-muted" style="font-size:11.5px;margin:0 0 8px">الميكروفون غير متاح؟ قارن تسميعك بالنص ثم صحّح لنفسك بصدق.</p>') +
      gradeRow +
      (t.recUrl
        ? '<button class="k-btn k-btn--ghost k-btn--sm" data-act="rec-again" style="margin-top:8px">🎙️ سجّل مرة أخرى</button>'
        : '<button class="k-btn k-btn--ghost k-btn--sm" data-act="rec-toggle" style="margin-top:8px">🎙️ حاول التسجيل</button>');
  } else {
    recBody = '<button class="k-btn k-btn--primary k-btn--wide k-btn--lg" data-act="rec-toggle">🎙️ ابدأ التسجيل</button>' +
      '<p class="k-muted" style="font-size:11.5px;margin-top:8px">سيطلب المتصفح إذن الميكروفون. سجّل تسميعك ثم قارنه بالشيخ.</p>';
  }
  return '<div class="k-q">' +
    '<div class="k-q-label"><b>سمّع الآية ' + ar(t.cur) + ' بصوتك</b><span class="k-chip k-chip--coral">تسجيل صوتي</span></div>' +
    '<div class="k-q-ayah ' + (t.textShown ? '' : 'is-blurred') + '">' + text + '</div>' +
    '<div style="text-align:center;margin-bottom:10px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap">' +
      '<button class="k-btn k-btn--soft k-btn--sm" data-act="play-ayah" data-s="' + t.s + '" data-a="' + t.cur + '">🎧 استمع للشيخ الحصري</button>' +
      (t.textShown ? '' : '<button class="k-btn k-btn--ghost k-btn--sm" data-act="reveal-text">👁️ أظهر النص</button>') +
    '</div>' +
    '<div class="k-rec-box">' +
      '<div class="k-rec-ring ' + (t.recording ? 'is-rec' : '') + '">' + (t.recording ? '⏺️' : '🎙️') + '</div>' +
      '<div class="k-rec-timer">' + mmss(REC.sec) + '</div>' +
      recBody +
    '</div></div>';
}

async function startRec() {
  const t = state.test;
  if (!t) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
    toast('تسجيل الصوت غير مدعوم على هذا المتصفح.', 'err', 3800);
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    let mime = '';
    const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];
    for (let i = 0; i < types.length; i++) {
      try { if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i])) { mime = types[i]; break; } } catch (e) {}
    }
    const mr = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    REC.stream = stream;
    REC.mr = mr;
    REC.chunks = [];
    REC.sec = 0;
    if (REC.url) { try { URL.revokeObjectURL(REC.url); } catch (e) {} REC.url = null; }
    mr.ondataavailable = function (e) { if (e.data && e.data.size) REC.chunks.push(e.data); };
    mr.onstop = onRecStop;
    mr.start();
    t.recording = true;
    t.recUrl = null;
    renderView();
    clearInterval(REC.timer);
    REC.timer = setInterval(function () {
      REC.sec++;
      const el = $('.k-rec-timer');
      if (el) el.textContent = mmss(REC.sec);
    }, 1000);
  } catch (e) {
    toast('لم نتمكن من الوصول إلى الميكروفون. اسمح للتطبيق بالتسجيل ثم أعد المحاولة.', 'err', 4500);
  }
}
function stopRec() {
  if (state.test) state.test.recording = false;
  clearInterval(REC.timer);
  REC.timer = null;
  if (REC.mr && REC.mr.state !== 'inactive') { try { REC.mr.stop(); } catch (e) {} }
}
function onRecStop() {
  if (REC.stream) {
    REC.stream.getTracks().forEach(function (tr) { try { tr.stop(); } catch (e) {} });
    REC.stream = null;
  }
  let blob = null;
  try { blob = new Blob(REC.chunks, { type: (REC.mr && REC.mr.mimeType) || 'audio/webm' }); } catch (e) {}
  REC.mr = null;
  if (blob && blob.size) {
    if (REC.url) { try { URL.revokeObjectURL(REC.url); } catch (e) {} }
    REC.url = URL.createObjectURL(blob);
    if (state.test) { state.test.recUrl = REC.url; state.test.recording = false; }
    renderView();
  } else {
    toast('لم يُسجَّل صوت. حاول مرة أخرى.', 'err');
    if (state.test) { state.test.recording = false; renderView(); }
  }
}
function stopRecorder() {
  clearInterval(REC.timer);
  REC.timer = null;
  if (REC.mr && REC.mr.state !== 'inactive') {
    try { REC.mr.onstop = null; REC.mr.stop(); } catch (e) {}
  }
  if (REC.stream) {
    REC.stream.getTracks().forEach(function (tr) { try { tr.stop(); } catch (e) {} });
    REC.stream = null;
  }
  REC.mr = null;
  if (REC.url) { try { URL.revokeObjectURL(REC.url); } catch (e) {} REC.url = null; }
  if (state.test) { state.test.recording = false; state.test.recUrl = null; }
}

function gradeCurrent(ok) {
  const t = state.test;
  if (!t) return;
  if (ok) t.correct++;
  t.results.push({ a: t.cur, ok: !!ok });
  if (ok) sfx('ok'); else sfx('bad');
  nextItem();
}
function nextItem() {
  const t = state.test;
  if (!t) return;
  t.i++;
  if (t.i >= t.total) { finishTest(); return; }
  prepItem();
  renderView();
}

function applyTestResult(t) {
  const apply = function (x) {
    x.tests = (x.tests || 0) + 1;
    x.best = Math.max(x.best || 0, t.pct);
    if (t.pct >= 80) {
      x.stage = Math.min((x.stage || 0) + 1, SRS_DAYS.length - 1);
      x.next = shiftDay(SRS_DAYS[x.stage]);
      x.needsWork = false;
    } else {
      x.stage = 0;
      x.next = shiftDay(1);
      x.needsWork = true;
    }
  };
  const p = getPortion(t.s, t.from, t.to);
  if (p) apply(p);
  else {
    D.portions.forEach(function (x) {
      if (x.s === t.s && x.from <= t.to && x.to >= t.from) apply(x);
    });
  }
}

function finishTest() {
  const t = state.test;
  if (!t || t.phase === 'result') return;
  stopRecorder();
  t.phase = 'result';
  t.pct = t.total ? Math.round((t.correct / t.total) * 100) : 0;
  t.earned = t.correct * 2 + (t.pct === 100 ? 10 : 0) + (t.pct >= 80 ? 5 : 0);
  t.doneAt = Date.now();
  applyTestResult(t);
  D.tests.unshift({
    ts: t.doneAt, s: t.s, from: t.from, to: t.to, mode: t.mode,
    correct: t.correct, total: t.total, pct: t.pct, earned: t.earned
  });
  D.tests = D.tests.slice(0, 100);
  dayRec().tests++;
  touchStreak();
  saveD();
  addStars(t.earned);
  checkBadges();
  renderChrome();
  renderView();
  if (t.pct >= 80) { confetti(110); sfx('win'); }
}

function viewTestResult() {
  const t = state.test;
  const pct = t.pct;
  const emoji = pct === 100 ? '💎' : pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '💪';
  const title = pct === 100 ? 'ما شاء الله! تسميع كامل' : pct >= 80 ? 'أحسنت! تسميع ممتاز' : pct >= 50 ? 'جيد، واصل التدريب' : 'لا بأس، التكرار يعلّم';
  const msg = pct === 100
    ? 'حفظت الورد بإتقان! ستكون مراجعتك القادمة بعد فترة أطول.'
    : pct >= 80
      ? 'نتيجة رائعة! راجع الأخطاء القليلة ثم عد للاختبار.'
      : pct >= 50
        ? 'أكثر من نصف الآيات صحيحة. أعد سماع الورد وراجعه ثم حاول مجددًا.'
        : 'لا تقلق! استمع للورد مرتين ثم سمّعه آية آية. ستتحسن بسرعة.';
  const wrong = t.results.filter(function (r) { return !r.ok; });
  const p = getPortion(t.s, t.from, t.to);
  const nextDate = p && p.next ? fmtDate(p.next) : '';

  return '<div class="k-test-wrap"><div class="k-result">' +
    '<div class="k-result-emoji">' + emoji + '</div>' +
    '<h2>' + title + '</h2>' +
    '<p>' + msg + '</p>' +
    '<div class="k-score-ring">' + ringSVG(pct, 150, ar(pct) + '٪', 'النتيجة') + '</div>' +
    '<div class="k-result-stars">' +
      (pct >= 50 ? '⭐' : '') + (pct >= 80 ? '⭐' : '') + (pct >= 100 ? '⭐' : '') +
      '<span style="font-size:14px;font-weight:900;color:var(--k-gold);align-self:center">+' + ar(t.earned) + ' نجمة</span>' +
    '</div>' +
    '<div class="k-mini-stats" style="justify-content:center;margin-bottom:8px">' +
      '<span class="k-mini-stat">✅ <b>' + ar(t.correct) + '</b> صحيحة</span>' +
      '<span class="k-mini-stat">✗ <b>' + ar(t.total - t.correct) + '</b> تحتاج إعادة</span>' +
      (nextDate ? '<span class="k-mini-stat">📅 <b>المراجعة</b> ' + nextDate + '</span>' : '') +
    '</div>' +
    (wrong.length
      ? '<div class="k-wrong-list"><b style="font-size:13px">الآيات التي تحتاج مراجعة:</b>' +
        wrong.map(function (r) {
          return '<div class="k-wrong-item">' +
            '<span style="flex:1">الآية ' + ar(r.a) + ': ' + esc(ayahText(t.s, r.a)).slice(0, 60) + '…</span>' +
            '<button class="k-icon-btn" data-act="play-ayah" data-s="' + t.s + '" data-a="' + r.a + '" aria-label="استمع">▶</button>' +
            '</div>';
        }).join('') + '</div>'
      : '<div class="k-plan-done" style="justify-content:center">✓ لا أخطاء، ما شاء الله!</div>') +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:18px">' +
      '<button class="k-btn k-btn--primary" data-act="retry-test">🔄 أعد الاختبار</button>' +
      '<button class="k-btn k-btn--soft" data-act="go-mem">📖 عد إلى الورد</button>' +
      '<button class="k-btn k-btn--ghost" data-go="home">🏠 لوحتي</button>' +
    '</div>' +
    '</div></div>';
}

/* ------------------------- 17) الجوائز والأوسمة ------------------------- */
function viewRewards() {
  const st = stats();
  const lv = levelInfo(D.stars);
  const nextBadge = BADGES.find(function (b) { return D.badges.indexOf(b.id) === -1; });
  const claimed = D.prizes;

  const badgesHtml = BADGES.map(function (b) {
    const on = D.badges.indexOf(b.id) > -1;
    const pr = b.prog(st);
    const pct = Math.min(100, Math.round((pr[0] / pr[1]) * 100));
    return '<div class="k-badge ' + (on ? '' : 'is-locked') + '">' +
      '<i>' + b.ico + '</i><b>' + b.title + '</b>' +
      '<small>' + (on ? '✓ تم الحصول عليه' : b.desc) + '</small>' +
      (on ? '' : '<div class="k-bar" style="height:6px;margin-top:6px"><i style="width:' + pct + '%"></i></div>' +
        '<small style="margin-top:3px">' + ar(pr[0]) + ' / ' + ar(pr[1]) + '</small>') +
      '</div>';
  }).join('');

  const prizesHtml = PRIZES.map(function (p) {
    const has = claimed.find(function (x) { return x.id === p.id; });
    const can = D.stars >= p.cost;
    return '<div class="k-prize ' + (has ? 'is-claimed' : can ? '' : 'is-locked') + '">' +
      '<div class="k-prize-ico">' + p.ico + '</div>' +
      '<b>' + p.title + '</b>' +
      '<small>' + p.desc + '</small>' +
      '<div class="k-prize-cost">' + ar(p.cost) + ' ⭐ ' + (can ? '· مفتوحة' : '· تحتاج ' + ar(p.cost - D.stars) + ' نجمة') + '</div>' +
      (has
        ? '<span class="k-chip k-chip--mint">✓ حصلت عليها</span>'
        : can
          ? '<button class="k-btn k-btn--gold k-btn--sm" data-act="claim-prize" data-id="' + p.id + '">🎁 استلم الجائزة</button>'
          : '<button class="k-btn k-btn--ghost k-btn--sm" disabled>🔒 مقفلة</button>') +
      '</div>';
  }).join('');

  const couponsHtml = claimed.length ? (
    '<div class="k-sec-title"><span>🎟️ جوائزي المستلمة</span><small>' + ar(claimed.length) + '</small></div>' +
    '<div class="k-grid-2">' + claimed.map(function (x) {
      const p = PRIZES.find(function (y) { return y.id === x.id; }) || { ico: '🎁', title: 'جائزة' };
      return '<div class="k-coupon">' +
        '<div style="font-size:26px;line-height:1">' + p.ico + '</div>' +
        '<div style="flex:1;min-width:0"><b style="font-size:13.5px">' + p.title + '</b>' +
        '<small style="display:block;color:var(--k-muted);font-size:11px;font-weight:700">' + fmtDate(x.at) + '</small></div>' +
        '<span class="k-cp-code">' + esc(x.code) + '</span></div>';
    }).join('') + '</div>'
  ) : '';

  return '' +
  '<div class="k-wird-head"><div><h2>🏆 جوائزي</h2><p>كل نجمة تقرّبك من جائزة جديدة</p></div></div>' +
  '<div class="k-card" style="display:flex;gap:18px;align-items:center;flex-wrap:wrap">' +
    ringSVG(lv.next ? lv.pct : 100, 104, lv.cur.ico, lv.cur.name) +
    '<div style="flex:1;min-width:200px">' +
      '<h3 style="margin:0 0 4px;font-size:19px">' + lv.cur.name + ' · المستوى ' + ar(lv.num) + '</h3>' +
      '<p class="k-muted" style="margin:0 0 8px;font-size:12.5px;font-weight:700">' +
        (lv.next ? 'تحتاج ' + ar(lv.next.min - D.stars) + ' نجمة للوصول إلى «' + lv.next.name + '»' : 'وصلت لأعلى مستوى، ما شاء الله!') + '</p>' +
      '<div class="k-bar k-bar--gold"><i style="width:' + (lv.next ? lv.pct : 100) + '%"></i></div>' +
      '<div class="k-mini-stats"><span class="k-mini-stat">⭐ <b>' + ar(D.stars) + '</b> نجمة</span>' +
        '<span class="k-mini-stat">🏅 <b>' + ar(D.badges.length) + '</b> وسام</span>' +
        '<span class="k-mini-stat">🎁 <b>' + ar(D.prizes.length) + '</b> جائزة</span></div>' +
    '</div>' +
  '</div>' +

  (nextBadge ? '<div class="k-card" style="margin-top:16px;display:flex;gap:12px;align-items:center">' +
    '<div style="font-size:34px">' + nextBadge.ico + '</div>' +
    '<div style="flex:1"><b style="font-size:14px">الوسام القادم: ' + nextBadge.title + '</b>' +
    '<div class="k-muted" style="font-size:11.5px;font-weight:700">' + nextBadge.desc + '</div>' +
    '<div class="k-bar" style="margin-top:6px;height:8px"><i style="width:' + Math.min(100, Math.round((nextBadge.prog(st)[0] / nextBadge.prog(st)[1]) * 100)) + '%"></i></div></div>' +
    '<span class="k-chip k-chip--gold">' + ar(nextBadge.prog(st)[0]) + ' / ' + ar(nextBadge.prog(st)[1]) + '</span></div>' : '') +

  '<div class="k-sec-title"><span>🏅 الأوسمة</span><small>' + ar(D.badges.length) + ' من ' + ar(BADGES.length) + '</small></div>' +
  '<div class="k-badges">' + badgesHtml + '</div>' +

  '<div class="k-sec-title"><span>🎁 صندوق الجوائز</span><small>تفتح تلقائيًا عند جمع النجوم</small></div>' +
  '<div class="k-prizes">' + prizesHtml + '</div>' +
  couponsHtml;
}

/* ------------------------- 18) الشهادات ------------------------- */
function availableCerts() {
  const st = stats();
  const out = [];
  if (st.ayahs >= TOTAL_AYAT) {
    out.push({ id: 'juz', kind: 'juz', ico: '👑', title: 'شهادة ختم جزء عمَّ', sub: 'إتمام ٥٦٤ آية' });
  }
  completeSurahs().slice().sort(function (a, b) { return b - a; }).forEach(function (s) {
    out.push({ id: 'surah-' + s, kind: 'surah', s: s, ico: '📜', title: 'شهادة إتمام سورة ' + surahName(s), sub: ar(QURAN_JUZ30[s].ayat.length) + ' آية' });
  });
  if ((D.streak.best || 0) >= 7) {
    out.push({ id: 'streak', kind: 'streak', ico: '🔥', title: 'شهادة الانتظام', sub: ar(D.streak.best) + ' يومًا متتاليًا' });
  }
  if (D.stars >= 300) {
    out.push({ id: 'stars', kind: 'stars', ico: '⭐', title: 'شهادة التميّز', sub: ar(D.stars) + ' نجمة' });
  }
  return out;
}
function viewCerts() {
  const list = availableCerts();
  const issued = D.certs || [];
  const cards = list.map(function (c) {
    const has = issued.some(function (x) { return x.id === c.id; });
    return '<button class="k-cert-card" data-act="open-cert" data-id="' + c.id + '">' +
      '<i>' + c.ico + '</i>' +
      '<div><b>' + c.title + '</b><small>' + c.sub + (has ? ' · تم إصدارها ✓' : '') + '</small></div>' +
      '<span class="k-cert-go">›</span></button>';
  }).join('');

  return '' +
  '<div class="k-wird-head"><div><h2>📜 شهاداتي</h2><p>شهادات تقدير تُطبع وتحتفظ بها</p></div></div>' +
  (list.length
    ? '<div class="k-cert-grid">' + cards + '</div>' +
      '<div class="k-card" style="margin-top:16px;display:flex;gap:10px;align-items:center">' +
        '<div style="font-size:28px">🖨️</div><div style="flex:1"><b style="font-size:13.5px">نصيحة</b>' +
        '<div class="k-muted" style="font-size:12px;font-weight:600">حمّل الشهادة بصيغة PNG واطبعها، أو علّقها في غرفتك لتشجّعك على الاستمرار.</div></div></div>'
    : '<div class="k-empty"><span class="k-empty-ico">🎓</span>' +
      'ستحصل على شهادتك الأولى عند إتمام حفظ سورة كاملة.<br>' +
      '<span class="k-muted" style="font-size:12px">كل سورة تُتمّها = شهادة تقدير باسمك.</span><br>' +
      '<button class="k-btn k-btn--primary" data-go="wird" style="margin-top:14px">ابدأ الحفظ الآن</button></div>') +
  (issued.length
    ? '<div class="k-sec-title"><span>📌 سجل الإصدار</span><small>' + ar(issued.length) + '</small></div>' +
      '<div class="k-card k-card--flat"><div class="k-badge-strip">' + issued.map(function (x) {
        return '<span class="k-badge-mini"><i>✓</i>' + esc(x.id) + ' · ' + fmtDate(x.at) + '</span>';
      }).join('') + '</div></div>'
    : '');
}

function openCert(cert) {
  state.cert = cert;
  showModal(cert.title,
    '<canvas id="kCertCanvas" class="k-cert-canvas" width="1600" height="1131" aria-label="معاينة الشهادة"></canvas>' +
    '<p class="k-muted" style="text-align:center;font-size:11.5px;margin:10px 0 0">يمكنك تحميل الشهادة أو طباعتها ووضعها في مكان جميل 📜</p>',
    '<button class="k-btn k-btn--primary" data-act="cert-download">⬇️ تحميل PNG</button>' +
    '<button class="k-btn k-btn--soft" data-act="cert-print">🖨️ طباعة</button>' +
    '<button class="k-btn k-btn--ghost" data-act="cert-share">📤 مشاركة</button>' +
    '<button class="k-btn k-btn--ghost" data-act="close-modal">إغلاق</button>'
  );
  requestAnimationFrame(function () {
    const cv = $('#kCertCanvas');
    if (cv) drawCertificate(cv, cert);
  });
}

function roundRectPath(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function starPath(c, cx, cy, R, r, n) {
  c.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rad = i % 2 ? r : R;
    const ang = (Math.PI * i) / n - Math.PI / 2;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i) c.lineTo(px, py); else c.moveTo(px, py);
  }
  c.closePath();
}
function drawDivider(c, cx, y, width) {
  c.save();
  c.strokeStyle = '#d9b24a';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(cx - width / 2, y); c.lineTo(cx - 34, y);
  c.moveTo(cx + 34, y); c.lineTo(cx + width / 2, y);
  c.stroke();
  c.fillStyle = '#d9b24a';
  starPath(c, cx, y, 15, 5.5, 8);
  c.fill();
  c.restore();
}
function wrapLines(c, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  words.forEach(function (w) {
    const test = cur ? cur + ' ' + w : w;
    if (c.measureText(test).width > maxWidth && cur) { lines.push(cur); cur = w; }
    else cur = test;
  });
  if (cur) lines.push(cur);
  return lines;
}
function drawSeal(c, cx, cy, R) {
  c.save();
  c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.fillStyle = '#d9b24a'; c.fill();
  c.beginPath(); c.arc(cx, cy, R - 10, 0, Math.PI * 2); c.strokeStyle = '#fffdf6'; c.lineWidth = 3; c.stroke();
  c.beginPath(); c.arc(cx, cy, R - 21, 0, Math.PI * 2); c.strokeStyle = 'rgba(255,253,246,.7)'; c.lineWidth = 1.5; c.stroke();
  c.textAlign = 'center';
  c.fillStyle = '#5a4308';
  c.font = '700 29px "Aref Ruqaa", serif';
  c.fillText('جزء عمَّ', cx, cy + 2);
  c.font = '700 15px "Cairo", sans-serif';
  c.fillText('إتقان', cx, cy + 38);
  starPath(c, cx, cy - 40, 11, 4.5, 8);
  c.fillStyle = '#fffdf6';
  c.fill();
  c.restore();
}

async function drawCertificate(canvas, cert) {
  if (!canvas || !cert) return;
  try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (e) {}
  const W = 1600, H = 1131;
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d');
  if (!c) return;
  c.direction = 'rtl';
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';

  const bg = c.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b3d4c');
  bg.addColorStop(0.55, '#12667c');
  bg.addColorStop(1, '#2b93b6');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);

  c.save();
  c.globalAlpha = 0.09;
  c.strokeStyle = '#ffffff';
  c.lineWidth = 1.5;
  for (let y = 42; y < H; y += 112) {
    for (let x = 42; x < W; x += 112) { starPath(c, x, y, 18, 7, 8); c.stroke(); }
  }
  c.restore();

  c.strokeStyle = '#e6c76a';
  c.lineWidth = 12;
  roundRectPath(c, 30, 30, W - 60, H - 60, 26);
  c.stroke();
  c.strokeStyle = 'rgba(255,227,163,.55)';
  c.lineWidth = 3;
  roundRectPath(c, 52, 52, W - 104, H - 104, 20);
  c.stroke();

  c.save();
  c.shadowColor = 'rgba(0,0,0,.35)';
  c.shadowBlur = 42;
  c.shadowOffsetY = 14;
  c.fillStyle = '#fffdf6';
  roundRectPath(c, 88, 88, W - 176, H - 176, 26);
  c.fill();
  c.restore();

  c.strokeStyle = 'rgba(15,76,92,.16)';
  c.lineWidth = 2;
  roundRectPath(c, 110, 110, W - 220, H - 220, 18);
  c.stroke();

  [[142, 142], [W - 142, 142], [142, H - 142], [W - 142, H - 142]].forEach(function (p) {
    c.save();
    c.globalAlpha = 0.8;
    c.fillStyle = '#d9b24a';
    starPath(c, p[0], p[1], 15, 5.5, 8);
    c.fill();
    c.restore();
  });

  c.save();
  c.globalAlpha = 0.045;
  c.fillStyle = '#0f4c5c';
  c.font = '700 520px "Amiri Quran", serif';
  c.fillText('۝', W / 2, H / 2 + 190);
  c.restore();

  c.fillStyle = '#1d7a96';
  c.font = '400 34px "Amiri Quran", serif';
  c.fillText('بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ', W / 2, 208);

  const title = cert.kind === 'juz' ? 'شهادة ختم جزء عمَّ'
    : cert.kind === 'streak' ? 'شهادة الانتظام'
      : cert.kind === 'stars' ? 'شهادة التميّز'
        : 'شهادة تقدير';
  c.fillStyle = '#0f4c5c';
  c.font = '700 90px "Aref Ruqaa", serif';
  c.fillText(title, W / 2, 330);

  drawDivider(c, W / 2, 372, 780);

  c.fillStyle = '#5e8090';
  c.font = '600 34px "Cairo", sans-serif';
  c.fillText('تُمنح هذه الشهادة إلى', W / 2, 452);

  const name = USER ? USER.name : '';
  let fs = 88;
  c.fillStyle = '#9a7412';
  do {
    c.font = '700 ' + fs + 'px "Aref Ruqaa", serif';
    if (c.measureText(name).width <= 980) break;
    fs -= 4;
  } while (fs > 44);
  c.fillText(name, W / 2, 562);

  const nw = Math.min(900, c.measureText(name).width + 140);
  const g2 = c.createLinearGradient(W / 2 - nw / 2, 0, W / 2 + nw / 2, 0);
  g2.addColorStop(0, 'rgba(217,178,74,0)');
  g2.addColorStop(0.5, '#d9b24a');
  g2.addColorStop(1, 'rgba(217,178,74,0)');
  c.fillStyle = g2;
  c.fillRect(W / 2 - nw / 2, 594, nw, 4);

  const avg = avgScore();
  const grade = avg >= 95 ? 'ممتاز' : avg >= 85 ? 'جيد جدًا' : 'جيد';
  let body = '';
  if (cert.kind === 'surah') {
    body = 'لإتمامه حفظ سورة ' + surahName(cert.s) + ' كاملةً (' + ar(QURAN_JUZ30[cert.s].ayat.length) + ' آية) من جزء عمَّ، بتقدير ' + grade + '.';
  } else if (cert.kind === 'juz') {
    body = 'لإتمامه حفظ جزء عمَّ كاملًا (٥٦٤ آية) بتقدير ' + grade + '، نسأل الله أن يجعل القرآن ربيع قلبه.';
  } else if (cert.kind === 'streak') {
    body = 'لمواظبته على الورد اليومي ' + ar(D.streak.best || 0) + ' يومًا متتاليًا، فبارك الله في همّته.';
  } else {
    body = 'لجمعه ' + ar(D.stars) + ' نجمة في رحلة حفظ جزء عمَّ، مع تمنياتنا له بدوام التوفيق.';
  }
  c.fillStyle = '#28434d';
  c.font = '600 33px "Cairo", sans-serif';
  const lines = wrapLines(c, body, 1000);
  lines.slice(0, 3).forEach(function (ln, i) { c.fillText(ln, W / 2, 676 + i * 54); });

  drawDivider(c, W / 2, 856, 1120);

  const dateTxt = new Date().toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' });
  c.fillStyle = '#5e8090';
  c.font = '700 25px "Cairo", sans-serif';
  c.fillText('التاريخ', W - 300, 906);
  c.fillStyle = '#17323d';
  c.font = '600 29px "Cairo", sans-serif';
  c.fillText(dateTxt, W - 300, 946);

  c.strokeStyle = 'rgba(15,76,92,.35)';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(W / 2 - 150, 942);
  c.lineTo(W / 2 + 150, 942);
  c.stroke();
  c.fillStyle = '#5e8090';
  c.font = '600 24px "Cairo", sans-serif';
  c.fillText('المعلّم / ولي الأمر', W / 2, 980);

  drawSeal(c, 300, 920, 82);

  c.fillStyle = 'rgba(15,76,92,.45)';
  c.font = '700 20px "Cairo", sans-serif';
  c.fillText('رحلة حفظ جزء عمَّ · تطبيق الأطفال', W / 2, H - 128);
}

function markCert(id) {
  if (!D) return;
  if (!D.certs.some(function (c) { return c.id === id; })) {
    D.certs.push({ id: id, at: todayKey() });
    saveD();
  }
}
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 6000);
}
function certDownload() {
  const cv = $('#kCertCanvas');
  const cert = state.cert;
  if (!cv || !cert) return;
  cv.toBlob(function (blob) {
    if (!blob) { toast('تعذّر إنشاء صورة الشهادة', 'err'); return; }
    downloadBlob(blob, 'شهادة-' + (USER ? USER.name : '') + '-' + cert.id + '.png');
    markCert(cert.id);
    toast('تم تحميل الشهادة، مبارك! 🎉', 'ok');
    sfx('win');
  }, 'image/png');
}
function certPrint() {
  const cv = $('#kCertCanvas');
  const cert = state.cert;
  if (!cv || !cert) return;
  markCert(cert.id);
  const data = cv.toDataURL('image/png');
  const w = window.open('', '_blank');
  if (!w) { toast('اسمح بالنوافذ المنبثقة للطباعة', 'err', 4200); return; }
  try {
    w.document.open();
    w.document.write('<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>' +
      esc(cert.title) + '</title><style>@page{size:landscape;margin:0}html,body{margin:0;padding:0}img{width:100%;display:block}</style></head><body><img src="' + data + '" alt=""></body></html>');
    w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 500);
  } catch (e) { toast('تعذّرت الطباعة', 'err'); }
}
function certShare() {
  const cv = $('#kCertCanvas');
  const cert = state.cert;
  if (!cv || !cert) return;
  if (!navigator.canShare) { toast('المشاركة غير مدعومة، حمّل الشهادة بدلًا من ذلك', 'err', 3800); return; }
  cv.toBlob(async function (blob) {
    if (!blob) return;
    try {
      const file = new File([blob], 'شهادة-' + (USER ? USER.name : '') + '.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: cert.title, text: 'شهادة تقدير من رحلة حفظ جزء عمَّ' });
        markCert(cert.id);
      } else {
        toast('المشاركة غير مدعومة على هذا الجهاز، حمّل الشهادة', 'err', 3800);
      }
    } catch (e) {}
  }, 'image/png');
}

/* ------------------------- 19) الإعدادات ------------------------- */
const AVATARS = ['🦁', '🐼', '🐧', '🦊', '🐨', '🐯', '🦉', '🐬', '🦋', '🌟', '🚀', '🌙'];

function viewSettings() {
  const lv = levelInfo(D.stars);
  const st = stats();
  const dark = document.body.classList.contains('dark');
  return '' +
  '<div class="k-wird-head"><div><h2>⚙️ الإعدادات</h2><p>خصّص رحلتك وبياناتك</p></div></div>' +
  '<div class="k-card">' +
    '<div class="k-set-row">' +
      '<div style="width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:24px;background:var(--k-sky-soft);border:2px solid var(--k-gold)">' + USER.avatar + '</div>' +
      '<div class="k-set-txt"><b>' + esc(USER.name) + '</b><small>' + esc(USER.login) + '</small></div>' +
      '<span class="k-chip">' + lv.cur.ico + ' ' + lv.cur.name + '</span>' +
    '</div>' +
    '<div class="k-set-row">' +
      '<div class="k-set-txt"><b>تغيير الاسم</b><small>يظهر على الشهادات</small></div>' +
      '<input class="k-input" id="kSetName" value="' + esc(USER.name) + '" maxlength="30" style="max-width:210px;padding:9px 12px" aria-label="الاسم">' +
      '<button class="k-btn k-btn--primary k-btn--sm" data-act="save-name">حفظ</button>' +
    '</div>' +
    '<div class="k-set-row" style="display:block">' +
      '<b style="font-size:13.5px">الصورة الرمزية</b>' +
      '<div class="k-avatars" style="margin-top:8px">' + AVATARS.map(function (a) {
        return '<button class="k-avatar-pick ' + (a === USER.avatar ? 'is-on' : '') + '" data-act="set-avatar" data-avatar="' + a + '" aria-label="اختيار ' + a + '">' + a + '</button>';
      }).join('') + '</div>' +
    '</div>' +
    '<div class="k-set-row">' +
      '<div class="k-set-txt"><b>مقدار الورد اليومي</b><small>عدد آيات الحفظ الجديد كل يوم</small></div>' +
      '<div class="k-seg">' + [2, 3, 5, 8].map(function (n) {
        return '<button data-act="set-wird" data-n="' + n + '" class="' + (D.settings.wird === n ? 'is-on' : '') + '">' + ar(n) + ' آيات</button>';
      }).join('') + '</div>' +
    '</div>' +
    '<div class="k-set-row">' +
      '<div class="k-set-txt"><b>المؤثرات الصوتية</b><small>أصوات التشجيع عند الإجابة</small></div>' +
      '<button class="k-switch ' + (D.settings.sound ? 'is-on' : '') + '" data-act="toggle-sound" role="switch" aria-checked="' + (!!D.settings.sound) + '" aria-label="المؤثرات الصوتية"></button>' +
    '</div>' +
    '<div class="k-set-row">' +
      '<div class="k-set-txt"><b>الوضع الليلي</b><small>مريح للعين مساءً</small></div>' +
      '<button class="k-switch ' + (dark ? 'is-on' : '') + '" data-act="theme" role="switch" aria-checked="' + dark + '" aria-label="الوضع الليلي"></button>' +
    '</div>' +
  '</div>' +

  '<div class="k-sec-title"><span>📦 بياناتي</span></div>' +
  '<div class="k-card">' +
    '<div class="k-set-row">' +
      '<div class="k-set-txt"><b>نسخة احتياطية</b><small>صدّر تقدمك كملف JSON على جهازك</small></div>' +
      '<button class="k-btn k-btn--soft k-btn--sm" data-act="export">⬇️ تصدير</button>' +
    '</div>' +
    '<div class="k-set-row">' +
      '<div class="k-set-txt"><b>استيراد نسخة</b><small>استعد تقدمك من ملف سابق</small></div>' +
      '<button class="k-btn k-btn--soft k-btn--sm" data-act="import">⬆️ استيراد</button>' +
      '<input type="file" id="kImportFile" accept="application/json,.json" hidden>' +
    '</div>' +
    '<div class="k-set-row">' +
      '<div class="k-set-txt"><b>إعادة تعيين التقدم</b><small>يحذف الحفظ والنجوم مع بقاء الحساب</small></div>' +
      '<button class="k-btn k-btn--coral k-btn--sm" data-act="reset-progress">♻️ إعادة تعيين</button>' +
    '</div>' +
    '<div class="k-set-row">' +
      '<div class="k-set-txt"><b>حذف الحساب</b><small>يحذف كل بياناتك من هذا الجهاز نهائيًا</small></div>' +
      '<button class="k-btn k-btn--coral k-btn--sm" data-act="delete-account">🗑️ حذف</button>' +
    '</div>' +
  '</div>' +

  '<div class="k-card" style="margin-top:16px">' +
    '<b style="font-size:14px">🔒 خصوصيتك</b>' +
    '<p class="k-muted" style="font-size:12.5px;line-height:1.9;margin:6px 0 0">' +
      'كل بياناتك (الاسم والتقدم) تُحفظ على جهازك فقط. كلمة المرور محفوظة مشفّرة (PBKDF2) ولا يعرفها أحد. ' +
      'لا يوجد خادم ولا حساب سحابي. إن حذفت بيانات المتصفح ستفقد تقدمك، لذا صدّر نسخة احتياطية من وقت لآخر.' +
    '</p>' +
    '<div class="k-badge-strip" style="margin-top:12px">' +
      '<span class="k-badge-mini"><i>📖</i>' + ar(st.ayahs) + ' آية</span>' +
      '<span class="k-badge-mini"><i>⭐</i>' + ar(D.stars) + ' نجمة</span>' +
      '<span class="k-badge-mini"><i>🏅</i>' + ar(D.badges.length) + ' وسام</span>' +
      '<span class="k-badge-mini"><i>📜</i>' + ar((D.certs || []).length) + ' شهادة</span>' +
    '</div>' +
  '</div>' +
  '<p class="k-muted" style="text-align:center;font-size:11px;margin-top:18px">تلاوة: الشيخ محمود خليل الحصري رحمه الله · رحلة حفظ جزء عمَّ</p>';
}

/* ------------------------- 20) اختيار الورد ------------------------- */
function showPortionPicker(mode) {
  state.pickerMode = mode || 'memorize';
  const review = state.pickerMode === 'review';
  const w = D.settings.wird;
  let html = '<p class="k-muted" style="font-size:12.5px;margin:0 0 8px">' +
    (review ? 'اختر وردًا محفوظًا لمراجعته وتسميعه.' : 'اختر أي ورد تريد حفظه. الورد الأخضر محفوظ مسبقًا.') + '</p>';
  let any = false;
  for (let s = 114; s >= 78; s--) {
    const n = QURAN_JUZ30[s].ayat.length;
    let chips = '';
    for (let i = 0; i < n; i += w) {
      const from = i + 1, to = Math.min(i + w, n);
      const key = portionKey(s, from, to);
      const done = isLearned(key);
      if (review && !done) continue;
      any = true;
      chips += '<button class="' + (done ? 'is-done' : '') + '" data-act="open-portion" data-s="' + s + '" data-from="' + from + '" data-to="' + to + '">' + ar(from) + '–' + ar(to) + '</button>';
    }
    if (!chips) continue;
    html += '<div style="margin-top:12px"><b style="font-size:13.5px">' + surahName(s) +
      ' <span class="k-muted" style="font-weight:700;font-size:11px">(' + ar(n) + ' آية)</span></b>' +
      '<div class="k-portion-chips">' + chips + '</div></div>';
  }
  if (!any) html = '<div class="k-empty">' + (review ? 'لم تحفظ أي ورد بعد. ابدأ بالحفظ أولًا.' : 'لا توجد أوراد.') + '</div>';
  showModal(review ? 'اختر وردًا للمراجعة' : 'اختر وردًا للحفظ', '<div style="max-height:62vh;overflow:auto;padding-inline-end:4px">' + html + '</div>');
}

/* ------------------------- 21) النوافذ ------------------------- */
function showModal(title, body, foot) {
  const m = $('#kModal');
  if (!m) return;
  $('#kModalTitle').textContent = title;
  $('#kModalBody').innerHTML = body;
  const f = $('#kModalFoot');
  if (foot) { f.innerHTML = foot; f.hidden = false; } else { f.innerHTML = ''; f.hidden = true; }
  m.hidden = false;
  state.modalOpen = true;
  document.body.style.overflow = 'hidden';
  const box = m.querySelector('.k-modal-box');
  if (box) box.scrollTop = 0;
}
function closeModal() {
  const m = $('#kModal');
  if (!m) return;
  m.hidden = true;
  $('#kModalBody').innerHTML = '';
  $('#kModalFoot').innerHTML = '';
  state.modalOpen = false;
  state.cert = null;
  document.body.style.overflow = '';
}
function confirmModal(title, text, okLabel, cb) {
  state.confirmCb = cb;
  showModal(title, '<p style="font-size:14px;line-height:1.9;margin:0">' + text + '</p>',
    '<button class="k-btn k-btn--coral" data-act="confirm-ok">' + okLabel + '</button>' +
    '<button class="k-btn k-btn--ghost" data-act="close-modal">إلغاء</button>');
}

function showOnboarding() {
  const w = D.settings.wird;
  showModal('مرحبًا ' + USER.name + ' 🎉',
    '<p style="font-size:14px;line-height:1.9;margin:0 0 12px">أهلاً بك في رحلة حفظ جزء عمَّ! اختر مقدار الورد اليومي، ويمكنك تغييره لاحقًا.</p>' +
    '<div class="k-seg" id="kObWird" style="flex-wrap:wrap">' +
      [2, 3, 5, 8].map(function (n) {
        return '<button type="button" data-act="ob-wird" data-w="' + n + '" class="' + (w === n ? 'is-on' : '') + '">' + ar(n) + ' آيات</button>';
      }).join('') + '</div>' +
    '<div class="k-card k-card--flat" style="margin-top:14px;padding:14px">' +
      '<div style="display:flex;gap:10px;margin-bottom:10px"><span style="font-size:22px">📅</span><div><b style="font-size:13.5px">ورد يومي</b><div class="k-muted" style="font-size:11.5px">حفظ جديد + مراجعة تلقائية</div></div></div>' +
      '<div style="display:flex;gap:10px;margin-bottom:10px"><span style="font-size:22px">🎙️</span><div><b style="font-size:13.5px">تسميع وتصحيح</b><div class="k-muted" style="font-size:11.5px">سجّل صوتك وقارن بالشيخ الحصري</div></div></div>' +
      '<div style="display:flex;gap:10px"><span style="font-size:22px">🏆</span><div><b style="font-size:13.5px">نجوم وجوائز وشهادات</b><div class="k-muted" style="font-size:11.5px">كل إنجاز له تقدير</div></div></div>' +
    '</div>',
    '<button class="k-btn k-btn--primary k-btn--lg" data-act="ob-start">هيا نبدأ 🚀</button>'
  );
}

/* ------------------------- 22) الحساب والدخول ------------------------- */
function clearAuthErrors() {
  ['kNameErr', 'kLoginErr', 'kPassErr', 'kPass2Err', 'kFormErr'].forEach(function (id) {
    const el = $('#' + id);
    if (el) el.textContent = '';
  });
}
function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) {
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.disabled = true;
    if (label) btn.textContent = label;
  } else {
    btn.disabled = false;
    if (btn.dataset.label) btn.textContent = btn.dataset.label;
  }
}
function setAuthMode(mode) {
  authMode = mode;
  $$('.k-auth-tab').forEach(function (b) {
    const on = b.dataset.authTab === mode;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  $$('[data-signup-only]').forEach(function (el) { el.hidden = mode !== 'signup'; });
  const t = $('#kAuthTitle'), s = $('#kAuthSub'), btn = $('#kAuthSubmit');
  if (t) t.textContent = mode === 'signup' ? 'أنشئ حسابك في الرحلة 🌟' : 'أهلًا بعودتك 🌟';
  if (s) s.textContent = mode === 'signup' ? 'اسمك وصورتك وكلمة مرور… ثم نبدأ الحفظ.' : 'أدخل بياناتك لمتابعة حفظك من حيث توقفت.';
  if (btn) {
    btn.textContent = mode === 'signup' ? 'أنشئ حسابي 🚀' : 'دخول 🚀';
    btn.dataset.label = btn.textContent;
  }
  const pass = $('#kPass');
  if (pass) pass.setAttribute('autocomplete', mode === 'signup' ? 'new-password' : 'current-password');
  clearAuthErrors();
}
function buildAvatars() {
  const box = $('#kAvatarPick');
  if (!box) return;
  box.innerHTML = AVATARS.map(function (a) {
    return '<button type="button" class="k-avatar-pick ' + (a === pickedAvatar ? 'is-on' : '') +
      '" data-act="pick-avatar" data-avatar="' + a + '" aria-label="صورة ' + a + '">' + a + '</button>';
  }).join('');
}
function showAuth() {
  const a = $('#kAuth'), app = $('#kApp');
  if (app) app.hidden = true;
  if (a) a.hidden = false;
  stopAudio();
  document.body.style.overflow = '';
}
async function doSignup() {
  clearAuthErrors();
  const name = ($('#kName') ? $('#kName').value : '').trim();
  const loginRaw = $('#kLogin') ? $('#kLogin').value : '';
  const pass = $('#kPass') ? $('#kPass').value : '';
  const pass2 = $('#kPass2') ? $('#kPass2').value : '';
  let bad = false;
  if (name.length < 2 || name.length > 30) { $('#kNameErr').textContent = 'اكتب اسمك (٢–٣٠ حرفًا)'; bad = true; }
  const lg = normLogin(loginRaw);
  if (lg.type === 'email' ? !isEmail(lg.value) : !isPhone(lg.value)) {
    $('#kLoginErr').textContent = 'أدخل بريدًا إلكترونيًا صحيحًا أو رقم هاتف (٨–١٥ رقمًا)';
    bad = true;
  }
  if (pass.length < 6) { $('#kPassErr').textContent = 'كلمة المرور ٦ أحرف على الأقل'; bad = true; }
  if (pass2 !== pass) { $('#kPass2Err').textContent = 'كلمتا المرور غير متطابقتين'; bad = true; }
  if (bad) return;
  if (!window.crypto || !crypto.subtle) {
    toast('افتح الموقع عبر HTTPS (أو localhost) لإنشاء الحساب', 'err', 5200);
    return;
  }
  const users = getUsers();
  if (users.some(function (u) { return u.login === lg.value; })) {
    $('#kLoginErr').textContent = 'هذا الحساب مسجّل بالفعل، جرّب تسجيل الدخول';
    return;
  }
  const btn = $('#kAuthSubmit');
  setBusy(btn, true, 'جارٍ إنشاء الحساب…');
  try {
    const passRec = await makePass(pass);
    const user = {
      id: uid(),
      name: name,
      login: lg.value,
      loginType: lg.type,
      pass: passRec,
      avatar: pickedAvatar,
      wird: pickedWird,
      createdAt: todayKey()
    };
    users.push(user);
    saveUsers(users);
    const data = defaultData();
    data.settings.wird = pickedWird;
    writeJSON(K.data(user.id), data);
    lsSet(K.session, user.id);
    enterApp(user);
    go('home');
    toast('مرحبًا ' + name + '! حسابك جاهز 🎉', 'ok', 3400);
    confetti(100);
    sfx('win');
  } catch (e) {
    toast('تعذّر إنشاء الحساب: ' + (e && e.message ? e.message : 'خطأ غير معروف'), 'err', 5200);
  } finally {
    setBusy(btn, false);
  }
}
async function doLogin() {
  clearAuthErrors();
  const lg = normLogin($('#kLogin') ? $('#kLogin').value : '');
  const pass = $('#kPass') ? $('#kPass').value : '';
  if (!lg.value) { $('#kLoginErr').textContent = 'أدخل البريد أو رقم الهاتف'; return; }
  if (!pass) { $('#kPassErr').textContent = 'أدخل كلمة المرور'; return; }
  if (!window.crypto || !crypto.subtle) {
    toast('افتح الموقع عبر HTTPS (أو localhost) لتسجيل الدخول', 'err', 5200);
    return;
  }
  const user = getUsers().find(function (u) { return u.login === lg.value; });
  if (!user) { $('#kLoginErr').textContent = 'لا يوجد حساب بهذه البيانات. أنشئ حسابًا جديدًا.'; return; }
  const btn = $('#kAuthSubmit');
  setBusy(btn, true, 'جارٍ الدخول…');
  try {
    const ok = await checkPass(pass, user.pass);
    if (!ok) { $('#kPassErr').textContent = 'كلمة المرور غير صحيحة'; return; }
    lsSet(K.session, user.id);
    enterApp(user);
    go('home');
    toast('أهلًا بعودتك يا ' + user.name + ' 👋', 'ok');
  } catch (e) {
    toast('تعذّر تسجيل الدخول', 'err');
  } finally {
    setBusy(btn, false);
  }
}
function enterApp(u) {
  USER = u;
  D = loadData(u.id);
  if (!D) {
    D = defaultData();
    D.settings.wird = clamp(+u.wird || 3, 2, 8);
    writeJSON(K.data(u.id), D);
  }
  normalizeData();
  lsSet(K.session, u.id);
  $('#kAuth').hidden = true;
  $('#kApp').hidden = false;
  state.mem = null;
  state.test = null;
  state.testIntro = null;
  state.hide = false;
  state.shown = new Set();
  state.pickerMode = 'memorize';
  const hash = (location.hash || '').replace('#', '');
  const route = ROUTES.indexOf(hash) > -1 ? hash : 'home';
  go(route, null, true);
  if (!D.onboarded) setTimeout(showOnboarding, 700);
}
function logout() {
  confirmModal('تسجيل الخروج', 'هل تريد الخروج من حسابك؟ بياناتك ستبقى محفوظة على هذا الجهاز.', 'خروج', function () {
    lsDel(K.session);
    stopAudio();
    USER = null;
    D = null;
    state.mem = null;
    state.test = null;
    state.testIntro = null;
    state.cert = null;
    state.shown = new Set();
    showAuth();
    setAuthMode('login');
    const l = $('#kLogin'), p = $('#kPass');
    if (l) l.value = '';
    if (p) p.value = '';
    toast('تم تسجيل الخروج بنجاح', 'ok');
  });
}

/* ------------------------- 23) المظهر والبيانات ------------------------- */
function applyTheme(dark, persist) {
  document.body.classList.toggle('dark', !!dark);
  if (persist !== false) lsSet(K.theme, dark ? 'dark' : 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#0b1d25' : '#0f4c5c');
  renderChrome();
}
function toggleTheme() {
  applyTheme(!document.body.classList.contains('dark'));
  renderView();
}
function exportData() {
  const payload = {
    app: 'juz-amma-kids', v: 1, exportedAt: new Date().toISOString(),
    user: { name: USER.name, avatar: USER.avatar, login: USER.login },
    data: D
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'بيانات-حفظ-جزء-عم-' + (USER.name || '') + '.json');
  sfx('ok');
  toast('تم تصدير نسخة احتياطية', 'ok');
}
function importFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function () {
    try {
      const obj = JSON.parse(String(reader.result));
      const incoming = obj && obj.data ? obj.data : obj;
      if (!incoming || !Array.isArray(incoming.portions)) throw new Error('bad');
      confirmModal('استيراد نسخة', 'سيتم استبدال تقدمك الحالي بالنسخة المستوردة (مع الاحتفاظ بإعداداتك). هل تريد المتابعة؟', 'استيراد', function () {
        const keep = Object.assign({}, D.settings);
        D = Object.assign(defaultData(), incoming);
        D.settings = Object.assign({ wird: 3, sound: true }, keep, incoming.settings || {});
        normalizeData();
        saveD();
        go('home');
        toast('تم استيراد البيانات بنجاح 🎉', 'ok', 3400);
      });
    } catch (e) {
      toast('الملف غير صالح', 'err');
    }
  };
  reader.readAsText(file);
}
function saveName() {
  const inp = $('#kSetName');
  const name = ((inp && inp.value) || '').trim();
  if (name.length < 2 || name.length > 30) { toast('الاسم يجب أن يكون بين حرفين و٣٠ حرفًا', 'err'); return; }
  USER.name = name;
  saveUsers(getUsers().map(function (u) { return u.id === USER.id ? Object.assign({}, u, { name: name }) : u; }));
  renderChrome();
  renderView();
  toast('تم تحديث الاسم', 'ok');
}
function setAvatar(avatar) {
  if (!avatar) return;
  USER.avatar = avatar;
  saveUsers(getUsers().map(function (u) { return u.id === USER.id ? Object.assign({}, u, { avatar: avatar }) : u; }));
  renderChrome();
  renderView();
  sfx('ok');
  toast('تم تغيير الصورة الرمزية', 'ok', 1600);
}
function setWird(n) {
  D.settings.wird = clamp(+n || 3, 2, 8);
  saveD();
  renderView();
  toast('مقدار الورد اليومي: ' + ar(D.settings.wird) + ' آيات', 'ok', 2000);
}

/* ------------------------- 24) أوامر المشغّل ------------------------- */
function playerCmd(cmd) {
  if (cmd === 'prev') { if (AQ.i > 0) { AQ.i--; loadCurrent(); } }
  else if (cmd === 'next') { if (AQ.i < AQ.queue.length - 1) { AQ.i++; loadCurrent(); } else stopAudio(); }
  else if (cmd === 'toggle') toggleAudioPlay();
  else if (cmd === 'repeat') {
    AQ.repeat = AQ.repeat >= 5 ? 1 : AQ.repeat + 1;
    state.repeat = AQ.repeat;
    updatePlayerBar();
    toast('التكرار ×' + ar(AQ.repeat), 'info', 1400);
  } else if (cmd === 'close') stopAudio();
}

/* ------------------------- 25) الأفعال ------------------------- */
function portionFromBtn(btn) {
  const s = +btn.dataset.s, from = +btn.dataset.from, to = +btn.dataset.to;
  return { s: s, from: from, to: to, key: portionKey(s, from, to) };
}
function openMemorize(p) {
  state.mem = { s: p.s, from: p.from, to: p.to, key: p.key || portionKey(p.s, p.from, p.to) };
  state.hide = false;
  state.shown = new Set();
  go('memorize');
}
function wordPick(idx) {
  const t = state.test;
  if (!t || t.mode !== 'words' || t.checked) return;
  if (!t.bank[idx]) return;
  const tok = t.bank.splice(idx, 1)[0];
  t.placed.push(tok);
  if (t.placed.length === t.words.length) {
    t.checked = true;
    t.wordsOk = t.placed.map(function (x) { return x.w; }).join(' ') === t.words.join(' ');
    if (t.wordsOk) t.correct++;
    t.results.push({ a: t.cur, ok: t.wordsOk });
    if (t.wordsOk) sfx('ok'); else sfx('bad');
  }
  renderView();
}
function wordReturn(idx) {
  const t = state.test;
  if (!t || t.checked) return;
  const tok = t.placed.splice(idx, 1)[0];
  if (tok) t.bank.push(tok);
  renderView();
}
function blankPick(idx) {
  const t = state.test;
  if (!t || t.mode !== 'blank' || t.answered) return;
  t.answered = true;
  t.chosen = idx;
  const correctIdx = t.blank.opts.indexOf(t.blank.w);
  const ok = idx === correctIdx;
  if (ok) t.correct++;
  t.results.push({ a: t.cur, ok: ok });
  if (ok) sfx('ok'); else sfx('bad');
  renderView();
  setTimeout(function () {
    if (state.test !== t) return;
    t.i++;
    if (t.i >= t.total) finishTest();
    else { prepItem(); renderView(); }
  }, 1500);
}
function claimPrize(id) {
  const p = PRIZES.find(function (x) { return x.id === id; });
  if (!p) return;
  if (D.prizes.some(function (x) { return x.id === id; })) { toast('حصلت على هذه الجائزة بالفعل', 'info'); return; }
  if (D.stars < p.cost) { toast('تحتاج ' + ar(p.cost - D.stars) + ' نجمة إضافية', 'err'); return; }
  let code = '';
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  D.prizes.push({ id: id, at: todayKey(), code: 'HIFZ-' + code });
  saveD();
  renderView();
  confetti(90);
  sfx('win');
  toast('مبروك! جائزة «' + p.title + '» ' + p.ico, 'gold', 4200);
}

async function handleAct(act, btn) {
  switch (act) {
    case 'pick-avatar': {
      pickedAvatar = btn.dataset.avatar || '🦁';
      $$('#kAvatarPick .k-avatar-pick').forEach(function (b) { b.classList.toggle('is-on', b === btn); });
      break;
    }
    case 'ob-wird': {
      $$('#kObWird button').forEach(function (b) { b.classList.toggle('is-on', b === btn); });
      break;
    }
    case 'ob-start': {
      const sel = $('#kObWird .is-on');
      D.settings.wird = clamp(+((sel && sel.dataset.w) || D.settings.wird), 2, 8);
      D.onboarded = true;
      saveD();
      closeModal();
      renderView();
      toast('خطتك جاهزة! هيا نبدأ 🚀', 'ok');
      break;
    }
    case 'start-new': {
      const p = nextNewPortion();
      if (p) openMemorize(p);
      else { toast('أتممت حفظ الجزء كاملًا، ما شاء الله!', 'gold', 3600); go('wird'); }
      break;
    }
    case 'start-review': {
      const due = dueReviews();
      if (!due.length) { toast('لا توجد مراجعات مستحقة اليوم 🎉', 'ok'); break; }
      openTestIntro({ s: due[0].s, from: due[0].from, to: due[0].to, key: due[0].key }, 'wird');
      break;
    }
    case 'free-review': showPortionPicker('review'); break;
    case 'pick-portion': showPortionPicker('memorize'); break;
    case 'mem-change': showPortionPicker('memorize'); break;
    case 'open-portion': {
      const p = portionFromBtn(btn);
      closeModal();
      if (state.pickerMode === 'review') openTestIntro(p, 'wird');
      else openMemorize(p);
      break;
    }
    case 'play-portion': {
      playRange(+btn.dataset.s, +btn.dataset.from, +btn.dataset.to, state.repeat);
      break;
    }
    case 'play-ayah': playOne(+btn.dataset.s, +btn.dataset.a, 1); break;
    case 'play-surah': {
      const s = +btn.dataset.s;
      const q = QURAN_JUZ30[s];
      if (q) {
        playRange(s, 1, q.ayat.length, 1);
        toast('تلاوة سورة ' + surahName(s) + ' كاملة 🎧', 'info', 2200);
      }
      break;
    }
    case 'loop-ayah': playOne(+btn.dataset.s, +btn.dataset.a, 3); toast('تكرار الآية ٣ مرات', 'info', 1500); break;
    case 'cycle-repeat': {
      state.repeat = state.repeat >= 5 ? 1 : state.repeat + 1;
      AQ.repeat = state.repeat;
      if (AQ.cur) updatePlayerBar();
      renderView();
      break;
    }
    case 'toggle-hide': {
      state.hide = !state.hide;
      if (!state.hide) state.shown.clear();
      renderView();
      break;
    }
    case 'toggle-ayah': {
      const a = +btn.dataset.a;
      if (state.shown.has(a)) state.shown.delete(a); else state.shown.add(a);
      renderView();
      break;
    }
    case 'mark-learned': {
      const p = state.mem;
      if (!p) break;
      if (isLearned(p.key)) { toast('هذا الورد محفوظ مسبقًا ✓', 'ok'); break; }
      const before = completeSurahs();
      D.portions.push({
        key: p.key, s: p.s, from: p.from, to: p.to,
        learnedAt: todayKey(), stage: 0, next: shiftDay(1), tests: 0, best: 0, needsWork: false
      });
      dayRec().learned += 1;
      touchStreak();
      saveD();
      addStars((p.to - p.from + 1) * 3 + 5);
      const after = completeSurahs();
      const newOnes = after.filter(function (s) { return before.indexOf(s) === -1; });
      saveD();
      renderView();
      confetti(90);
      sfx('win');
      toast('ما شاء الله! أتممت حفظ الورد 🌟', 'ok', 3400);
      newOnes.forEach(function (s) {
        setTimeout(function () {
          toast('أتممت سورة ' + surahName(s) + '! شهادتك جاهزة في «شهاداتي» 📜', 'gold', 5200);
        }, 1000);
      });
      showModal('أحسنت! 🎉',
        '<div style="text-align:center;padding:6px">' +
          '<div style="font-size:58px;line-height:1.2">🌟</div>' +
          '<p style="font-size:15px;font-weight:800;margin:8px 0">أتممت حفظ ' + pLabel(p.s, p.from, p.to) + '</p>' +
          '<p class="k-muted" style="font-size:13px;margin:0">الآن اختبر نفسك لتثبّت الحفظ في ذاكرتك.</p>' +
        '</div>',
        '<button class="k-btn k-btn--primary" data-act="test-current">🎙️ اختبرني الآن</button>' +
        '<button class="k-btn k-btn--ghost" data-act="close-modal">لاحقًا</button>');
      break;
    }
    case 'test-current': {
      const p = state.mem;
      if (!p) break;
      if (state.modalOpen) closeModal();
      openTestIntro({ s: p.s, from: p.from, to: p.to, key: p.key }, 'memorize');
      break;
    }
    case 'test-portion': openTestIntro(portionFromBtn(btn), state.route); break;
    case 'begin-test': beginTest(btn.dataset.mode); break;
    case 'reveal': if (state.test) { state.test.revealed = true; renderView(); } break;
    case 'reveal-text': if (state.test) { state.test.textShown = true; renderView(); } break;
    case 'grade': gradeCurrent(btn.dataset.ok === '1'); break;
    case 'word-bank': wordPick(+btn.dataset.i); break;
    case 'word-placed': wordReturn(+btn.dataset.i); break;
    case 'blank-opt': blankPick(+btn.dataset.i); break;
    case 'next-item': nextItem(); break;
    case 'rec-toggle': {
      if (state.test && state.test.recording) stopRec();
      else startRec();
      break;
    }
    case 'rec-again': {
      if (state.test) { state.test.recUrl = null; state.test.textShown = true; }
      startRec();
      break;
    }
    case 'retry-test': {
      const m = state.test ? state.test.mode : 'self';
      beginTest(m);
      break;
    }
    case 'exit-test': go(state.back || 'wird'); break;
    case 'test-back': go(state.back || 'home'); break;
    case 'go-mem': {
      const t = state.test;
      if (t) state.mem = { s: t.s, from: t.from, to: t.to, key: t.key };
      go('memorize');
      break;
    }
    case 'claim-prize': claimPrize(btn.dataset.id); break;
    case 'open-cert': {
      const c = availableCerts().find(function (x) { return x.id === btn.dataset.id; });
      if (c) openCert(c);
      break;
    }
    case 'cert-download': certDownload(); break;
    case 'cert-print': certPrint(); break;
    case 'cert-share': certShare(); break;
    case 'close-modal': closeModal(); break;
    case 'confirm-ok': {
      const cb = state.confirmCb;
      state.confirmCb = null;
      closeModal();
      if (cb) cb();
      break;
    }
    case 'theme': toggleTheme(); break;
    case 'logout': logout(); break;
    case 'save-name': saveName(); break;
    case 'set-avatar': setAvatar(btn.dataset.avatar); break;
    case 'set-wird': setWird(+btn.dataset.n); break;
    case 'toggle-sound': {
      D.settings.sound = !D.settings.sound;
      saveD();
      renderView();
      if (D.settings.sound) sfx('ok');
      break;
    }
    case 'export': exportData(); break;
    case 'import': {
      const f = $('#kImportFile');
      if (f) f.click();
      break;
    }
    case 'reset-progress': {
      confirmModal('إعادة تعيين التقدم',
        'سيُحذف كل الحفظ والنجوم والأوسمة والشهادات، وسيبقى حسابك. هل أنت متأكد؟',
        'نعم، أعد التعيين', function () {
          const wird = D.settings.wird;
          D = defaultData();
          D.settings.wird = wird;
          D.onboarded = true;
          saveD();
          go('home');
          toast('تم إعادة تعيين التقدم', 'ok');
        });
      break;
    }
    case 'delete-account': {
      confirmModal('حذف الحساب',
        'سيُحذف حسابك وكل بياناتك نهائيًا من هذا الجهاز. لا يمكن التراجع عن هذا الإجراء.',
        'احذف الحساب', function () {
          const users = getUsers().filter(function (u) { return u.id !== USER.id; });
          saveUsers(users);
          lsDel(K.data(USER.id));
          lsDel(K.session);
          stopAudio();
          USER = null;
          D = null;
          state.mem = null;
          state.test = null;
          state.testIntro = null;
          state.cert = null;
          state.shown = new Set();
          showAuth();
          setAuthMode('signup');
          toast('تم حذف الحساب', 'ok');
        });
      break;
    }
    case 'quick-test': {
      const p = D.portions[D.portions.length - 1] || nextNewPortion();
      if (p) openTestIntro({ s: p.s, from: p.from, to: p.to, key: p.key || portionKey(p.s, p.from, p.to) }, 'home');
      else toast('ابدأ حفظ ورد أولًا', 'info');
      break;
    }
    default: break;
  }
}

/* ------------------------- 26) ربط الأحداث ------------------------- */
function bindAuth() {
  $$('.k-auth-tab').forEach(function (b) {
    b.addEventListener('click', function () { setAuthMode(b.dataset.authTab); });
  });
  const form = $('#kAuthForm');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (authMode === 'signup') doSignup(); else doLogin();
    });
  }
  const eye = $('#kEye');
  if (eye) {
    eye.addEventListener('click', function () {
      const p = $('#kPass');
      if (!p) return;
      const show = p.type === 'password';
      p.type = show ? 'text' : 'password';
      eye.textContent = show ? '🙈' : '👁️';
      eye.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
    });
  }
  const wirdBox = $('#kWirdPick');
  if (wirdBox) {
    wirdBox.addEventListener('click', function (e) {
      const b = e.target.closest('[data-wird]');
      if (!b) return;
      pickedWird = +b.dataset.wird || 3;
      $$('#kWirdPick button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
    });
  }
  buildAvatars();
  setAuthMode('login');
}

function bindGlobal() {
  document.addEventListener('click', function (e) {
    const pBtn = e.target.closest('[data-p]');
    if (pBtn) { e.preventDefault(); playerCmd(pBtn.dataset.p); return; }
    const goBtn = e.target.closest('[data-go]');
    if (goBtn) {
      e.preventDefault();
      if (state.modalOpen) closeModal();
      go(goBtn.dataset.go);
      return;
    }
    const actBtn = e.target.closest('[data-act]');
    if (!actBtn) return;
    e.preventDefault();
    handleAct(actBtn.dataset.act, actBtn);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (state.modalOpen) closeModal();
      else if (USER) stopAudio();
    }
  });

  const closeBtn = $('#kModalClose');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  const modal = $('#kModal');
  if (modal) {
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
  }

  const themeSide = $('#kThemeSide');
  if (themeSide) themeSide.addEventListener('click', toggleTheme);
  const themeTop = $('#kThemeTop');
  if (themeTop) themeTop.addEventListener('click', toggleTheme);
  const logoutSide = $('#kLogoutSide');
  if (logoutSide) logoutSide.addEventListener('click', logout);

  document.addEventListener('change', function (e) {
    if (e.target && e.target.id === 'kImportFile') {
      importFile(e.target.files && e.target.files[0]);
      try { e.target.value = ''; } catch (err) {}
    }
  });

  window.addEventListener('hashchange', function () {
    if (!USER) return;
    const r = (location.hash || '').replace('#', '');
    if (ROUTES.indexOf(r) > -1 && r !== state.route) go(r, null, true);
  });

  window.addEventListener('resize', function () {
    const cv = $('#kConfetti');
    if (cv) { cv.width = window.innerWidth; cv.height = window.innerHeight; }
  });
}

/* ------------------------- 27) التشغيل ------------------------- */
function boot() {
  applyTheme(lsGet(K.theme) === 'dark', false);
  bindAuth();
  bindGlobal();
  const sid = lsGet(K.session);
  if (sid) {
    const u = getUsers().find(function (x) { return x.id === sid; });
    if (u) { enterApp(u); return; }
    lsDel(K.session);
  }
  showAuth();
}

window.__kids = {
  get user() { return USER; },
  get data() { return D; },
  go: go,
  stats: stats,
  plan: planAll
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
