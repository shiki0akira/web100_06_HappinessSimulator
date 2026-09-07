// 第二關「真相大白」的規則。純函式，不碰網路也不碰儲存。
//
// 這一關完全不依賴第一關 —— 上一次沒來的人不會少玩到任何東西。
// 從第一關接過來的只有一條線：卡片上的幸福指數（自己打），
// 加上「這是你第幾次來」推回來的幸福根基。
//
// 整關只有一個動作 —— 把時間往前推 —— 但它會依序引爆四件事：
// 你今晚保住的三樣折舊了、那張選不到的卡翻開了、它免費、那條 ？？？ 有了名字。
import { ASSETS, DEPRECIATION, KEEP_COUNT, LOCKED, MYSTERY, VERSE, Q20, LOSS_UNIT } from './w2-data.js';

// 幸福根基的規則跟第一關一樣，七關都一樣。上限 95 不是 100 —— 你自己填不滿。
export const INNER_CAP = 95;
export const INNER_PER_WEEK = 15;
export const INNER_VERSE = 10;
export const INNER_PRAYER = 5;

export const PHASES = [
  { id: 'lobby',       tag: '入場',     title: '掃碼進場' },
  { id: 'reconnect',   tag: '接關',     title: '打開上一次的卡片' },
  { id: 'keep_intro',  tag: '主遊戲',   title: '人生只能保住三樣' },
  { id: 'keep',        tag: '互動點 1', title: '選出你要保住的三樣' },
  { id: 'keep_result', tag: '互動點 1', title: '全場想保住的' },
  { id: 'q20',         tag: '互動點 2', title: '你選的那三樣，二十年後還在嗎' },
  { id: 'q20_result',  tag: '互動點 2', title: '全場比例' },
  { id: 'ff_intro',    tag: '主遊戲',   title: '時間快轉三十年' },
  { id: 'depreciate',  tag: '互動點 3', title: '逐項揭曉' },
  { id: 'survive',     tag: '結算頁',   title: '三十年後，你手上剩下什麼' },
  { id: 'verse_half',  tag: '經文',     title: '盜賊來，無非要偷竊，殺害，毀壞' },
  { id: 'mystery',     tag: '高潮',     title: '還有一樣，你剛剛選不到' },
  { id: 'free',        tag: '互動點 4', title: '今天它不用錢' },
  { id: 'naming',      tag: '機制事件', title: '那條線有了名字' },
  { id: 'message',     tag: '見證',     title: '見證分享' },
  { id: 'verse',       tag: '經文',     title: '領受經文' },
  { id: 'prayer',      tag: '互動點 5', title: '祝福禱告' },
  { id: 'card',        tag: '週卡',     title: '儲存模擬回憶' },
  { id: 'end',         tag: '預告',     title: '下週預告' },
];

// 選單開放的區間。選完就鎖住 —— 「現在有人想改嗎？不能改，這就是時間。」
const KEEP_START = PHASES.findIndex((p) => p.id === 'keep_intro');
const KEEP_END = PHASES.findIndex((p) => p.id === 'keep_result');
const keepOpen = (s) => s.phaseIdx >= KEEP_START && s.phaseIdx <= KEEP_END;

export function createState() {
  return {
    week: 2,
    phaseIdx: 0,
    players: {},
    order: [],
    reveal: { idx: -1 },     // 折舊揭曉到第幾項（-1 = 還沒開始）
    mysteryOpen: false,      // 那一格宣布免費了沒
    named: false,            // 幸福根基正名了沒
    seq: 0,
  };
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const alive = (s) => s.order.map((id) => s.players[id]).filter(Boolean);
const scored = (s) => alive(s).filter((p) => p.outer !== null);
// 幸福根基只會漲。沒有任何事件扣得到它 —— 那是它唯一的意義。
const grow = (p, n) => { p.inner = Math.min(INNER_CAP, (p.inner || 0) + n); };
const assetOf = (id) => ASSETS.find((a) => a.id === id) || null;

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
    keep: [],             // 他今晚選要保住的三樣（asset id）
    keepDone: false,
    q20: null,
    losses: [],           // 每一項折舊各扣了多少，重跑時要還原
    want: false,          // 按了「我要」
    hasBurden: false,     // 那句話留在玩家自己的手機上
    prayed: false,        // 祝福禱告送出過了沒
    receivedVerse: false,
    cardDone: false,
    adjust: 0,
  };
  s.order.push(pid);
  return pid;
}

// ── 折舊 ────────────────────────────────────────────────────────────────
// 你保住的那三樣，折舊的時候算在你頭上；沒選的不算你的。
// 所以「你押在哪裡，決定你掉多少」—— 押工作和名聲的掉最慘，押關係的掉最少。
function lossFor(p, item) {
  return p.keep.indexOf(item.id) >= 0 ? Math.round(item.rate * LOSS_UNIT) : 0;
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

// 他手上那三樣，三十年後各剩幾成 —— 手機上的小看板、結算頁和卡片都用這一份。
// **還沒揭曉的那幾樣不給折舊率**，不然手機上就先看得到答案了。
function survivalOf(s, p) {
  const openIdx = s.reveal.idx;
  return p.keep.map((id) => {
    const a = assetOf(id);
    if (!a) return null;
    const at = DEPRECIATION.findIndex((d) => d.id === id);
    if (at < 0 || at > openIdx) return { id: a.id, name: a.name, revealed: false };
    return {
      id: a.id, name: a.name, revealed: true,
      rate: a.rate, left: Math.round((1 - a.rate) * 100),
      loss: p.losses[at] || 0,
    };
  }).filter(Boolean);
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
export function applyAction(s, pid, msg) {
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
    // 保住三樣。選單一關掉就不收了 —— 揭曉開始之後不能改，那是這一關的台詞。
    case 'keep': {
      if (!keepOpen(s)) break;
      const valid = ASSETS.map((a) => a.id);
      const ids = (Array.isArray(msg.ids) ? msg.ids : []).map(Number)
        .filter((x, i, arr) => valid.indexOf(x) >= 0 && arr.indexOf(x) === i)
        .slice(0, KEEP_COUNT);
      p.keep = ids;
      p.keepDone = ids.length === KEEP_COUNT;
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
    // 那句話留在玩家自己的手機上。這裡只收「有沒有寫」。
    // 禱告這一頁送出就加分 —— 寫不寫得出來是他的事，一起禱告是大家的事。
    case 'burden':
      p.hasBurden = !!msg.has;
      if (!p.prayed) { p.prayed = true; grow(p, INNER_PRAYER); }
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
// 選單上只給名字。折舊率跟著揭曉一項一項送出去 —— 沒開的那幾項不先進到畫面裡。
const assetMenu = () => ASSETS.map((a) => ({ id: a.id, name: a.name }));

function revealView(s) {
  const idx = s.reveal.idx;
  const strip = (it) => ({ id: it.id, name: it.name, rate: it.rate, why: it.why });
  return {
    idx,
    total: DEPRECIATION.length,
    item: idx >= 0 ? strip(DEPRECIATION[idx]) : null,
    done: idx >= DEPRECIATION.length - 1,
    revealed: DEPRECIATION.slice(0, Math.max(0, idx + 1)).map(strip),
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

  // 全場最多人想保住的。同票就一起列，不挑一個當代表。
  const keepCounts = ASSETS.map((a) => ({
    id: a.id, name: a.name,
    n: ps.filter((p) => p.keep.indexOf(a.id) >= 0).length,
  })).sort((x, y) => y.n - x.n);

  return {
    role: 'host',
    week: 2,
    room: roomCode,
    phase: PHASES[s.phaseIdx],
    phaseIdx: s.phaseIdx,
    phases: PHASES,
    verse: VERSE,
    q20: Q20,
    assets: assetMenu(),
    keepCount: KEEP_COUNT,
    locked: LOCKED,
    mystery: MYSTERY,
    named: s.named,
    mysteryOpen: s.mysteryOpen,
    keepOpen: keepOpen(s),
    reveal: revealView(s),
    players: ps.map((p) => ({
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart, inner: p.inner || 0,
      visits: p.visits, newcomer: p.newcomer,
      keep: p.keep, keepDone: p.keepDone,
      lastLoss: p.losses[s.reveal.idx] || 0,
      q20: p.q20, want: p.want,
      hasBurden: p.hasBurden,
      receivedVerse: p.receivedVerse, cardDone: p.cardDone, adjust: p.adjust,
    })),
    stats: {
      count: ps.length,
      reconnected: sc.length,
      newcomers: ps.filter((p) => p.newcomer).length,
      keptDone: ps.filter((p) => p.keepDone).length,
      keepCounts,
      answeredQ20: ps.filter((p) => p.q20 !== null).length,
      q20Counts: q20Counts(s),
      outerAvg: outers.length ? Math.round(outers.reduce((a, b) => a + b, 0) / outers.length) : null,
      startAvg: starts.length ? Math.round(starts.reduce((a, b) => a + b, 0) / starts.length) : null,
      innerAvg: ps.length ? Math.round(ps.reduce((a, b) => a + (b.inner || 0), 0) / ps.length) : 0,
      // 結算頁：每個人的三樣三十年後各剩幾成，掉最多的排前面
      survive: ps.map((p) => ({
        name: p.name,
        drop: (p.outer != null && p.outerStart != null) ? p.outerStart - p.outer : 0,
        outer: p.outer,
        items: survivalOf(s, p),
      })).sort((a, b) => b.drop - a.drop),
      hardestHit: (() => {
        const withDrop = sc.map((p) => ({ name: p.name, drop: p.outerStart - p.outer }))
          .sort((a, b) => b.drop - a.drop);
        return withDrop.length && withDrop[0].drop > 0 ? withDrop[0] : null;
      })(),
      wants: ps.filter((p) => p.want).map((p) => p.name),
      versesReceived: ps.filter((p) => p.receivedVerse).length,
      cardsDone: ps.filter((p) => p.cardDone).length,
      burdens: ps.filter((p) => p.hasBurden).length,
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
    assets: assetMenu(),
    keepCount: KEEP_COUNT,
    locked: LOCKED,
    mystery: MYSTERY,
    named: s.named,
    mysteryOpen: s.mysteryOpen,
    keepOpen: keepOpen(s),
    reveal: revealView(s),
    playerCount: alive(s).length,
    // 手機在等別人的時候要看得到進度。只有人數，不含任何人的答案。
    reconnected: alive(s).filter((x) => x.outer !== null).length,
    keptDone: alive(s).filter((x) => x.keepDone).length,
    answeredQ20: alive(s).filter((x) => x.q20 !== null).length,
  };
  if (!p) return { ...base, me: null };
  return {
    ...base,
    me: {
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart,
      inner: p.inner || 0, innerCap: INNER_CAP,
      visits: p.visits, newcomer: p.newcomer,
      keep: p.keep, keepDone: p.keepDone,
      survive: survivalOf(s, p),
      lastLoss: p.losses[s.reveal.idx] || 0,
      totalLoss: p.losses.reduce((a, b) => a + (b || 0), 0),
      q20: p.q20, want: p.want,
      hasBurden: p.hasBurden,
      receivedVerse: p.receivedVerse, cardDone: p.cardDone,
    },
  };
}

// 第二關沒有計時的東西 —— 房間的鬧鐘只用在清空。
