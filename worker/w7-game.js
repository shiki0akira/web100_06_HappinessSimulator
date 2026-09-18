// 第七關「釋放與自由」的規則。純函式，不碰網路也不碰儲存。
//
// 這一關完全不依賴前六關 —— 上一次沒來的人不會少玩到任何東西。
// 接過來的只有卡片上的兩條線。**第三關起第一次來的人，幸福根基直接給 15。**
//
// 流程：身不由己 O/X → 統計 → 見證 → 信而受洗 → 耶穌裡的真自由 → 領受經文（+10，最多 95）→
// 這不是一個分數，是一個身分 → 邀請 → **天上的身分：按了「我願意」，那一條慢慢補滿 100；
// 最後全場一起補滿** → 祝福禱告 → 週卡 → 下週預告。
//
// ⚠️ **這是模擬器的最後一關**（第八週不用模擬器）。補滿之後幸福根基鎖在 100，禱告不再加。
// ⚠️ **誰按了「我願意」不公開**：大螢幕的線不掛名字、側欄要等全場補滿才變；名字只給主持人備忘錄。
import { FREE, OX, STORY, FAITH, TRUE_FREE, VERSE, IDENTITY, INVITE, WILLING, BLESS, NEXT } from './w7-data.js';

// 幸福根基的規則七關都一樣。上限 95 不是 100 —— 你自己填不滿。
// **第七關「天上的身分」補滿之後才變成 100**（FULL_INNER）。
export const INNER_CAP = 95;
export const FULL_INNER = 100;
export const INNER_PER_WEEK = 15;
export const INNER_VERSE = 10;
// 第三關起第一次來的新朋友直接給 15。
export const NEWCOMER_INNER = 15;

export const PHASES = [
  { id: 'lobby',     tag: '入場',     title: '掃碼進場' },
  { id: 'reconnect', tag: '接關',     title: '輸入幸福指數' },
  { id: 'free',      tag: '互動點 1', title: '你覺得自由是什麼？' },
  { id: 'ox',        tag: '互動點 2', title: '身不由己 O/X（八題）' },
  { id: 'oxTally',   tag: '統計',     title: '我們都有點身不由己' },
  { id: 'story',     tag: '見證',     title: '見證分享' },
  { id: 'faith',     tag: '信息',     title: '信而受洗 · 醫治與平安' },
  { id: 'trueFree',  tag: '揭曉',     title: '耶穌裡的真自由' },
  { id: 'verse',     tag: '經文',     title: '領受經文' },
  { id: 'identity',  tag: '身分',     title: '這不是一個分數，是一個身分' },
  { id: 'invite',    tag: '邀請',     title: '你願意成為上帝的兒女嗎？' },
  { id: 'willing',   tag: '互動點 3', title: '天上的身分（我願意）' },
  { id: 'bless',     tag: '互動點 4', title: '祝福禱告' },
  { id: 'card',      tag: '週卡',     title: '儲存模擬回憶' },
  { id: 'end',       tag: '預告',     title: '下週預告' },
];

const phaseId = (s) => (PHASES[s.phaseIdx] || PHASES[0]).id;

export function createState() {
  return {
    week: 7,
    phaseIdx: 0,
    players: {},
    order: [],
    freeStep: 0,         // 0 作答 → 1 長條
    oxRound: 0,
    oxOpen: [],
    filled: false,       // 全場補滿 100 了沒
    seq: 0,
  };
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const alive = (s) => s.order.map((id) => s.players[id]).filter(Boolean);
const scored = (s) => alive(s).filter((p) => p.outer !== null);
const arr = (v) => (Array.isArray(v) ? v : []);
const openList = (s, key) => (Array.isArray(s[key]) ? s[key] : (s[key] = []));
const shown = (s, key, r) => openList(s, key).indexOf(r) >= 0;
// 幸福根基只會漲。補滿之後一律 100。
const capOf = (s) => (s.filled ? FULL_INNER : INNER_CAP);
const grow = (s, p, n) => { p.inner = s.filled ? FULL_INNER : Math.min(INNER_CAP, (p.inner || 0) + n); };
// 按了「我願意」或全場補滿了：他的那一條是 100（**側欄的數字不看這個** —— 要等全場補滿）
const shownInner = (s, p) => (s.filled || p.willing === 'yes' ? FULL_INNER : (p.inner || 0));

export function addPlayer(s, name) {
  s.seq += 1;
  const pid = 'p' + s.seq + Math.random().toString(36).slice(2, 6);
  s.players[pid] = {
    pid,
    name: String(name || '').slice(0, 12) || '朋友',
    joinedAt: Date.now(),
    outer: null,
    outerStart: null,
    inner: s.filled ? FULL_INNER : 0,
    innerStart: 0,
    visits: 0,
    newcomer: false,
    free: [],             // 自由是什麼（勾了哪幾個）
    freeOther: '',        // 其他（**會上大螢幕，不掛名字**）
    freeSent: false,
    ox: [],               // O/X 八題各選了什麼：'o'／'x'
    receivedVerse: false,
    capped: false,        // 領受那一刻撞到 95
    willing: '',          // 天上的身分：'yes'（我願意）／'later'（我想再想想）。**只有主持人備忘錄看得到**
    hasBless: false,
    prayed: false,
    cardDone: false,
    adjust: 0,
  };
  s.order.push(pid);
  return pid;
}

// ── 你覺得自由是什麼？ ────────────────────────────────────────────────
function freeView(s) {
  const ps = alive(s);
  const rows = FREE.options.map((o, i) => ({
    k: o.k, t: o.t, order: i, n: ps.filter((p) => arr(p.free).indexOf(o.k) >= 0).length,
  }));
  const others = ps.map((p) => String(p.freeOther || '').trim()).filter(Boolean);
  const max = rows.reduce((m, r) => Math.max(m, r.n), 0);
  const sorted = rows.slice().sort((a, b) => (b.n - a.n) || (a.order - b.order));
  return {
    step: s.freeStep || 0,
    sent: ps.filter((p) => p.freeSent).length,
    rows: sorted,
    others: s.freeStep >= 1 ? others : [],
    max: Math.max(max, 1),
    // 「耶穌裡的真自由」左欄：勾最多的三項（沒人勾的不算）
    top: sorted.filter((r) => r.n > 0).slice(0, 3).map((r) => r.t),
  };
}

// ── 身不由己 O/X ───────────────────────────────────────────────────────
const OX_TOTAL = OX.questions.length;
const oxAt = (p, r) => arr(p.ox)[r];

export function oxStep(s) {
  const r = s.oxRound;
  if (!shown(s, 'oxOpen', r)) { s.oxOpen.push(r); return true; }
  if (r < OX_TOTAL - 1) { s.oxRound += 1; return true; }
  return false;
}
export function oxPrev(s) {
  if (s.oxRound <= 0) return false;
  s.oxRound -= 1;
  return true;
}

// 這一題：**公布之後**才給 O、X 兩邊的名字（照進場順序）
function oxView(s) {
  const ps = alive(s);
  const r = s.oxRound;
  const open = shown(s, 'oxOpen', r);
  return {
    round: r, total: OX_TOTAL, revealed: open,
    q: OX.questions[r],
    acted: ps.filter((p) => oxAt(p, r) !== undefined).length,
    o: open ? ps.filter((p) => oxAt(p, r) === 'o').map((p) => p.name) : [],
    x: open ? ps.filter((p) => oxAt(p, r) === 'x').map((p) => p.name) : [],
  };
}

// 統計：每一題誰選 O、誰選 X（照 O 的人數排；名字照進場順序）
function oxTallyView(s) {
  const ps = alive(s);
  const rows = OX.questions.map((q, i) => ({
    q, order: i,
    o: ps.filter((p) => oxAt(p, i) === 'o').length,
    oNames: ps.filter((p) => oxAt(p, i) === 'o').map((p) => p.name),
    xNames: ps.filter((p) => oxAt(p, i) === 'x').map((p) => p.name),
    n: ps.filter((p) => oxAt(p, i) !== undefined).length,
  }));
  rows.sort((a, b) => (b.o - a.o) || (a.order - b.order));
  return { rows, max: Math.max(1, rows.reduce((m, r) => Math.max(m, r.n), 0)) };
}

// ── 全場補滿 100 ───────────────────────────────────────────────────────
// 按了「我願意」的人先補滿；**最後主持人按一下，每一條都滿**（不看任何條件）。
export function fill(s) {
  if (s.filled) return false;
  s.filled = true;
  alive(s).forEach((p) => { p.inner = FULL_INNER; });
  return true;
}

// ── 一顆「下一步」按鈕，每一頁各自的意思 ─────────────────────────────────
// 大螢幕控制列和主持人備忘錄都用這一組（stepNext／stepBack），標籤由 stepView 給。
export function stepNext(s) {
  switch (phaseId(s)) {
    case 'free': if (s.freeStep < 1) { s.freeStep = 1; return true; } return false;
    case 'ox': return oxStep(s);
    case 'willing': return fill(s);
    default: return false;
  }
}

export function stepBack(s) {
  if (phaseId(s) === 'free' && s.freeStep > 0) { s.freeStep = 0; return true; }
  if (phaseId(s) === 'ox') return oxPrev(s);
  return false;
}

function stepView(s) {
  const id = phaseId(s);
  if (id === 'free') {
    return { back: s.freeStep > 0, next: s.freeStep < 1,
      label: s.freeStep < 1 ? '公布長條' : '出來了，按下一頁' };
  }
  if (id === 'ox') {
    const r = s.oxRound, open = shown(s, 'oxOpen', r), last = r >= OX_TOTAL - 1;
    return { back: r > 0, next: !(open && last),
      label: !open ? '公布（' + (r + 1) + '/' + OX_TOTAL + '）'
        : (last ? '八題都公布了，按下一頁' : '下一題 →（' + (r + 2) + '/' + OX_TOTAL + '）') };
  }
  if (id === 'willing') {
    return { back: false, next: !s.filled, label: s.filled ? '已經補滿了' : '全場補滿 100' };
  }
  return null;
}

// ── 階段切換 ────────────────────────────────────────────────────────────
export function enterPhase(s, idx) {
  s.phaseIdx = Math.max(0, Math.min(PHASES.length - 1, idx));
  return null;
}

// ── 玩家動作 ────────────────────────────────────────────────────────────
export function applyAction(s, pid, msg) {
  const p = s.players[pid];
  if (!p) return null;
  switch (msg.type) {
    case 'reconnect': {
      p.outer = clamp(msg.value);
      p.outerStart = p.outer;
      if (msg.mode === 'visits') {
        p.visits = Math.max(1, Math.min(8, Math.floor(Number(msg.visits) || 1)));
        p.inner = Math.min(INNER_CAP, INNER_PER_WEEK * (p.visits - 1));
      } else {
        p.inner = Math.max(0, Math.min(INNER_CAP, Math.floor(Number(msg.inner) || 0)));
        p.visits = p.inner > 0 ? 2 : 1;
      }
      p.newcomer = p.inner === 0;
      if (p.newcomer) p.inner = NEWCOMER_INNER;
      p.innerStart = p.inner;
      // 補滿之後才進來的人也一樣是 100
      if (s.filled) p.inner = FULL_INNER;
      break;
    }
    // 自由是什麼。**送出之後還可以改**（長條公布之前）。
    case 'free': {
      if (phaseId(s) !== 'free' || s.freeStep >= 1) break;
      const keys = arr(msg.keys).map(String).filter((k) => FREE.options.some((o) => o.k === k));
      p.free = keys.filter((k, i) => keys.indexOf(k) === i);
      p.freeOther = String(msg.other || '').trim().slice(0, 20);
      p.freeSent = true;
      break;
    }
    // O/X：這一題選 O 還是 X。公布之前都可以改。
    case 'ox': {
      if (phaseId(s) !== 'ox') break;
      const r = s.oxRound;
      if (Math.floor(Number(msg.round)) !== r || shown(s, 'oxOpen', r)) break;
      const k = String(msg.k || '');
      if (k !== 'o' && k !== 'x') break;
      const rows = arr(p.ox).slice();
      rows[r] = k;
      p.ox = rows;
      break;
    }
    // 領受經文：+10，最多 95（全勤的人會撞到牆，記 capped）
    case 'verse': {
      if (p.receivedVerse) break;
      p.receivedVerse = true;
      const before = p.inner || 0;
      grow(s, p, INNER_VERSE);
      p.capped = !s.filled && before + INNER_VERSE > INNER_CAP;
      break;
    }
    // 天上的身分：我願意／我想再想想。**只在這一頁收**，可以改（想再想想的人，門一直開著）。
    // ⚠️ 伺服器的 inner **不在這裡動** —— 側欄會露出誰按了。那一條補滿只畫在不掛名字的線和他自己的手機上。
    case 'willing': {
      if (phaseId(s) !== 'willing') break;
      const k = String(msg.k || '');
      if (k === 'yes' || k === 'later') p.willing = k;
      break;
    }
    // 「成為上帝的兒女，我想對天父說＿＿」。那句話留在玩家自己的手機上，這裡只收「有沒有寫」。
    // **這一關不加分**；按了照樣算 prayed。
    case 'bless':
      p.hasBless = !!msg.has;
      p.prayed = true;
      break;
    case 'card':
      p.cardDone = true;
      break;
    case 'rename': p.name = String(msg.name || '').slice(0, 12) || p.name; break;
  }
  return null;
}

// ── 主持人指令 ──────────────────────────────────────────────────────────
export function applyHost(s, msg) {
  switch (msg.cmd) {
    case 'next': return enterPhase(s, s.phaseIdx + 1);
    case 'prev': return enterPhase(s, s.phaseIdx - 1);
    case 'goto': return enterPhase(s, Number(msg.idx));
    case 'stepNext': stepNext(s); return null;
    case 'stepBack': stepBack(s); return null;
    case 'adjust': {
      const p = s.players[msg.pid];
      if (p && p.outer !== null) {
        const d = Number(msg.delta) || 0;
        p.outer = clamp(p.outer + d);
        p.adjust += d;
      }
      return null;
    }
    case 'kick':
      delete s.players[msg.pid];
      s.order = s.order.filter((x) => x !== msg.pid);
      return null;
    default: return null;
  }
}

// ── 對外視圖 ────────────────────────────────────────────────────────────
// 不掛名字的線：順序照 pid 打亂（每次重畫都一樣，才畫得出「慢慢補滿」）
function hashKey(pid) {
  let h = 2166136261;
  for (let i = 0; i < pid.length; i++) { h ^= pid.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}
function willingView(s) {
  const lines = alive(s).map((p) => ({ k: hashKey(p.pid), from: p.inner || 0, v: shownInner(s, p) }));
  lines.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  return { filled: !!s.filled, lines };
}

function common(s) {
  return {
    week: 7,
    phase: PHASES[s.phaseIdx],
    phaseIdx: s.phaseIdx,
    freeInfo: FREE,
    freeNow: freeView(s),
    oxInfo: OX,
    oxNow: oxView(s),
    oxTally: oxTallyView(s),
    story: STORY,
    faith: FAITH,
    trueFree: TRUE_FREE,
    verse: VERSE,
    identity: IDENTITY,
    invite: INVITE,
    willingInfo: WILLING,
    willingNow: willingView(s),
    filled: !!s.filled,
    bless: BLESS,
    next: NEXT,
    step: stepView(s),
  };
}

export function hostView(s, roomCode) {
  const ps = alive(s);
  const sc = scored(s);
  const outers = sc.map((p) => p.outer);
  const id = phaseId(s);
  return {
    role: 'host',
    room: roomCode,
    phases: PHASES,
    ...common(s),
    // ⚠️ 這裡**不放 willing**：側欄和名單不准露出誰按了「我願意」
    players: ps.map((p) => ({
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart, inner: p.inner || 0,
      visits: p.visits, newcomer: p.newcomer,
      acted: id === 'ox' ? oxAt(p, s.oxRound) !== undefined : id === 'free' ? !!p.freeSent : false,
      hasBless: !!p.hasBless, prayed: !!p.prayed,
      cardDone: !!p.cardDone, adjust: p.adjust || 0,
    })),
    stats: {
      count: ps.length,
      reconnected: sc.length,
      newcomers: ps.filter((p) => p.newcomer).length,
      acted: id === 'ox' ? oxView(s).acted : 0,
      freeSent: ps.filter((p) => p.freeSent).length,
      versesReceived: ps.filter((p) => p.receivedVerse).length,
      capped: ps.filter((p) => p.capped).length,
      outerAvg: outers.length ? Math.round(outers.reduce((a, b) => a + b, 0) / outers.length) : null,
      innerAvg: ps.length ? Math.round(ps.reduce((a, b) => a + (b.inner || 0), 0) / ps.length) : 0,
      // 下週預告那一頁的最後結算：今晚一進來自己打的那兩個數字
      startAvg: sc.length ? Math.round(sc.reduce((a, b) => a + b.outerStart, 0) / sc.length) : null,
      innerStartAvg: sc.length ? Math.round(sc.reduce((a, b) => a + (b.innerStart || 0), 0) / sc.length) : null,
      cardsDone: ps.filter((p) => p.cardDone).length,
      blessed: ps.filter((p) => p.prayed).length,
      // 天上的身分：**只給主持人備忘錄**（大螢幕的畫面不讀這兩個）
      willingYes: ps.filter((p) => p.willing === 'yes').map((p) => p.name),
      willingLater: ps.filter((p) => p.willing === 'later').length,
    },
  };
}

export function playerView(s, pid, roomCode) {
  const p = s.players[pid];
  const base = {
    role: 'player',
    room: roomCode,
    ...common(s),
    playerCount: alive(s).length,
  };
  if (!p) return { ...base, me: null };
  return {
    ...base,
    me: {
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart,
      inner: p.inner || 0, innerCap: capOf(s),
      // 他自己手機上的那一條：按了「我願意」就是 100
      innerShown: shownInner(s, p),
      visits: p.visits, newcomer: p.newcomer,
      free: arr(p.free), freeOther: p.freeOther || '', freeSent: !!p.freeSent,
      oxChoice: oxAt(p, s.oxRound),
      oxO: arr(p.ox).filter((k) => k === 'o').length,
      oxN: arr(p.ox).filter((k) => k).length,
      receivedVerse: !!p.receivedVerse,
      capped: !!p.capped,
      willing: p.willing || '',
      hasBless: !!p.hasBless, prayed: !!p.prayed,
      cardDone: !!p.cardDone,
    },
  };
}

// 第七關沒有計時的東西 —— 房間的鬧鐘只用在清空。
