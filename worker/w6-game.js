// 第六關「十字架的勝利」的規則。純函式，不碰網路也不碰儲存。
//
// 這一關完全不依賴前五關 —— 上一次沒來的人不會少玩到任何東西。
// 接過來的只有卡片上的兩條線。**第三關起第一次來的人，幸福根基直接給 15。**
//
// 一句話講完這一關：挑一塊、從那一塊抽一張困難（−3）→ 統計前三名合體成大魔王 →
// 靠自己打三回合（每招 −2，**魔王每回合都補滿血**）→ 十字架：最後一擊被一個人擋下來，
// 三天之後血條歸零，**全場 +10（沒有人按任何東西）** → 苦難照樣來，但這一次全場互相扛。
//
// ⚠️ **那 +10 不准綁在按鈕上。** 一綁上按鈕就變成用分數換恩典（第二關拆寶箱同一條線）。
// ⚠️ **幫別人禱告的人自己不加分。** 按的人也加分，全場就會搶著按。
import {
  GOOD, CHASE, ASPECTS, CARDS, PICK, DRAW, CARD_LOSS, TALLY, BOSS,
  MOVES, FIGHT_LOSS, ATTACKS, FIGHT, FIGHT_END, CROSS, POWER, VERSE,
  TOGETHER, WON, BLESS,
} from './w6-data.js';

// 幸福根基的規則七關都一樣。上限 95 不是 100 —— 你自己填不滿。
export const INNER_CAP = 95;
export const INNER_PER_WEEK = 15;
export const INNER_VERSE = 10;
export const INNER_PRAYER = 5;
// 第三關起第一次來的新朋友直接給 15。
export const NEWCOMER_INNER = 15;

export const ROUNDS = 3;          // 兩個回合制的遊戲都是三回合

export const PHASES = [
  { id: 'lobby',     tag: '入場',     title: '掃碼進場' },
  { id: 'reconnect', tag: '接關',     title: '輸入幸福指數' },
  // 開場的伏筆：右邊那一格蓋著，第 13 頁才翻開。
  { id: 'good',      tag: '信息',     title: '什麼才是「好」？' },
  { id: 'chase',     tag: '信息',     title: '我們追求的方向，不能滿足生命真正的需要' },
  // 挑分類和抽卡**分兩頁**：先全場挑完那一塊，翻頁才抽。
  { id: 'cards',     tag: '互動點 1', title: '你現在扛的是哪一塊？' },
  { id: 'draw',      tag: '互動點 1', title: '抽一張' },
  { id: 'boss',      tag: '統計',     title: '最近讓你最累的是什麼？' },
  { id: 'fight',     tag: '互動點 2', title: '靠自己打' },
  { id: 'fightEnd',  tag: '結算頁',   title: '勞苦重擔的不幸人生' },
  { id: 'cross',     tag: '過場',     title: '十字架' },
  { id: 'power',     tag: '信息',     title: '復活的大能成為我們得勝的能力' },
  { id: 'verse',     tag: '經文',     title: '領受經文' },
  { id: 'together',  tag: '互動點 3', title: '在生活中得勝' },
  { id: 'won',       tag: '結算頁',   title: '這一仗，全場一起打贏' },
  { id: 'bless',     tag: '互動點 4', title: '得勝禱告' },
  { id: 'card',      tag: '週卡',     title: '儲存模擬回憶' },
  { id: 'end',       tag: '預告',     title: '下週預告' },
];

const phaseId = (s) => (PHASES[s.phaseIdx] || PHASES[0]).id;

export function createState() {
  return {
    week: 6,
    phaseIdx: 0,
    players: {},
    order: [],
    cardsOpen: false,     // 那一頁公布了沒（公布之後鎖住，那一刻才扣分）
    bossMerged: false,    // 前三名合體成魔王了沒
    bossPicks: [],        // 魔王的三個面向（合體之後固定）
    fightRound: 0,
    fightOpen: [],        // 第一回合哪幾回合公布了
    crossStep: 0,         // 十字架：0–3
    crossPaid: false,     // 全場 +10 只給一次
    tRound: 0,            // 第二回合現在第幾回合
    tStruck: [],          // 哪幾回合已經出招了
    hits: [],             // [{ round, pid, aspect, text, prays: [pid], back: true }]
    wonForced: false,     // 有人手機沒電：主持人把能量條補滿（**不動任何人的分**）
    goodOpen: false,      // 第 13 頁翻開「在耶穌基督裡的好」
    seq: 0,
  };
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const alive = (s) => s.order.map((id) => s.players[id]).filter(Boolean);
const scored = (s) => alive(s).filter((p) => p.outer !== null);
// 幸福根基只會漲。沒有任何事件扣得到它 —— 那是它唯一的意義。
const grow = (p, n) => { p.inner = Math.min(INNER_CAP, (p.inner || 0) + n); };
// 防呆：舊版規則建立的房間還會在 DO 裡活六小時，別讓它們把房間打掛。
const arr = (v) => (Array.isArray(v) ? v : []);
const aspectOf = (k) => ASPECTS.find((a) => a.k === k) || ASPECTS[0];
const cardText = (k, i) => (CARDS[k] || [])[i] || '';

export function addPlayer(s, name) {
  s.seq += 1;
  const pid = 'p' + s.seq + Math.random().toString(36).slice(2, 6);
  s.players[pid] = {
    pid,
    name: String(name || '').slice(0, 12) || '朋友',
    joinedAt: Date.now(),
    outer: null,          // 幸福指數（接關輸入）
    outerStart: null,     // 今晚一進來的值，卡片上要印「上週 XX」
    inner: 0,             // 幸福根基
    innerStart: 0,
    visits: 0,
    newcomer: false,
    aspect: '',           // 他自己挑的那一個面向（財務／工作／婚姻／感情／家庭／健康）
    pick: -1,             // 從那一塊裡**抽**到的是第幾句（0–3）—— 他選不了
    cardLoss: 0,          // 挑那一句扣了多少（重挑的時候要還原）
    moves: [],            // 第一回合三回合各出了什麼招
    fightLoss: 0,         // 第一回合總共掉了多少（重跑的時候要還原）
    crossGain: 0,         // 十字架那一刻拿到多少（往回跳不退分，這裡只做紀錄）
    hasBless: false,      // 「我現在正在打的那一仗」留在他自己的手機上
    prayed: false,
    receivedVerse: false,
    cardDone: false,
    adjust: 0,
  };
  s.order.push(pid);
  return pid;
}

// ── 挑一塊（第 5 頁）→ 抽一張（第 6 頁）────────────────────────────────
// 公布的那一刻才扣分。**抽到的人 −3，沒抽的人不動。**
export function revealCards(s) {
  if (s.cardsOpen) return false;
  s.cardsOpen = true;
  alive(s).forEach((p) => {
    if (p.outer === null || !p.aspect || p.pick < 0) return;
    const before = p.outer;
    p.outer = clamp(p.outer - CARD_LOSS);
    p.cardLoss = before - p.outer;
  });
  return true;
}

// 重挑：分數還原，剛剛挑的那一塊和抽到的那一句都清掉。
export function redealCards(s) {
  alive(s).forEach((p) => {
    if (p.cardLoss && p.outer !== null) p.outer = clamp(p.outer + p.cardLoss);
    p.cardLoss = 0;
    p.aspect = '';
    p.pick = -1;
  });
  s.cardsOpen = false;
  s.bossMerged = false;
  s.bossPicks = [];
}

// 最近讓你最累的是什麼：**只算人數，不印名字**。
function tallyRows(s) {
  const ps = alive(s);
  return ASPECTS.map((a, k) => {
    const picks = ps.filter((p) => p.aspect === a.k && p.pick >= 0);
    // 被挑走的那幾句的原文（**不掛名字**）—— 主持人念那一句就是最好的接話點
    const texts = [];
    picks.forEach((p) => {
      const t = cardText(p.aspect, p.pick);
      if (t && texts.indexOf(t) < 0) texts.push(t);
    });
    return { k: a.k, t: a.t, n: picks.length, texts, order: k };
  });
}

// 合體：前三名變成魔王的三個面向（同票照 ASPECTS 的順序，不滿三個就照順序補）。
export function mergeBoss(s) {
  if (s.bossMerged) return false;
  const rows = tallyRows(s).slice().sort((a, b) => (b.n - a.n) || (a.order - b.order));
  const picks = rows.filter((r) => r.n > 0).slice(0, 3).map((r) => r.k);
  ASPECTS.forEach((a) => { if (picks.length < 3 && picks.indexOf(a.k) < 0) picks.push(a.k); });
  s.bossPicks = picks;
  s.bossMerged = true;
  return true;
}

const bossPicks = (s) => (arr(s.bossPicks).length ? s.bossPicks : ASPECTS.slice(0, 3).map((a) => a.k));
const roundAspect = (s, r) => bossPicks(s)[Math.min(r, 2)];

// ── 第一回合：靠自己打 ──────────────────────────────────────────────────
// 一顆按鈕按到底：還沒公布就公布，公布過了才換下一回合。
const fightOpenList = (s) => (Array.isArray(s.fightOpen) ? s.fightOpen : (s.fightOpen = []));
const fightShown = (s, r) => fightOpenList(s).indexOf(r) >= 0;
const moveOf = (p, r) => {
  const v = arr(p.moves)[r];
  return v >= 0 && v < MOVES.length ? v : -1;
};

export function revealFight(s) {
  const r = s.fightRound;
  if (r >= ROUNDS || fightShown(s, r)) return false;
  s.fightOpen.push(r);
  alive(s).forEach((p) => {
    if (p.outer === null || moveOf(p, r) < 0) return;
    const before = p.outer;
    p.outer = clamp(p.outer - FIGHT_LOSS);
    p.fightLoss = (p.fightLoss || 0) + (before - p.outer);
  });
  return true;
}

export function fightStep(s) {
  if (!fightShown(s, s.fightRound)) return revealFight(s);
  if (s.fightRound < ROUNDS - 1) { s.fightRound += 1; return true; }
  return false;
}

export function fightPrev(s) {
  if (s.fightRound <= 0) return false;
  s.fightRound -= 1;
  return true;
}

export function fightRestart(s) {
  alive(s).forEach((p) => {
    if (p.fightLoss && p.outer !== null) p.outer = clamp(p.outer + p.fightLoss);
    p.fightLoss = 0;
    p.moves = [];
  });
  s.fightRound = 0;
  s.fightOpen = [];
}

// ── 十字架 ──────────────────────────────────────────────────────────────
// 四段一段一段走。**走到第 4 段那一秒，全場幸福指數 +10** —— 只加一次，往回跳不退分。
export function crossNext(s) {
  if (s.crossStep >= 3) return false;
  s.crossStep += 1;
  if (s.crossStep >= 3 && !s.crossPaid) {
    s.crossPaid = true;
    alive(s).forEach((p) => {
      if (p.outer === null) return;
      const before = p.outer;
      p.outer = clamp(p.outer + CROSS.gain);
      p.crossGain = p.outer - before;
    });
  }
  return true;
}

export function crossBack(s) {
  if (s.crossStep <= 0) return false;
  s.crossStep -= 1;
  return true;
}

// ── 第二回合：在生活中得勝 ───────────────────────────────────────────────
// 主持人按「出招」才抽人。**只抽在線的、整晚不重複**（人不夠才重複）。
const struckList = (s) => (Array.isArray(s.tStruck) ? s.tStruck : (s.tStruck = []));
const hitsOf = (s) => (Array.isArray(s.hits) ? s.hits : (s.hits = []));

function hitCount(n) { return n >= 10 ? 3 : n >= 6 ? 2 : 1; }

export function strike(s) {
  const r = s.tRound;
  if (r >= ROUNDS || struckList(s).indexOf(r) >= 0) return false;
  const ps = scored(s);
  if (!ps.length) return false;
  const already = {};
  hitsOf(s).forEach((h) => { already[h.pid] = true; });
  let pool = ps.filter((p) => !already[p.pid]);
  if (!pool.length) pool = ps.slice();
  const want = Math.min(hitCount(ps.length), pool.length);
  const k = roundAspect(s, r);
  const text = (ATTACKS[k] || {}).r2 || '';
  for (let i = 0; i < want; i++) {
    const at = Math.floor(Math.random() * pool.length);
    const p = pool.splice(at, 1)[0];
    const before = p.outer;
    p.outer = clamp(p.outer - TOGETHER.hitLoss);
    s.hits.push({ round: r, pid: p.pid, aspect: k, text, loss: before - p.outer, prays: [], back: 0 });
  }
  s.tStruck.push(r);
  return true;
}

export function togetherStep(s) {
  if (struckList(s).indexOf(s.tRound) < 0) return strike(s);
  if (s.tRound < ROUNDS - 1) { s.tRound += 1; return true; }
  return false;
}

export function togetherPrev(s) {
  if (s.tRound <= 0) return false;
  s.tRound -= 1;
  return true;
}

// 能量條：**一格一個被打中的人**，有人替他禱告那一格就亮。按了幾次不算。
function energy(s) {
  const hits = hitsOf(s);
  const planned = Math.max(hits.length, hitCount(scored(s).length) * ROUNDS);
  const lit = hits.filter((h) => h.prays.length > 0).length;
  const all = struckList(s).length >= ROUNDS && hits.length > 0 && lit >= hits.length;
  return { planned, lit, total: hits.length, done: !!s.wonForced || all };
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
    // 接關：幸福指數照卡片上打，第二條線也照卡片上打。
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
      // 第三關起：第一次來的人不掛 0，直接給 15。
      p.newcomer = p.inner === 0;
      if (p.newcomer) p.inner = NEWCOMER_INNER;
      p.innerStart = p.inner;
      break;
    }
    // 挑一塊（最近哪一塊最有壓力）。**這一頁只挑分類，不抽卡。**
    case 'aspect': {
      if (phaseId(s) !== 'cards') break;
      const k = String(msg.k || '');
      // 空字串＝手機上按了「換一塊」。**不能當成無效值擋掉。**
      if (k && !ASPECTS.some((a) => a.k === k)) break;
      if (p.aspect !== k) { p.aspect = k; p.pick = -1; }
      break;
    }
    // 下一頁才抽。**抽到哪一句不是他選的** —— 點哪一張都一樣，伺服器隨機發。
    // 同一塊裡盡量不要發到全場已經抽過的那一句（四句發完才可以重複）。
    case 'draw': {
      if (phaseId(s) !== 'draw' || s.cardsOpen) break;
      if (!p.aspect || p.pick >= 0) break;
      const all = (CARDS[p.aspect] || []).map((_, i) => i);
      if (!all.length) break;
      const used = {};
      alive(s).forEach((q) => { if (q !== p && q.aspect === p.aspect && q.pick >= 0) used[q.pick] = true; });
      const free = all.filter((i) => !used[i]);
      const from = free.length ? free : all;
      p.pick = from[Math.floor(Math.random() * from.length)];
      break;
    }
    // 靠自己打：只收現在這一回合，公布之前可以改。
    case 'move': {
      if (phaseId(s) !== 'fight') break;
      const r = Math.floor(Number(msg.round));
      if (r !== s.fightRound || fightShown(s, r)) break;
      const v = Math.floor(Number(msg.value));
      if (!(v >= 0 && v < MOVES.length)) break;
      const rows = arr(p.moves).slice();
      rows[r] = v;
      p.moves = rows;
      break;
    }
    // 我為你禱告。**按的人一分都不動**，被打中的那個人補回剛剛那一下（同一擊只補一次）。
    case 'pray': {
      if (phaseId(s) !== 'together') break;
      const i = Math.floor(Number(msg.idx));
      const h = hitsOf(s)[i];
      if (!h || h.pid === pid || h.prays.indexOf(pid) >= 0) break;
      h.prays.push(pid);
      if (h.prays.length === 1) {
        const q = s.players[h.pid];
        if (q && q.outer !== null) {
          const before = q.outer;
          q.outer = clamp(q.outer + TOGETHER.prayBack);
          h.back = q.outer - before;
        }
      }
      break;
    }
    case 'verse':
      if (!p.receivedVerse) { p.receivedVerse = true; grow(p, INNER_VERSE); }
      break;
    // 「我現在正在打的那一仗是＿＿」。那句話留在玩家自己的手機上，
    // 這裡只收「有沒有寫」這個布林值。**完全不上牆。**
    case 'bless': {
      p.hasBless = !!msg.has;
      // **什麼都沒寫也算。** 加分、跳「已存下」、按鈕變「更新」，
      // 三件事都看「他按了沒」（prayed），不看「他寫了沒」。
      if (!p.prayed) { p.prayed = true; grow(p, INNER_PRAYER); }
      break;
    }
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
    case 'cardsReveal': revealCards(s); return null;
    case 'cardsRedeal': redealCards(s); return null;
    case 'bossMerge': mergeBoss(s); return null;
    case 'fightStep': fightStep(s); return null;
    case 'fightPrev': fightPrev(s); return null;
    case 'fightRestart': fightRestart(s); return null;
    case 'crossNext': crossNext(s); return null;
    case 'crossBack': crossBack(s); return null;
    case 'togetherStep': togetherStep(s); return null;
    case 'togetherPrev': togetherPrev(s); return null;
    // 有人手機沒電、或人太少扛不過來：**只把能量條補滿**，不替任何人補分。
    case 'wonAll': s.wonForced = true; return null;
    // 第 13 頁：翻開「在耶穌基督裡的好」。再按一次蓋回去。
    case 'goodOpen': s.goodOpen = !s.goodOpen; return null;
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
// 你現在扛的是哪一塊。公布之前**不送任何人挑了什麼** —— 送出去等於把答案印在手機上。
function cardsView(s) {
  const ps = alive(s);
  const done = ps.filter((p) => p.aspect && p.pick >= 0);
  return {
    open: !!s.cardsOpen,
    // 第一頁等的是「幾人已挑一塊」，第二頁等的是「幾人已抽」。
    chosen: ps.filter((p) => !!p.aspect).length,
    picked: done.length,
    // 公布之後大螢幕上翻出每一句被挑走的話（＋挑的人的名字）
    taken: s.cardsOpen
      ? done.map((p) => ({
        name: p.name, aspect: aspectOf(p.aspect).t, k: p.aspect, text: cardText(p.aspect, p.pick),
      }))
      : [],
  };
}

// 統計 ＋ 合體。長條依人數排序，**只有人數，沒有名字**。
function bossView(s) {
  const rows = tallyRows(s).slice().sort((a, b) => (b.n - a.n) || (a.order - b.order));
  const max = rows.reduce((m, r) => Math.max(m, r.n), 0);
  return {
    rows,
    max: Math.max(max, 1),
    merged: !!s.bossMerged,
    picks: bossPicks(s).map((k) => ({ k, t: aspectOf(k).t })),
    hp: BOSS.hp,
  };
}

// 靠自己打。還沒公布就不送出結果。
function fightView(s) {
  const ps = alive(s);
  const r = s.fightRound;
  const open = fightShown(s, r);
  const k = roundAspect(s, r);
  const cols = MOVES.map((m, i) => {
    const who = ps.filter((p) => moveOf(p, r) === i);
    return {
      label: m.label, dmg: m.dmg,
      n: open ? who.length : null,
      names: open ? who.map((p) => p.name) : [],
      t: open ? m.t : '',
    };
  });
  const dmg = open
    ? ps.reduce((sum, p) => {
      const mi = moveOf(p, r);
      return sum + (mi >= 0 ? MOVES[mi].dmg : 0);
    }, 0)
    : 0;
  return {
    round: r, total: ROUNDS, revealed: open,
    aspect: aspectOf(k).t, aspectK: k,
    attack: (ATTACKS[k] || {}).r1 || '',
    cols,
    dmg: Math.min(dmg, BOSS.hp - 1),   // 打得到，但**永遠打不死** —— 回合一結束它就補滿
    hp: BOSS.hp,
    moved: ps.filter((p) => moveOf(p, r) >= 0).length,
    done: fightOpenList(s).length >= ROUNDS,
  };
}

// 結算：四招各出了幾次（**不印名字**）。
function fightEndView(s) {
  const ps = alive(s);
  return {
    cols: MOVES.map((m, i) => ({
      label: m.label,
      n: ps.reduce((sum, p) => sum + p.moves.filter((v) => v === i).length, 0),
    })),
    hp: BOSS.hp,
    lost: ps.reduce((sum, p) => sum + (p.fightLoss || 0), 0),
    avgLost: ps.length ? Math.round(ps.reduce((sum, p) => sum + (p.fightLoss || 0), 0) / ps.length) : 0,
  };
}

// 在生活中得勝。每一擊印名字、招式、**幾個人為他禱告**（不印誰按的）。
function togetherView(s) {
  const e = energy(s);
  return {
    round: s.tRound, total: ROUNDS,
    struck: struckList(s).indexOf(s.tRound) >= 0,
    aspect: aspectOf(roundAspect(s, s.tRound)).t,
    hits: hitsOf(s).map((h, i) => {
      const p = s.players[h.pid];
      return {
        i, round: h.round, name: p ? p.name : '—', pid: h.pid,
        aspect: aspectOf(h.aspect).t, text: h.text,
        prays: h.prays.length, back: h.back || 0,
      };
    }),
    energy: e,
  };
}

function common(s) {
  return {
    week: 6,
    phase: PHASES[s.phaseIdx],
    phaseIdx: s.phaseIdx,
    good: GOOD,
    goodOpen: !!s.goodOpen,
    chase: CHASE,
    aspects: ASPECTS,
    pickInfo: PICK,
    drawInfo: DRAW,
    cardsNow: cardsView(s),
    tally: TALLY,
    bossInfo: BOSS,
    bossNow: bossView(s),
    moves: MOVES.map((m) => ({ label: m.label, dmg: m.dmg })),
    fight: FIGHT,
    fightNow: fightView(s),
    fightEnd: FIGHT_END,
    fightEndNow: fightEndView(s),
    cross: CROSS,
    crossStep: s.crossStep || 0,
    power: POWER,
    verse: VERSE,
    together: TOGETHER,
    togetherNow: togetherView(s),
    won: WON,
    bless: BLESS,
  };
}

export function hostView(s, roomCode) {
  const ps = alive(s);
  const sc = scored(s);
  const outers = sc.map((p) => p.outer);
  const starts = sc.map((p) => p.outerStart);

  return {
    role: 'host',
    room: roomCode,
    phases: PHASES,
    ...common(s),
    players: ps.map((p) => ({
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart, inner: p.inner || 0,
      visits: p.visits, newcomer: p.newcomer,
      chose: !!p.aspect,
      picked: !!p.aspect && p.pick >= 0,
      moved: moveOf(p, s.fightRound) >= 0,
      hasBless: !!p.hasBless, prayed: !!p.prayed,
      receivedVerse: !!p.receivedVerse, cardDone: !!p.cardDone, adjust: p.adjust || 0,
    })),
    stats: {
      count: ps.length,
      reconnected: sc.length,
      newcomers: ps.filter((p) => p.newcomer).length,
      chose: ps.filter((p) => !!p.aspect).length,
      picked: ps.filter((p) => !!p.aspect && p.pick >= 0).length,
      moved: ps.filter((p) => moveOf(p, s.fightRound) >= 0).length,
      outerAvg: outers.length ? Math.round(outers.reduce((a, b) => a + b, 0) / outers.length) : null,
      startAvg: starts.length ? Math.round(starts.reduce((a, b) => a + b, 0) / starts.length) : null,
      innerAvg: ps.length ? Math.round(ps.reduce((a, b) => a + (b.inner || 0), 0) / ps.length) : 0,
      innerStartAvg: sc.length ? Math.round(sc.reduce((a, b) => a + (b.innerStart || 0), 0) / sc.length) : null,
      versesReceived: ps.filter((p) => p.receivedVerse).length,
      cardsDone: ps.filter((p) => p.cardDone).length,
      // 「已寫下」＝按過那顆按鈕的人。什麼都沒寫也算 —— 你等的就是那顆按鈕。
      blessed: ps.filter((p) => p.prayed).length,
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
    // 手機在等別人的時候要看得到進度。只有人數，不含任何人的答案。
    reconnected: alive(s).filter((x) => x.outer !== null).length,
  };
  if (!p) return { ...base, me: null };
  const r = s.fightRound;
  const hits = hitsOf(s);
  return {
    ...base,
    me: {
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart,
      inner: p.inner || 0, innerCap: INNER_CAP,
      visits: p.visits, newcomer: p.newcomer,
      // 他挑的那一個面向，還有那一類的四句話。**別人挑了什麼誰也看不到。**
      aspect: p.aspect || '',
      aspectName: p.aspect ? aspectOf(p.aspect).t : '',
      // 那一塊有幾張卡（蓋著的時候手機要畫幾張），**內容抽到才給**。
      deck: p.aspect ? (CARDS[p.aspect] || []).length : 0,
      drawn: p.pick >= 0 ? { aspect: aspectOf(p.aspect).t, k: p.aspect, text: cardText(p.aspect, p.pick) } : null,
      pick: p.pick,
      cardLoss: p.cardLoss || 0,
      move: moveOf(p, r),
      moveText: fightShown(s, r) && moveOf(p, r) >= 0 ? MOVES[moveOf(p, r)].t : '',
      fightLoss: p.fightLoss || 0,
      crossGain: p.crossGain || 0,
      // 這一回合被打中的人（他自己在不在裡面、他替誰按過）
      hits: hits.map((h, i) => ({
        i, round: h.round, me: h.pid === pid, name: (s.players[h.pid] || {}).name || '—',
        aspect: aspectOf(h.aspect).t, text: h.text,
        prays: h.prays.length, prayed: h.prays.indexOf(pid) >= 0, back: h.back || 0,
      })),
      hasBless: !!p.hasBless, prayed: !!p.prayed,
      receivedVerse: !!p.receivedVerse, cardDone: !!p.cardDone,
    },
  };
}

// 第六關沒有計時的東西 —— 房間的鬧鐘只用在清空。
