// 第七關「釋放與自由」的規則。純函式，不碰網路也不碰儲存。
//
// 這一關完全不依賴前六關 —— 上一次沒來的人不會少玩到任何東西。
// 接過來的只有卡片上的兩條線。**第三關起第一次來的人，幸福根基直接給 15。**
//
// 流程：自由是什麼 → **身不由己五回合（「不要」越來越難按，每回合長一條鏈）** →
// 帳單（每條「好過一點」−5）→ 見證 → **領受 8:36＝斷鏈（根基 +10、每條鏈 +3）** →
// 拒絕的自由三回合（不計分）→ 耶穌裡的真自由 → **補滿 100（全場同時）** → 釋放禱告 → 天上的教會。
//
// ⚠️ **這是模擬器的最後一關**（第八週不用模擬器）。補滿 100 之後幸福根基鎖在 100，禱告不再加。
// ⚠️ 領受經文是**領受**，不是「我相信」按鈕。沒按的人翻到拒絕的自由時手機先跳回經文卡。
import { OX, BOUND, BILL, STORY, VERSE, REFUSE, TRUE_FREE, FULL, BLESS, HEAVEN, NEXT } from './w7-data.js';

// 幸福根基的規則七關都一樣。上限 95 不是 100 —— 你自己填不滿。
// **第七關第 12 頁補滿之後才變成 100**（FULL_INNER）。
export const INNER_CAP = 95;
export const FULL_INNER = 100;
export const INNER_PER_WEEK = 15;
export const INNER_VERSE = 10;
// 第三關起第一次來的新朋友直接給 15。
export const NEWCOMER_INNER = 15;

export const PHASES = [
  { id: 'lobby',     tag: '入場',     title: '掃碼進場' },
  { id: 'reconnect', tag: '接關',     title: '輸入幸福指數' },
  { id: 'ox',        tag: '互動點 1', title: '身不由己 O/X（八題）' },
  { id: 'oxTally',   tag: '統計',     title: '我們都有點身不由己' },
  { id: 'bound',     tag: '主遊戲',   title: '身不由己（五回合）' },
  { id: 'bill',      tag: '結算頁',   title: '罪的奴僕，身不由己' },
  { id: 'story',     tag: '見證',     title: '見證分享' },
  { id: 'verse',     tag: '經文',     title: '領受經文' },
  { id: 'faith',     tag: '信息',     title: '信而受洗 · 醫治與平安' },
  { id: 'refuse',    tag: '互動點 3', title: '拒絕的自由（三回合）' },
  { id: 'trueFree',  tag: '揭曉',     title: '耶穌裡的真自由' },
  { id: 'full',      tag: '補滿',     title: '補滿 100' },
  { id: 'heaven',    tag: '天上的教會', title: '天上的教會' },
  { id: 'bless',     tag: '互動點 4', title: '釋放禱告' },
  { id: 'card',      tag: '週卡',     title: '儲存模擬回憶' },
  { id: 'end',       tag: '預告',     title: '下週預告' },
];

const phaseId = (s) => (PHASES[s.phaseIdx] || PHASES[0]).id;
const ROUNDS = BOUND.rounds;
const B_TOTAL = ROUNDS.length;
const R_TOTAL = REFUSE.rounds.length;

export function createState() {
  return {
    week: 7,
    phaseIdx: 0,
    players: {},
    order: [],
    oxRound: 0,
    oxOpen: [],
    boundRound: 0,
    boundOpen: [],
    billPaid: false,     // 帳單只扣一次
    billStep: 0,         // 0 帳單＋鎖鏈 → 1 生活沒有意義
    refuseRound: 0,
    refuseOpen: [],
    filled: false,       // 補滿 100 了沒
    heavenStep: 0,       // 0 最後一格 → 1 那不是最後一格 → 2 天上的教會
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
    ox: [],               // O/X 八題各選了什麼：'o'／'x'
    bound: [],            // 五回合各選了什麼：'ease'／'no'
    boundDelta: [],       // 每一回合公布時幸福指數動了多少（重跑的時候要還原）
    billLoss: 0,
    broken: false,        // 領受經文了沒（＝鎖鏈斷了沒）
    breakGain: 0,
    capped: false,        // 領受那一刻撞到 95
    innerBeforeFill: null,
    refuse: [],           // 拒絕的自由三回合
    hasBless: false,
    prayed: false,
    cardDone: false,
    adjust: 0,
  };
  s.order.push(pid);
  return pid;
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

// 統計：每一題幾個人選 O（照 O 的人數排）
function oxTallyView(s) {
  const ps = alive(s);
  const rows = OX.questions.map((q, i) => ({
    q, order: i,
    o: ps.filter((p) => oxAt(p, i) === 'o').length,
    n: ps.filter((p) => oxAt(p, i) !== undefined).length,
  }));
  rows.sort((a, b) => (b.o - a.o) || (a.order - b.order));
  return { rows, max: Math.max(1, rows.reduce((m, r) => Math.max(m, r.n), 0)) };
}

// ── 身不由己 ────────────────────────────────────────────────────────────
const choiceAt = (p, r) => arr(p.bound)[r];

// 這一回合公布之前，他已經選過幾次「好過一點」（只算公布過的）
function easeBefore(s, p, r) {
  let n = 0;
  for (let i = 0; i < r; i++) if (shown(s, 'boundOpen', i) && choiceAt(p, i) === 'ease') n += 1;
  return n;
}

export function revealBound(s) {
  const r = s.boundRound;
  if (r >= B_TOTAL || shown(s, 'boundOpen', r)) return false;
  s.boundOpen.push(r);
  alive(s).forEach((p) => {
    if (p.outer === null) return;
    const c = choiceAt(p, r);
    const before = p.outer;
    if (c === 'ease') p.outer = clamp(p.outer + (BOUND.easeGain[easeBefore(s, p, r)] || 0));
    else if (c === 'no') p.outer = clamp(p.outer - BOUND.noLoss);
    else p.outer = clamp(p.outer - BOUND.idleLoss);
    const d = arr(p.boundDelta).slice();
    d[r] = p.outer - before;
    p.boundDelta = d;
  });
  return true;
}

export function boundStep(s) {
  if (!shown(s, 'boundOpen', s.boundRound)) return revealBound(s);
  if (s.boundRound < B_TOTAL - 1) { s.boundRound += 1; return true; }
  return false;
}

export function boundPrev(s) {
  if (s.boundRound <= 0) return false;
  s.boundRound -= 1;
  return true;
}

// 五回合重跑：分數還原、鎖鏈清掉、帳單也還原（**斷過鏈的不動** —— 那時候已經過了）
export function boundRestart(s) {
  alive(s).forEach((p) => {
    const sum = arr(p.boundDelta).reduce((a, b) => a + (b || 0), 0);
    if (p.outer !== null) p.outer = clamp(p.outer - sum + (p.billLoss || 0));
    p.boundDelta = [];
    p.billLoss = 0;
    p.bound = [];
  });
  s.boundRound = 0;
  s.boundOpen = [];
  s.billPaid = false;
  s.billStep = 0;
}

// 他身上的鎖鏈（公布過的每一回合一條）。**斷了就是空的。**
function chainsOf(s, p) {
  if (p.broken) return [];
  const out = [];
  for (let r = 0; r < B_TOTAL; r++) {
    if (!shown(s, 'boundOpen', r)) continue;
    out.push(choiceAt(p, r) === 'ease' ? ROUNDS[r].chain : BOUND.pressChain);
  }
  return out;
}
// 公布過幾回合（＝斷鏈之前每個人身上有幾條）
const boundCount = (s) => openList(s, 'boundOpen').length;

// ── 帳單（第 6 頁一進來就扣，只扣一次）─────────────────────────────────
function payBill(s) {
  if (s.billPaid) return;
  s.billPaid = true;
  alive(s).forEach((p) => {
    if (p.outer === null) return;
    let n = 0;
    for (let r = 0; r < B_TOTAL; r++) if (shown(s, 'boundOpen', r) && choiceAt(p, r) === 'ease') n += 1;
    const before = p.outer;
    p.outer = clamp(p.outer - n * BILL.per);
    p.billLoss = before - p.outer;
  });
}

// ── 領受＝斷鏈 ─────────────────────────────────────────────────────────
function breakFree(s, p) {
  if (p.broken) return;
  const n = chainsOf(s, p).length;
  p.broken = true;
  const before = p.inner || 0;
  grow(s, p, INNER_VERSE);
  // 這一下本來會超過 95 —— 全勤的人會在這裡撞到牆
  p.capped = !s.filled && before + INNER_VERSE > INNER_CAP;
  if (p.outer !== null && n) {
    const o = p.outer;
    p.outer = clamp(p.outer + n * VERSE.breakGain);
    p.breakGain = p.outer - o;
  }
}

// ── 拒絕的自由 ─────────────────────────────────────────────────────────
export function refuseStep(s) {
  const r = s.refuseRound;
  if (!shown(s, 'refuseOpen', r)) { s.refuseOpen.push(r); return true; }
  if (r < R_TOTAL - 1) { s.refuseRound += 1; return true; }
  return false;
}
export function refusePrev(s) {
  if (s.refuseRound <= 0) return false;
  s.refuseRound -= 1;
  return true;
}
// 今晚全場說了幾次不（只算公布過的回合）
function saidNo(s) {
  let n = 0;
  alive(s).forEach((p) => {
    for (let r = 0; r < R_TOTAL; r++) if (shown(s, 'refuseOpen', r) && arr(p.refuse)[r] === 'no') n += 1;
  });
  return n;
}

// ── 補滿 100 ───────────────────────────────────────────────────────────
// **全場同時，不看任何條件。**
export function fill(s) {
  if (s.filled) return false;
  s.filled = true;
  alive(s).forEach((p) => {
    p.innerBeforeFill = p.inner || 0;
    p.inner = FULL_INNER;
  });
  return true;
}

// ── 一顆「下一步」按鈕，每一頁各自的意思 ─────────────────────────────────
// 大螢幕控制列和主持人備忘錄都用這一組（stepNext／stepBack），標籤由 stepView 給。
export function stepNext(s) {
  switch (phaseId(s)) {
    case 'ox': return oxStep(s);
    case 'bound': return boundStep(s);
    case 'bill': if (s.billStep < 1) { s.billStep = 1; return true; } return false;
    case 'refuse': return refuseStep(s);
    case 'full': return fill(s);
    case 'heaven': if (s.heavenStep < 2) { s.heavenStep += 1; return true; } return false;
    default: return false;
  }
}

export function stepBack(s) {
  switch (phaseId(s)) {
    case 'ox': return oxPrev(s);
    case 'bound': return boundPrev(s);
    case 'bill': if (s.billStep > 0) { s.billStep = 0; return true; } return false;
    case 'refuse': return refusePrev(s);
    case 'heaven': if (s.heavenStep > 0) { s.heavenStep -= 1; return true; } return false;
    default: return false;
  }
}

function stepView(s) {
  const id = phaseId(s);
  if (id === 'ox') {
    const r = s.oxRound, open = shown(s, 'oxOpen', r), last = r >= OX_TOTAL - 1;
    return { back: r > 0, next: !(open && last),
      label: !open ? '公布（' + (r + 1) + '/' + OX_TOTAL + '）'
        : (last ? '八題都公布了，按下一頁' : '下一題 →（' + (r + 2) + '/' + OX_TOTAL + '）') };
  }
  if (id === 'bound') {
    const r = s.boundRound, open = shown(s, 'boundOpen', r), last = r >= B_TOTAL - 1;
    return { back: r > 0, next: !(open && last), restart: true,
      label: !open ? '公布結果（' + (r + 1) + '/' + B_TOTAL + '）'
        : (last ? '都打完了，按下一頁' : '下一回合 →（' + (r + 2) + '/' + B_TOTAL + '）') };
  }
  if (id === 'bill') {
    return { back: s.billStep > 0, next: s.billStep < 1,
      label: s.billStep < 1 ? '下一段（生活沒有意義）' : '走完了，按下一頁' };
  }
  if (id === 'refuse') {
    const r = s.refuseRound, open = shown(s, 'refuseOpen', r), last = r >= R_TOTAL - 1;
    return { back: r > 0, next: !(open && last),
      label: !open ? '公布（' + (r + 1) + '/' + R_TOTAL + '）'
        : (last ? '都公布了，按下一頁' : '下一回合 →（' + (r + 2) + '/' + R_TOTAL + '）') };
  }
  if (id === 'full') {
    return { back: false, next: !s.filled, label: s.filled ? '已經補滿了' : '補滿 100' };
  }
  if (id === 'heaven') {
    const st = s.heavenStep || 0;
    return { back: st > 0, next: st < 2,
      label: ['下一段（那不是最後一格）', '下一段（天上的教會）', '走完了'][st] };
  }
  return null;
}

// ── 階段切換 ────────────────────────────────────────────────────────────
export function enterPhase(s, idx) {
  s.phaseIdx = Math.max(0, Math.min(PHASES.length - 1, idx));
  // 翻到結算頁那一刻帳單才來（只扣一次，往回翻再翻過來不會再扣）
  if (phaseId(s) === 'bill') payBill(s);
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
      if (s.filled) { p.innerBeforeFill = p.inner; p.inner = FULL_INNER; }
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
    // 身不由己：這一回合選什麼。公布之前都可以改。
    // 「不要」要長按、「好過一點」自己亮 —— **都是手機端的事**，伺服器只收結果。
    case 'bound': {
      if (phaseId(s) !== 'bound') break;
      const r = s.boundRound;
      if (Math.floor(Number(msg.round)) !== r || shown(s, 'boundOpen', r)) break;
      const k = String(msg.k || '');
      if (k !== 'ease' && k !== 'no') break;
      const rows = arr(p.bound).slice();
      rows[r] = k;
      p.bound = rows;
      break;
    }
    // 領受經文＝斷鏈。
    case 'verse':
      breakFree(s, p);
      break;
    // 拒絕的自由。不計分，公布之前都可以改。
    case 'refuse': {
      if (phaseId(s) !== 'refuse' || !p.broken) break;
      const r = s.refuseRound;
      if (Math.floor(Number(msg.round)) !== r || shown(s, 'refuseOpen', r)) break;
      const k = String(msg.k || '');
      if (k !== 'ease' && k !== 'no') break;
      const rows = arr(p.refuse).slice();
      rows[r] = k;
      p.refuse = rows;
      break;
    }
    // 「我想對它說『不』的是＿＿」。那句話留在玩家自己的手機上，這裡只收「有沒有寫」。
    // **這一關不加分**（第 12 頁已經補滿 100）；按了照樣算 prayed。
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
    case 'boundRestart': boundRestart(s); return null;
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
function boundView(s) {
  const ps = alive(s);
  const r = s.boundRound;
  const open = shown(s, 'boundOpen', r);
  const R = ROUNDS[r];
  return {
    round: r, total: B_TOTAL, revealed: open,
    bond: R.bond, text: R.text, ease: R.ease, no: R.no, hold: R.hold, lit: R.lit,
    acted: ps.filter((p) => choiceAt(p, r) !== undefined).length,
    // 公布之後才給，**只有數字**
    easeN: open ? ps.filter((p) => choiceAt(p, r) === 'ease').length : 0,
    noN: open ? ps.filter((p) => choiceAt(p, r) === 'no').length : 0,
    idleN: open ? ps.filter((p) => choiceAt(p, r) === undefined).length : 0,
    done: openList(s, 'boundOpen').length >= B_TOTAL,
  };
}

function refuseView(s) {
  const ps = alive(s).filter((p) => p.broken);
  const r = s.refuseRound;
  const open = shown(s, 'refuseOpen', r);
  const R = ROUNDS[REFUSE.rounds[r]];
  return {
    round: r, total: R_TOTAL, revealed: open,
    bond: R.bond, text: R.text, ease: R.ease, no: R.no,
    acted: ps.filter((p) => arr(p.refuse)[r] !== undefined).length,
    noN: open ? ps.filter((p) => arr(p.refuse)[r] === 'no').length : 0,
    saidNo: saidNo(s),
  };
}

function common(s) {
  const ps = alive(s);
  return {
    week: 7,
    phase: PHASES[s.phaseIdx],
    phaseIdx: s.phaseIdx,
    oxInfo: OX,
    oxNow: oxView(s),
    oxTally: oxTallyView(s),
    boundInfo: BOUND,
    boundNow: boundView(s),
    chainTotal: boundCount(s),
    bill: BILL,
    billStep: s.billStep || 0,
    billTotal: ps.reduce((a, p) => a + (p.billLoss || 0), 0),
    story: STORY,
    verse: VERSE,
    refuseInfo: REFUSE,
    refuseNow: refuseView(s),
    saidNo: saidNo(s),
    trueFree: TRUE_FREE,
    full: FULL,
    filled: !!s.filled,
    bless: BLESS,
    heaven: HEAVEN,
    next: NEXT,
    heavenStep: s.heavenStep || 0,
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
    players: ps.map((p) => ({
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart, inner: p.inner || 0,
      innerBeforeFill: p.innerBeforeFill,
      visits: p.visits, newcomer: p.newcomer,
      acted: id === 'refuse' ? arr(p.refuse)[s.refuseRound] !== undefined
        : id === 'ox' ? oxAt(p, s.oxRound) !== undefined
        : choiceAt(p, s.boundRound) !== undefined,
      chains: chainsOf(s, p).length,
      broken: !!p.broken,
      hasBless: !!p.hasBless, prayed: !!p.prayed,
      cardDone: !!p.cardDone, adjust: p.adjust || 0,
    })),
    stats: {
      count: ps.length,
      reconnected: sc.length,
      newcomers: ps.filter((p) => p.newcomer).length,
      acted: id === 'refuse' ? refuseView(s).acted : id === 'ox' ? oxView(s).acted : boundView(s).acted,
      broken: ps.filter((p) => p.broken).length,
      capped: ps.filter((p) => p.capped).length,
      notBroken: ps.filter((p) => !p.broken).length,
      outerAvg: outers.length ? Math.round(outers.reduce((a, b) => a + b, 0) / outers.length) : null,
      innerAvg: ps.length ? Math.round(ps.reduce((a, b) => a + (b.inner || 0), 0) / ps.length) : 0,
      // 下週預告那一頁的最後結算：今晚一進來自己打的那兩個數字
      startAvg: sc.length ? Math.round(sc.reduce((a, b) => a + b.outerStart, 0) / sc.length) : null,
      innerStartAvg: sc.length ? Math.round(sc.reduce((a, b) => a + (b.innerStart || 0), 0) / sc.length) : null,
      saidNo: saidNo(s),
      billTotal: ps.reduce((a, p) => a + (p.billLoss || 0), 0),
      cardsDone: ps.filter((p) => p.cardDone).length,
      blessed: ps.filter((p) => p.prayed).length,
      // 補滿那一頁：全場補了多少（主持人備忘錄念「只來過兩次的人跳了 70」用）
      fillMax: ps.reduce((m, p) => Math.max(m, p.innerBeforeFill == null ? 0 : FULL_INNER - p.innerBeforeFill), 0),
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
      innerBeforeFill: p.innerBeforeFill,
      visits: p.visits, newcomer: p.newcomer,
      oxChoice: oxAt(p, s.oxRound),
      oxO: arr(p.ox).filter((k) => k === 'o').length,
      oxN: arr(p.ox).filter((k) => k).length,
      boundChoice: choiceAt(p, s.boundRound),
      boundDelta: arr(p.boundDelta)[s.boundRound],
      chains: chainsOf(s, p),
      chainsHad: boundCount(s),
      billLoss: p.billLoss || 0,
      broken: !!p.broken,
      breakGain: p.breakGain || 0,
      capped: !!p.capped,
      refuseChoice: arr(p.refuse)[s.refuseRound],
      hasBless: !!p.hasBless, prayed: !!p.prayed,
      cardDone: !!p.cardDone,
    },
  };
}

// 第七關沒有計時的東西 —— 房間的鬧鐘只用在清空。
