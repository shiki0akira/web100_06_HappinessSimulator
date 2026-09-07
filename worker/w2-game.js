// 第二關「真相大白」的規則。純函式，不碰網路也不碰儲存。
// 整關只有一個動作 —— 把時間往前推 —— 但它會依序引爆四件事：
// 折舊、揭曉那一樣沒上過拍賣台的東西、宣布它免費、那條 ？？？ 有了名字。
import { LOTS, DEPRECIATION, MYSTERY, VERSE, Q20, STAKE_FACTOR } from './w2-data.js';

// 幸福根基的規則跟第一關一樣，七關都一樣。上限 95 不是 100 —— 你自己填不滿。
export const INNER_CAP = 95;
export const INNER_PER_WEEK = 15;
export const INNER_VERSE = 10;
export const INNER_PRAYER = 5;

export const PHASES = [
  { id: 'lobby',      tag: '入場',     title: '掃碼進場' },
  { id: 'reconnect',  tag: '接關',     title: '打開上一次的卡片' },
  { id: 'holdings',   tag: '接關',     title: '你手上有什麼' },
  { id: 'q20',        tag: '互動點 1', title: '你最重要的那樣東西，二十年後還在嗎' },
  { id: 'q20_result', tag: '互動點 1', title: '全場比例' },
  { id: 'ff_intro',   tag: '主遊戲',   title: '時間快轉三十年' },
  { id: 'depreciate', tag: '互動點 2', title: '逐項揭曉' },
  { id: 'verse_half', tag: '經文',     title: '盜賊來，無非要偷竊，殺害，毀壞' },
  { id: 'mystery',    tag: '高潮',     title: '還有一樣，沒上過拍賣台' },
  { id: 'free',       tag: '高潮',     title: '今天它不用錢' },
  { id: 'naming',     tag: '機制事件', title: '那條線有了名字' },
  { id: 'message',    tag: '見證',     title: '見證分享' },
  { id: 'verse',      tag: '經文',     title: '約翰福音 10:10' },
  { id: 'burden',     tag: '互動點 4', title: '禱告，哪一項讓你動了一下' },
  { id: 'card',       tag: '週卡',     title: '生成你的第二張卡片' },
  { id: 'end',        tag: '散會',     title: '第二關結束' },
];

export function createState() {
  return {
    week: 2,
    phaseIdx: 0,
    players: {},
    order: [],
    reveal: { idx: -1 },     // 折舊揭曉到第幾項（-1 = 還沒開始）
    mysteryOpen: false,      // 「？」宣布免費了沒
    named: false,            // 幸福根基正名了沒
    seq: 0,
  };
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const alive = (s) => s.order.map((id) => s.players[id]).filter(Boolean);
const scored = (s) => alive(s).filter((p) => p.outer !== null);
// 幸福根基只會漲。沒有任何事件扣得到它 —— 那是它唯一的意義。
const grow = (p, n) => { p.inner = Math.min(INNER_CAP, (p.inner || 0) + n); };

export function addPlayer(s, name) {
  s.seq += 1;
  const pid = 'p' + s.seq + Math.random().toString(36).slice(2, 6);
  s.players[pid] = {
    pid,
    name: String(name || '').slice(0, 12) || '朋友',
    joinedAt: Date.now(),
    outer: null,          // 幸福指數（接關輸入）
    outerStart: null,     // 折舊之前的值，卡片上要印「上週 XX」
    inner: 0,             // 幸福根基
    visits: 0,            // 這是他第幾次來（含今天）
    newcomer: false,      // 第一次來，或忘記帶卡片
    points: 20,           // 沒花掉的點數＝財富
    owned: [],            // 上禮拜標到的 lotId
    holdingsDone: false,
    q20: null,
    losses: [],           // 每一項折舊各扣了多少，重跑時要還原
    want: false,          // 按了「我要」
    hasBurden: false,     // 內容留在玩家自己的手機上
    burdenShared: '',
    receivedVerse: false,
    cardDone: false,
    adjust: 0,
  };
  s.order.push(pid);
  return pid;
}

// ── 折舊 ────────────────────────────────────────────────────────────────
// 他手上的 100 點怎麼分：買到的東西平分掉花掉的部分，剩下的是財富。
// 押越多在某一樣東西上，它折舊的時候你掉越多。
function stakeOn(p, item) {
  if (item.wealth) return p.points;
  if (!p.owned.includes(item.lotId)) return 0;
  const spent = Math.max(0, 100 - p.points);
  return p.owned.length ? spent / p.owned.length : 0;
}

function lossFor(p, item) {
  return Math.round(stakeOn(p, item) * item.rate * STAKE_FACTOR);
}

// 揭曉下一項。回傳有沒有真的往前走。
export function revealNext(s) {
  if (s.reveal.idx >= DEPRECIATION.length - 1) return false;
  s.reveal.idx += 1;
  const item = DEPRECIATION[s.reveal.idx];
  alive(s).forEach((p) => {
    const loss = p.outer === null ? 0 : lossFor(p, item);
    p.losses[s.reveal.idx] = loss;
    if (p.outer !== null) p.outer = clamp(p.outer - loss);
  });
  return true;
}

export function resetReveal(s) {
  alive(s).forEach((p) => {
    if (p.outer !== null) {
      const back = p.losses.reduce((a, b) => a + (b || 0), 0);
      p.outer = clamp(p.outer + back);
    }
    p.losses = [];
  });
  s.reveal.idx = -1;
}

// ── 階段切換 ────────────────────────────────────────────────────────────
export function enterPhase(s, idx) {
  s.phaseIdx = Math.max(0, Math.min(PHASES.length - 1, idx));
  const id = PHASES[s.phaseIdx].id;
  // 走到「免費開放」和「正名」這兩頁，機制就跟著發生 —— 主持人不用多按一次
  if (id === 'free') s.mysteryOpen = true;
  if (id === 'naming') s.named = true;
  return null;
}

// ── 玩家動作 ────────────────────────────────────────────────────────────
export function applyAction(s, pid, msg, now) {
  const p = s.players[pid];
  if (!p) return null;
  switch (msg.type) {
    // 接關：幸福指數用打的（卡片上的數字），第幾次來用點的。
    // 幸福根基不叫他打字 —— 忘記帶卡片的人也答得出「第幾次來」。
    case 'reconnect': {
      p.outer = clamp(msg.value);
      p.outerStart = p.outer;
      p.newcomer = !!msg.newcomer;
      p.visits = Math.max(1, Math.min(8, Math.floor(Number(msg.visits) || 1)));
      // 今天的 +15 要靠等一下的領受和禱告賺，所以起點只算到上一次為止
      p.inner = Math.min(INNER_CAP, INNER_PER_WEEK * (p.visits - 1));
      break;
    }
    case 'holdings': {
      const ids = Array.isArray(msg.owned) ? msg.owned : [];
      const valid = LOTS.map((l) => l.id);
      p.owned = ids.map(Number).filter((x) => valid.includes(x)).slice(0, 10);
      p.points = Math.max(0, Math.min(100, Math.floor(Number(msg.points) || 0)));
      p.holdingsDone = true;
      break;
    }
    case 'q20':
      p.q20 = Math.max(0, Math.min(Q20.options.length - 1, Math.floor(Number(msg.value))));
      break;
    // 不勉強、不扣分、不催。按了就按了，再按一次可以收回。
    case 'want':
      if (s.mysteryOpen) p.want = !p.want;
      break;
    case 'verse':
      if (!p.receivedVerse) { p.receivedVerse = true; grow(p, INNER_VERSE); }
      break;
    case 'card':
      if (!p.cardDone) { p.cardDone = true; grow(p, INNER_PRAYER); }
      break;
    // 那一句話留在玩家自己的手機上。這裡只收「有沒有寫」。
    case 'burden':
      p.hasBurden = !!msg.has;
      p.burdenShared = msg.share ? String(msg.text || '').slice(0, 120) : '';
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
    case 'nextItem': revealNext(s); return null;
    case 'resetReveal': resetReveal(s); return null;
    case 'revealAll':
      while (revealNext(s)) { /* 趕時間的時候用 */ }
      return null;
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
function revealView(s) {
  const idx = s.reveal.idx;
  return {
    idx,
    total: DEPRECIATION.length,
    item: idx >= 0 ? DEPRECIATION[idx] : null,
    done: idx >= DEPRECIATION.length - 1,
    revealed: DEPRECIATION.slice(0, Math.max(0, idx + 1)),
  };
}

function q20Counts(s) {
  const c = new Array(Q20.options.length).fill(0);
  alive(s).forEach((p) => { if (p.q20 !== null) c[p.q20] += 1; });
  return c;
}

export function hostView(s, roomCode) {
  const ps = alive(s);
  const sc = scored(s);
  const outers = sc.map((p) => p.outer);
  const starts = sc.map((p) => p.outerStart);

  return {
    role: 'host',
    week: 2,
    room: roomCode,
    phase: PHASES[s.phaseIdx],
    phaseIdx: s.phaseIdx,
    phases: PHASES,
    verse: VERSE,
    q20: Q20,
    mystery: MYSTERY,
    named: s.named,
    mysteryOpen: s.mysteryOpen,
    reveal: revealView(s),
    lots: LOTS,
    players: ps.map((p) => ({
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart, inner: p.inner || 0,
      visits: p.visits, newcomer: p.newcomer,
      points: p.points, owned: p.owned, holdingsDone: p.holdingsDone,
      lastLoss: p.losses[s.reveal.idx] || 0,
      q20: p.q20, want: p.want,
      hasBurden: p.hasBurden, burdenShare: !!p.burdenShared,
      receivedVerse: p.receivedVerse, cardDone: p.cardDone, adjust: p.adjust,
    })),
    stats: {
      count: ps.length,
      reconnected: sc.length,
      holdingsDone: ps.filter((p) => p.holdingsDone).length,
      newcomers: ps.filter((p) => p.newcomer).length,
      answeredQ20: ps.filter((p) => p.q20 !== null).length,
      q20Counts: q20Counts(s),
      outerAvg: outers.length ? Math.round(outers.reduce((a, b) => a + b, 0) / outers.length) : null,
      startAvg: starts.length ? Math.round(starts.reduce((a, b) => a + b, 0) / starts.length) : null,
      innerAvg: ps.length ? Math.round(ps.reduce((a, b) => a + (b.inner || 0), 0) / ps.length) : 0,
      // 掉最多的那個人 —— 你押在哪裡，決定你掉多少
      hardestHit: (() => {
        const withDrop = sc.map((p) => ({ name: p.name, drop: p.outerStart - p.outer }))
          .sort((a, b) => b.drop - a.drop);
        return withDrop.length && withDrop[0].drop > 0 ? withDrop[0] : null;
      })(),
      wants: ps.filter((p) => p.want).map((p) => p.name),
      versesReceived: ps.filter((p) => p.receivedVerse).length,
      cardsDone: ps.filter((p) => p.cardDone).length,
      burdens: ps.filter((p) => p.hasBurden).length,
      sharedBurdens: ps.filter((p) => p.burdenShared).map((p) => ({ name: p.name, text: p.burdenShared })),
    },
  };
}

export function playerView(s, pid, roomCode) {
  const p = s.players[pid];
  const base = {
    role: 'player',
    week: 2,
    room: roomCode,
    phase: PHASES[s.phaseIdx],
    phaseIdx: s.phaseIdx,
    verse: VERSE,
    q20: Q20,
    mystery: MYSTERY,
    named: s.named,
    mysteryOpen: s.mysteryOpen,
    reveal: revealView(s),
    lots: LOTS,
    playerCount: alive(s).length,
  };
  if (!p) return { ...base, me: null };
  return {
    ...base,
    me: {
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart,
      inner: p.inner || 0, innerCap: INNER_CAP,
      visits: p.visits, newcomer: p.newcomer,
      points: p.points, owned: p.owned, holdingsDone: p.holdingsDone,
      lastLoss: p.losses[s.reveal.idx] || 0,
      q20: p.q20, want: p.want,
      hasBurden: p.hasBurden, burdenShare: !!p.burdenShared,
      receivedVerse: p.receivedVerse, cardDone: p.cardDone,
    },
  };
}

// 第二關沒有計時的東西 —— 房間的鬧鐘只用在清空。
