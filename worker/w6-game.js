// 第六關「十字架的勝利」的規則。純函式，不碰網路也不碰儲存。
//
// 這一關完全不依賴前五關 —— 上一次沒來的人不會少玩到任何東西。
// 接過來的只有卡片上的兩條線。**第三關起第一次來的人，幸福根基直接給 15。**
//
// 流程：挑一塊 → 抽一張（−3）→ 統計 → 大魔王登場 → 選職業 →
// **靠自己打五回合（血條掉了又補滿）→ 全員倒下** → 十字架 → 復活 →
// 領受經文（幸福根基 +10）＋領受復活 → **同樣的招式，這一次打得動**（傷害 ×12，它不再補血）→
// **全場一起出手，擊敗大魔王，幸福指數 +15。**
//
// ⚠️ **第二階段的傷害是復活的大能給的，不是他練出來的。**
// ⚠️ **領受復活不是門檻** —— 沒按的人照樣打得動，全場照樣一起贏。
//     「信了才有能力」是這套設計明文避開的東西。
import {
  GOOD, CHASE, ASPECTS, CARDS, COPE, PICK, DRAW, CARD_LOSS, TALLY, BOSS,
  CLASSES, JOB, IDLE, FIGHT, LOST, CROSS, POWER, VERSE, WIN, BEAT, VICTORY, BLESS,
} from './w6-data.js';

// 幸福根基的規則七關都一樣。上限 95 不是 100 —— 你自己填不滿。
export const INNER_CAP = 95;
export const INNER_PER_WEEK = 15;
export const INNER_VERSE = 10;
export const INNER_PRAYER = 5;
// 第三關起第一次來的新朋友直接給 15。
export const NEWCOMER_INNER = 15;

export const PHASES = [
  { id: 'lobby',     tag: '入場',     title: '掃碼進場' },
  { id: 'reconnect', tag: '接關',     title: '輸入幸福指數' },
  // 開場的伏筆：右邊那一格蓋著，最後一頁才翻開。
  { id: 'good',      tag: '信息',     title: '什麼才是「好」？' },
  { id: 'chase',     tag: '信息',     title: '我們追求的方向，不能滿足生命真正的需要' },
  // 第 5 頁挑一塊＋抽一張，第 6 頁一翻過來就公布。
  { id: 'cards',     tag: '互動點 1', title: '有沒有哪件事讓你很有壓力？' },
  { id: 'draw',      tag: '公布',     title: '大家抽到的那一張' },
  { id: 'tally',     tag: '統計',     title: '最近讓你最累的是什麼？' },
  { id: 'bossIn',    tag: '過場',     title: '今晚的大魔王 · 勞苦重擔' },
  { id: 'job',       tag: '介紹',     title: '四個職業' },
  { id: 'fight',     tag: '主遊戲',   title: '靠自己打面對勞苦重擔（五回合）' },
  { id: 'lost',      tag: '結算頁',   title: '沒有人打得倒它' },
  { id: 'cross',     tag: '過場',     title: '十字架' },
  { id: 'verse',     tag: '經文',     title: '領受經文 ＋ 領受復活' },
  { id: 'win',       tag: '主遊戲',   title: '在生活中得勝' },
  // 最後一擊打完，同一頁直接換成「得勝的力量」—— 不另開一頁。
  { id: 'beat',      tag: '互動點 4', title: '最後一擊 · 得勝的力量' },
  { id: 'goodOpen',  tag: '揭曉',     title: '在耶穌基督裡的好' },
  { id: 'bless',     tag: '互動點 5', title: '得勝禱告' },
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
    cardsOpen: false,     // 抽的那一頁公布了沒（公布之後鎖住，那一刻才扣分）
    moves: [],            // 魔王的五招：[{ k: 面向, i: 第幾句 }]，從全場抽到的卡來
    hp: BOSS.hp,          // 魔王現在剩多少血
    fightRound: 0,        // 第一階段（五回合）
    fightOpen: [],
    winRound: 0,          // 第二階段（三回合）
    winOpen: [],
    crossStep: 0,         // 十字架：0–2（2 是復活的大能）
    beaten: false,        // 最後一擊打完了沒
    beatPaid: false,      // +15 只給一次
    beatForced: false,    // 有人手機沒電：主持人替大螢幕收尾（**不替任何人按**）
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
const classOf = (k) => CLASSES.find((c) => c.k === k) || null;
const cardText = (k, i) => (CARDS[k] || [])[i] || '';
const FIGHT_ROUNDS = FIGHT.rounds;
const WIN_ROUNDS = WIN.rounds;

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
    aspect: '',           // 他挑的那一塊
    pick: -1,             // 從那一塊抽到第幾句（他選不了）
    cardLoss: 0,          // 抽到那一句扣了多少（重來的時候要還原）
    acts: [],             // 第一階段五回合各做了什麼（true＝出手、false＝什麼都不做）
    winActs: [],          // 第二階段三回合
    fightLoss: 0,         // 第一階段總共掉了多少（重跑的時候要還原）
    revived: false,       // 按過「領受復活」沒（**不是門檻，只是儀式**）
    beat: false,          // 最後一擊按了沒
    beatGain: 0,
    hasBless: false,
    prayed: false,
    receivedVerse: false,
    cardDone: false,
    adjust: 0,
  };
  s.order.push(pid);
  return pid;
}

// ── 挑一塊＋抽一張（第 5 頁）→ 公布（第 6 頁）──────────────────────────
// 第 5 頁手機上挑完那一塊就直接抽；主持人在第 5 頁看到大家都抽好了才翻頁。
// **翻到第 6 頁就是公布**（不用再按），那一刻才扣分。抽到的人 −3，沒抽的人不動。
export function revealCards(s) {
  if (s.cardsOpen) return false;
  s.cardsOpen = true;
  alive(s).forEach((p) => {
    if (p.outer === null || !p.aspect || p.pick < 0) return;
    const before = p.outer;
    p.outer = clamp(p.outer - CARD_LOSS);
    p.cardLoss = before - p.outer;
  });
  buildMoves(s);
  return true;
}

// 重來：分數還原，那一塊、抽到的那一句、魔王的招式都清掉。
export function redealCards(s) {
  alive(s).forEach((p) => {
    if (p.cardLoss && p.outer !== null) p.outer = clamp(p.outer + p.cardLoss);
    p.cardLoss = 0;
    p.aspect = '';
    p.pick = -1;
  });
  s.cardsOpen = false;
  s.moves = [];
  // 重來要回到第 5 頁重新挑、重新抽
  const back = PHASES.findIndex((ph) => ph.id === 'cards');
  if (back >= 0) s.phaseIdx = back;
}

// ── 魔王的五招 ──────────────────────────────────────────────────────────
// **就是全場抽到的那幾句。** 人不夠五個就補（補沒被抽走的那些）。
function buildMoves(s) {
  const out = [];
  const seen = {};
  alive(s).forEach((p) => {
    if (!p.aspect || p.pick < 0) return;
    const key = p.aspect + ':' + p.pick;
    if (seen[key]) return;
    seen[key] = true;
    out.push({ k: p.aspect, i: p.pick });
  });
  // 洗一下，不要照進場順序
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = out[i]; out[i] = out[j]; out[j] = t;
  }
  const pool = [];
  ASPECTS.forEach((a) => (CARDS[a.k] || []).forEach((_, i) => {
    if (!seen[a.k + ':' + i]) pool.push({ k: a.k, i });
  }));
  while (out.length < FIGHT_ROUNDS && pool.length) {
    const at = Math.floor(Math.random() * pool.length);
    out.push(pool.splice(at, 1)[0]);
  }
  s.moves = out.slice(0, FIGHT_ROUNDS);
}

const movesOf = (s) => (arr(s.moves).length ? s.moves : [{ k: 'work', i: 0 }]);
const moveAt = (s, r) => movesOf(s)[r % movesOf(s).length];

// ── 打鬥（兩個階段共用）──────────────────────────────────────────────────
const openList = (s, key) => (Array.isArray(s[key]) ? s[key] : (s[key] = []));
const shown = (s, key, r) => openList(s, key).indexOf(r) >= 0;
// 每一回合選的：職業代號（knight／mage／tank／villager）或 'idle'（什麼都不做）
const choiceOf = (p, r, key) => arr(p[key])[r];
const actOf = (p, r, key) => classOf(choiceOf(p, r, key));

// 這一回合全場打掉多少（職業的傷害；什麼都不做是 0）
function damageOf(s, r, key, boost) {
  return alive(s).reduce((sum, p) => {
    const c = actOf(p, r, key);
    return sum + (c ? c.dmg : 0) * (boost || 1);
  }, 0);
}

// ── 第一階段：靠自己打（五回合）─────────────────────────────────────────
// 一顆按鈕按到底：還沒公布就公布，公布過了才換下一回合。
// **公布的時候血條真的會掉，換下一回合的時候它補滿。**
export function revealFight(s) {
  const r = s.fightRound;
  if (r >= FIGHT_ROUNDS || shown(s, 'fightOpen', r)) return false;
  s.fightOpen.push(r);
  alive(s).forEach((p) => {
    if (p.outer === null) return;
    const c = actOf(p, r, 'acts');
    // 出手照那一回合選的職業扣；什麼都不做（或沒選）也扣 —— **問題不會自己走。**
    const loss = c ? c.loss : IDLE.loss;
    const before = p.outer;
    p.outer = clamp(p.outer - loss);
    p.fightLoss = (p.fightLoss || 0) + (before - p.outer);
  });
  s.hp = Math.max(1, BOSS.hp - damageOf(s, r, 'acts', 1));
  return true;
}

export function fightStep(s) {
  if (!shown(s, 'fightOpen', s.fightRound)) return revealFight(s);
  if (s.fightRound < FIGHT_ROUNDS - 1) {
    s.fightRound += 1;
    s.hp = BOSS.hp;     // **補滿血。** 這一段全部的重量就在這一行。
    return true;
  }
  return false;
}

export function fightPrev(s) {
  if (s.fightRound <= 0) return false;
  s.fightRound -= 1;
  s.hp = BOSS.hp;
  return true;
}

export function fightRestart(s) {
  alive(s).forEach((p) => {
    if (p.fightLoss && p.outer !== null) p.outer = clamp(p.outer + p.fightLoss);
    p.fightLoss = 0;
    p.acts = [];
  });
  s.fightRound = 0;
  s.fightOpen = [];
  s.hp = BOSS.hp;
}

// ── 十字架 ──────────────────────────────────────────────────────────────
// 三段一段一段走。**這一段一分都不加** —— 加分在最後那一擊。
export const CROSS_LAST = 2;
export function crossNext(s) {
  if (s.crossStep >= CROSS_LAST) return false;
  s.crossStep += 1;
  return true;
}

export function crossBack(s) {
  if (s.crossStep <= 0) return false;
  s.crossStep -= 1;
  return true;
}

// ── 第二階段：在生活中得勝（三回合）─────────────────────────────────────
// 一樣的職業、一樣的招式、一樣的那幾件事 —— 可是傷害 ×12，而且**它補不回來**。
// **這一段不扣任何人的分。**
export function revealWin(s) {
  const r = s.winRound;
  if (r >= WIN_ROUNDS || shown(s, 'winOpen', r)) return false;
  s.winOpen.push(r);
  // 打到剩一點點就好 —— **最後那一擊留給全場一起出手。**
  const floor = Math.round(BOSS.hp * 0.08);
  s.hp = Math.max(floor, s.hp - damageOf(s, r, 'winActs', WIN.boost));
  return true;
}

export function winStep(s) {
  if (!shown(s, 'winOpen', s.winRound)) return revealWin(s);
  if (s.winRound < WIN_ROUNDS - 1) { s.winRound += 1; return true; }
  return false;
}

export function winPrev(s) {
  if (s.winRound <= 0) return false;
  s.winRound -= 1;
  return true;
}

export function winRestart(s) {
  alive(s).forEach((p) => { p.winActs = []; });
  s.winRound = 0;
  s.winOpen = [];
  s.hp = BOSS.hp;
}

// ── 最後一擊 ────────────────────────────────────────────────────────────
// 全場都出手了（或主持人按了「全場出手」），魔王倒下，**全場幸福指數 +15**。
function beatDone(s) {
  const ps = alive(s);
  return !!s.beatForced || (ps.length > 0 && ps.every((p) => p.beat));
}

function settleBeat(s) {
  if (!beatDone(s) || s.beatPaid) return;
  s.beatPaid = true;
  s.beaten = true;
  s.hp = 0;
  alive(s).forEach((p) => {
    if (p.outer === null) return;
    const before = p.outer;
    p.outer = clamp(p.outer + BEAT.gain);
    p.beatGain = p.outer - before;
  });
}

// ── 階段切換 ────────────────────────────────────────────────────────────
export function enterPhase(s, idx) {
  s.phaseIdx = Math.max(0, Math.min(PHASES.length - 1, idx));
  // 走到第二階段之前血條是滿的 —— 第一階段最後停在「它補滿了」。
  if (phaseId(s) === 'win' && !arr(s.winOpen).length) s.hp = BOSS.hp;
  // 翻到「抽到的那一張」那一頁就是公布。只公布一次，往回翻再翻過來不會再扣。
  if (phaseId(s) === 'draw') revealCards(s);
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
    // 挑一塊。挑完同一頁就抽。**抽了之後就不能換一塊。**
    case 'aspect': {
      if (phaseId(s) !== 'cards' || s.cardsOpen || p.pick >= 0) break;
      const k = String(msg.k || '');
      // 空字串＝手機上按了「換一塊」。**不能當成無效值擋掉。**
      if (k && !ASPECTS.some((a) => a.k === k)) break;
      if (p.aspect !== k) { p.aspect = k; p.pick = -1; }
      break;
    }
    // 抽。**抽到哪一句不是他選的** —— 點哪一張都一樣，伺服器隨機發。
    case 'draw': {
      if (phaseId(s) !== 'cards' || s.cardsOpen) break;
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
    // 這一回合選哪一個職業（或什麼都不做）。第一階段和第二階段共用這一個動作。
    // **每一回合都可以換，公布之前都可以改。**
    case 'act': {
      const id = phaseId(s);
      const key = id === 'fight' ? 'acts' : id === 'win' ? 'winActs' : '';
      if (!key) break;
      const r = id === 'fight' ? s.fightRound : s.winRound;
      if (Math.floor(Number(msg.round)) !== r) break;
      if (shown(s, id === 'fight' ? 'fightOpen' : 'winOpen', r)) break;
      const k = String(msg.k || '');
      if (k !== 'idle' && !classOf(k)) break;
      const rows = arr(p[key]).slice();
      rows[r] = k;
      p[key] = rows;
      break;
    }
    case 'verse':
      if (!p.receivedVerse) { p.receivedVerse = true; grow(p, INNER_VERSE); }
      break;
    // 領受復活。**不加分、不是門檻** —— 沒按的人第二階段照樣打得動。
    case 'revive':
      p.revived = true;
      break;
    // 最後一擊。全場都按了，魔王倒下，**全場 +15**。
    case 'beat': {
      if (phaseId(s) !== 'beat' || s.beatPaid) break;
      p.beat = true;
      settleBeat(s);
      break;
    }
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
    case 'fightStep': fightStep(s); return null;
    case 'fightPrev': fightPrev(s); return null;
    case 'fightRestart': fightRestart(s); return null;
    case 'crossNext': crossNext(s); return null;
    case 'crossBack': crossBack(s); return null;
    case 'winStep': winStep(s); return null;
    case 'winPrev': winPrev(s); return null;
    case 'winRestart': winRestart(s); return null;
    // 有人手機沒電：讓大螢幕收得了尾。**不替任何人按手機。**
    case 'beatAll': s.beatForced = true; settleBeat(s); return null;
    // 最後：翻開開場那張蓋著的卡。再按一次蓋回去。
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
function cardsView(s) {
  const ps = alive(s);
  const done = ps.filter((p) => p.aspect && p.pick >= 0);
  return {
    open: !!s.cardsOpen,
    chosen: ps.filter((p) => !!p.aspect).length,
    picked: done.length,
    // 公布之後大螢幕上翻出每個人抽到的那一句（＋名字）
    taken: s.cardsOpen
      ? done.map((p) => ({
        name: p.name, aspect: aspectOf(p.aspect).t, k: p.aspect, text: cardText(p.aspect, p.pick),
        loss: p.cardLoss || 0,
      }))
      : [],
  };
}

// 統計：照他自己挑的那一塊算，**只有人數，沒有名字**。
function tallyView(s) {
  const ps = alive(s);
  const rows = ASPECTS.map((a, k) => {
    const picks = ps.filter((p) => p.aspect === a.k && p.pick >= 0);
    const texts = [];
    picks.forEach((p) => {
      const t = cardText(p.aspect, p.pick);
      if (t && texts.indexOf(t) < 0) texts.push(t);
    });
    return { k: a.k, t: a.t, n: picks.length, texts, order: k };
  });
  const max = rows.reduce((m, r) => Math.max(m, r.n), 0);
  rows.sort((a, b) => (b.n - a.n) || (a.order - b.order));
  return { rows, max: Math.max(max, 1) };
}

// 魔王的五招（**就是他們自己抽到的那幾句**）
function movesView(s) {
  return movesOf(s).map((m) => ({ aspect: aspectOf(m.k).t, k: m.k, text: cardText(m.k, m.i) }));
}

// 打鬥（兩個階段共用一個視圖）
function battleView(s, id) {
  const ps = alive(s);
  const isWin = id === 'win';
  const key = isWin ? 'winActs' : 'acts';
  const openKey = isWin ? 'winOpen' : 'fightOpen';
  const r = isWin ? s.winRound : s.fightRound;
  const total = isWin ? WIN_ROUNDS : FIGHT_ROUNDS;
  const open = shown(s, openKey, r);
  const m = moveAt(s, r);
  return {
    round: r, total, revealed: open,
    aspect: aspectOf(m.k).t, attack: cardText(m.k, m.i),
    acted: ps.filter((p) => arr(p[key])[r] !== undefined).length,
    went: ps.filter((p) => actOf(p, r, key)).length,
    idle: ps.filter((p) => choiceOf(p, r, key) === 'idle').length,
    dmg: open ? damageOf(s, r, key, isWin ? WIN.boost : 1) : 0,
    hp: s.hp,
    maxHp: BOSS.hp,
    done: openList(s, openKey).length >= total,
    // 公布之後才給：每一個職業代表什麼、這一回合幾個人選
    byJob: open
      ? CLASSES.map((c) => ({
        k: c.k, t: c.t, act: c.act, loss: c.loss, art: c.art,
        how: ((COPE[m.k] || [])[m.i] || {})[c.k] || c.d,
        n: ps.filter((p) => choiceOf(p, r, key) === c.k).length,
        dmg: c.dmg * (isWin ? WIN.boost : 1),
      }))
      : [],
  };
}

function beatView(s) {
  const ps = alive(s);
  return {
    hit: ps.filter((p) => p.beat).length,
    total: ps.length,
    done: !!s.beaten,
    hp: s.hp,
  };
}

function common(s) {
  return {
    week: 6,
    phase: PHASES[s.phaseIdx],
    phaseIdx: s.phaseIdx,
    good: GOOD,
    chase: CHASE,
    aspects: ASPECTS,
    pickInfo: PICK,
    drawInfo: DRAW,
    cardsNow: cardsView(s),
    tally: TALLY,
    tallyNow: tallyView(s),
    boss: BOSS,
    bossMoves: movesView(s),
    classes: CLASSES,
    jobInfo: JOB,
    idle: IDLE,
    fight: FIGHT,
    fightNow: battleView(s, 'fight'),
    lost: LOST,
    cross: CROSS,
    crossStep: Math.min(s.crossStep || 0, CROSS_LAST),
    power: POWER,
    verse: VERSE,
    winInfo: WIN,
    winNow: battleView(s, 'win'),
    beatInfo: BEAT,
    beatNow: beatView(s),
    victory: VICTORY,
    bless: BLESS,
    hp: s.hp,
  };
}

export function hostView(s, roomCode) {
  const ps = alive(s);
  const sc = scored(s);
  const outers = sc.map((p) => p.outer);
  const starts = sc.map((p) => p.outerStart);
  const id = phaseId(s);
  const key = id === 'win' ? 'winActs' : 'acts';
  const r = id === 'win' ? s.winRound : s.fightRound;

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
      acted: arr(p[key])[r] !== undefined,
      revived: !!p.revived,
      beat: !!p.beat,
      hasBless: !!p.hasBless, prayed: !!p.prayed,
      receivedVerse: !!p.receivedVerse, cardDone: !!p.cardDone, adjust: p.adjust || 0,
    })),
    stats: {
      count: ps.length,
      reconnected: sc.length,
      newcomers: ps.filter((p) => p.newcomer).length,
      chose: ps.filter((p) => !!p.aspect).length,
      picked: ps.filter((p) => !!p.aspect && p.pick >= 0).length,
      acted: ps.filter((p) => arr(p[key])[r] !== undefined).length,
      revived: ps.filter((p) => p.revived).length,
      beat: ps.filter((p) => p.beat).length,
      outerAvg: outers.length ? Math.round(outers.reduce((a, b) => a + b, 0) / outers.length) : null,
      startAvg: starts.length ? Math.round(starts.reduce((a, b) => a + b, 0) / starts.length) : null,
      innerAvg: ps.length ? Math.round(ps.reduce((a, b) => a + (b.inner || 0), 0) / ps.length) : 0,
      innerStartAvg: sc.length ? Math.round(sc.reduce((a, b) => a + (b.innerStart || 0), 0) / sc.length) : null,
      versesReceived: ps.filter((p) => p.receivedVerse).length,
      cardsDone: ps.filter((p) => p.cardDone).length,
      // 「已寫下」＝按過那顆按鈕的人。什麼都沒寫也算 —— 你等的就是那顆按鈕。
      blessed: ps.filter((p) => p.prayed).length,
      fightLoss: ps.length ? Math.round(ps.reduce((a, b) => a + (b.fightLoss || 0), 0) / ps.length) : 0,
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
    reconnected: alive(s).filter((x) => x.outer !== null).length,
  };
  if (!p) return { ...base, me: null };
  return {
    ...base,
    me: {
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart,
      inner: p.inner || 0, innerCap: INNER_CAP,
      visits: p.visits, newcomer: p.newcomer,
      aspect: p.aspect || '',
      aspectName: p.aspect ? aspectOf(p.aspect).t : '',
      // 那一塊有幾張卡（蓋著的時候手機要畫幾張），**內容抽到才給**。
      deck: p.aspect ? (CARDS[p.aspect] || []).length : 0,
      drawn: p.pick >= 0 ? { aspect: aspectOf(p.aspect).t, k: p.aspect, text: cardText(p.aspect, p.pick) } : null,
      pick: p.pick,
      cardLoss: p.cardLoss || 0,
      choice: arr(p.acts)[s.fightRound],
      winChoice: arr(p.winActs)[s.winRound],
      fightLoss: p.fightLoss || 0,
      revived: !!p.revived,
      beat: !!p.beat,
      beatGain: p.beatGain || 0,
      hasBless: !!p.hasBless, prayed: !!p.prayed,
      receivedVerse: !!p.receivedVerse, cardDone: !!p.cardDone,
    },
  };
}

// 第六關沒有計時的東西 —— 房間的鬧鐘只用在清空。
