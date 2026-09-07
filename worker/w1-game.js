// 第一關「真幸福」的規則。純函式，不碰網路也不碰儲存 —— 房間（Durable Object）負責把它接上線。
import { LOTS, DECKS, QUESTION_CARDS, VERSE } from './w1-data.js';

export const BID_MS = 20000;    // 暗標一輪 20 秒
export const REVEAL_MS = 6000;  // 開標停留 6 秒

export const PHASES = [
  { id: 'lobby',            tag: '入場',     title: '掃碼進場' },
  { id: 'warmup',           tag: '互動點 1', title: '你現在有吃飽嗎？' },
  { id: 'warmup_result',    tag: '互動點 1', title: '全場分布' },
  { id: 'selfscore',        tag: '互動點 2', title: '你覺得現在自己幸福嗎？' },
  { id: 'selfscore_result', tag: '互動點 2', title: '全場分布' },
  { id: 'standards',        tag: '主持人',   title: '幸福的標準' },
  { id: 'auction_intro',    tag: '主遊戲',   title: '幸福拍賣會 · 規則' },
  { id: 'auction',          tag: '互動點 3', title: '幸福拍賣會' },
  { id: 'auction_result',   tag: '結算頁',   title: '看看大家買了什麼' },
  { id: 'event_draw',       tag: '互動點 4', title: '模擬生命中的事件' },
  { id: 'event_result',     tag: '互動點 4', title: '三種策略，三種摔法' },
  { id: 'testimony',        tag: '主持人',   title: '你的見證' },
  { id: 'verse',            tag: '經文',     title: '馬太福音 11:28' },
  { id: 'burden',           tag: '互動點 5', title: '禱告，順手把石頭收下來' },
  { id: 'card',             tag: '週卡',     title: '生成你的第一張卡片' },
  { id: 'end',              tag: '散會',     title: '第一關結束' },
];

// 點數只有幸福拍賣會用得到。規則頁（auction_intro）之前畫面上不出現點數 ——
// 玩家還沒聽到「每人 100 點」，先看到一個數字只會讓人以為現在就該花它。
const AUCTION_START = PHASES.findIndex((p) => p.id === 'auction_intro');
const pointsInPlay = (s) => s.phaseIdx >= AUCTION_START;

export function createState() {
  return {
    week: 1,
    phaseIdx: 0,
    players: {},
    order: [],
    lots: [],
    auction: { status: 'idle', idx: -1, deadline: 0, bids: {}, results: [], waitForHost: false },
    eventDealt: false,
    seq: 0,
  };
}

// 幸福根基的上限是 95，不是 100。七關全勤是 15×7 = 105，一定會撞到這道牆 ——
// 那是設計，不是 bug：最後那 5 分留給第八週，你自己填不滿。
export const INNER_CAP = 95;
export const INNER_VERSE = 10;   // 領受經文
export const INNER_PRAYER = 5;   // 收尾禱告

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
// 幸福根基只會漲。沒有任何事件扣得到它 —— 那是它唯一的意義。
// || 0 是為了舊版建立的房間：那時候 inner 還是 null，deploy 之後別讓它變 NaN。
const grow = (p, n) => { p.inner = Math.min(INNER_CAP, (p.inner || 0) + n); };
const alive = (s) => s.order.map((id) => s.players[id]).filter(Boolean);
const scored = (s) => alive(s).filter((p) => p.outer !== null);

function groupOf(p) {
  if (p.points <= 20) return 'A';
  if (p.points >= 60) return 'B';
  return 'C';
}

function shuffle(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function addPlayer(s, name) {
  s.seq += 1;
  const pid = 'p' + s.seq + Math.random().toString(36).slice(2, 6);
  s.players[pid] = {
    pid,
    name: String(name || '').slice(0, 12) || '朋友',
    joinedAt: Date.now(),
    warmup: null,
    outer: null,        // 幸福指數（自評後才有）
    outerStart: null,
    // 幸福根基。第一關畫面上的標籤只有「？？？」，但它有數字、它會動 ——
    // 領受經文 +10、收尾禱告 +5。第二關才正名。
    inner: 0,
    points: 100,        // 人生籌碼
    won: [],
    card: null,         // 模擬事件卡
    cardFlipped: false,
    metoo: false,       // 「這件事我真的遇過」
    hasBurden: false,   // 重擔內容留在玩家手機上，除非他願意公開
    burdenShared: '',   // 只有按下「我願意分享」才會有內容
    receivedVerse: false,
    cardDone: false,    // 生成週卡＝禱告收尾做完了
    adjust: 0,
  };
  s.order.push(pid);
  return pid;
}

// ── 拍賣 ────────────────────────────────────────────────────────────────
// 幾樣標的。刻意少於人數 —— 這樣「什麼都沒標到」才會真的發生在某些人身上。
function lotCountFor(n) {
  if (n >= 13) return 9;
  if (n >= 9) return 7;
  return 5;
}

function buildLots(s) {
  const count = lotCountFor(Math.max(alive(s).length, 1));
  s.lots = LOTS.slice(0, Math.min(Math.max(count, 2), LOTS.length));
}

export function startAuction(s, now) {
  buildLots(s);
  const wait = s.auction.waitForHost;
  alive(s).forEach((p) => { p.points = 100; p.won = []; });
  s.auction = { status: 'bidding', idx: 0, deadline: now + BID_MS, bids: {}, results: [], waitForHost: wait };
  return s.auction.deadline;
}

function resolveLot(s, now) {
  const a = s.auction;
  const lot = s.lots[a.idx];
  const entries = Object.entries(a.bids)
    .map(([pid, b]) => ({ pid, amount: b.amount, ts: b.ts }))
    .filter((b) => b.amount > 0);
  // 最高者得，同價時先出價者得
  entries.sort((x, y) => (y.amount - x.amount) || (x.ts - y.ts));
  const win = entries[0];
  const result = { lot, winner: null, amount: 0, bidders: entries.length };
  if (win) {
    const p = s.players[win.pid];
    if (p && win.amount <= p.points) {
      p.points -= win.amount;
      p.won.push({ lotId: lot.id, name: lot.name, price: win.amount, mystery: !!lot.mystery });
      result.winner = { pid: p.pid, name: p.name };
      result.amount = win.amount;
    }
  }
  a.results.push(result);
  a.status = 'reveal';
  a.deadline = a.waitForHost ? 0 : now + REVEAL_MS;
  return a.deadline || null;
}

function nextLot(s, now) {
  const a = s.auction;
  a.idx += 1;
  if (a.idx >= s.lots.length) { a.status = 'done'; a.deadline = 0; return null; }
  a.status = 'bidding';
  a.bids = {};
  a.deadline = now + BID_MS;
  return a.deadline;
}

// 鬧鐘到期時呼叫；回傳下一次要響的時間（沒有就 null）
export function advanceAuction(s, now) {
  const a = s.auction;
  if (a.status === 'bidding') return resolveLot(s, now);
  if (a.status === 'reveal') return nextLot(s, now);
  return null;
}

// ── 模擬生命中的事件 ──────────────────────────────────────────────────────────
export function dealEventCards(s) {
  const players = alive(s);
  const buckets = { A: [], B: [], C: [] };
  players.forEach((p) => {
    p.card = null; p.cardFlipped = false; p.metoo = false;
    buckets[groupOf(p)].push(p);
  });

  Object.keys(buckets).forEach((k) => {
    const group = shuffle(buckets[k]);
    if (!group.length) return;
    const deck = DECKS[k].cards;
    const hit = deck.find((c) => c.kind === 'hit');
    const rest = shuffle(deck.filter((c) => c.kind !== 'hit'));
    // 重擊卡保證發出：該組有人，就一定有人抽到
    group[0].card = { ...hit, group: k, groupLabel: DECKS[k].label };
    for (let i = 1; i < group.length; i++) {
      group[i].card = { ...rest[(i - 1) % rest.length], group: k, groupLabel: DECKS[k].label };
    }
  });

  // 問號卡：跨組隨機 1–2 張，不動到抽中重擊的人
  const pool = shuffle(players.filter((p) => p.card && p.card.kind !== 'hit'));
  const qn = Math.min(pool.length, players.length >= 8 ? 2 : 1);
  const qcards = shuffle(QUESTION_CARDS);
  for (let i = 0; i < qn; i++) {
    pool[i].card = { ...qcards[i % qcards.length], group: pool[i].card.group, groupLabel: pool[i].card.groupLabel };
  }
  s.eventDealt = true;
}

// ── 階段切換 ────────────────────────────────────────────────────────────
// 回傳下一次鬧鐘時間（沒有就 null）
export function enterPhase(s, idx, now) {
  s.phaseIdx = Math.max(0, Math.min(PHASES.length - 1, idx));
  const id = PHASES[s.phaseIdx].id;
  if (id === 'auction') {
    if (s.auction.status === 'idle' || s.auction.status === 'done') return startAuction(s, now);
    return s.auction.deadline || null;
  }
  if (id === 'event_draw' && !s.eventDealt) dealEventCards(s);
  return null;
}

// ── 玩家動作 ────────────────────────────────────────────────────────────
export function applyAction(s, pid, msg) {
  const p = s.players[pid];
  if (!p) return null;
  switch (msg.type) {
    case 'warmup':
      p.warmup = clamp(msg.value); break;
    case 'selfscore':
      p.outer = clamp(msg.value); p.outerStart = p.outer; break;
    case 'bid': {
      const a = s.auction;
      if (a.status === 'bidding') {
        const amount = Math.max(0, Math.min(p.points, Math.floor(Number(msg.value) || 0)));
        const prev = a.bids[pid];
        // 同價時先出價者得 → 只有改價才更新時間戳
        a.bids[pid] = { amount, ts: prev && prev.amount === amount ? prev.ts : Date.now() };
      }
      break;
    }
    case 'flip':
      if (p.card && !p.cardFlipped) {
        p.cardFlipped = true;
        if (p.outer !== null) p.outer = clamp(p.outer + p.card.delta);
      }
      break;
    case 'metoo': p.metoo = !p.metoo; break;
    // 這一關幸福根基只有這兩個入口，而且都只算一次
    case 'verse':
      if (!p.receivedVerse) { p.receivedVerse = true; grow(p, INNER_VERSE); }
      break;
    case 'card':
      if (!p.cardDone) { p.cardDone = true; grow(p, INNER_PRAYER); }
      break;
    // 重擔：文字留在玩家自己的手機上。這裡只收「有沒有寫」，
    // 以及他主動按下「我願意分享」時才送上來的那一句。
    case 'burden':
      p.hasBurden = !!msg.has;
      p.burdenShared = msg.share ? String(msg.text || '').slice(0, 120) : '';
      break;
    case 'rename': p.name = String(msg.name || '').slice(0, 12) || p.name; break;
  }
  return null;
}

// ── 主持人指令 ──────────────────────────────────────────────────────────
export function applyHost(s, msg, now) {
  switch (msg.cmd) {
    case 'next': return enterPhase(s, s.phaseIdx + 1, now);
    case 'prev': return enterPhase(s, s.phaseIdx - 1, now);
    case 'goto': return enterPhase(s, Number(msg.idx), now);
    case 'nextLot':
      if (s.auction.status === 'reveal') return nextLot(s, now);
      if (s.auction.status === 'bidding') return resolveLot(s, now);
      return null;
    case 'restartAuction': return startAuction(s, now);
    case 'toggleWait':
      s.auction.waitForHost = !s.auction.waitForHost;
      return s.auction.deadline || null;
    case 'extend':
      if (s.auction.status === 'bidding') { s.auction.deadline += 15000; return s.auction.deadline; }
      return null;
    case 'redeal':
      alive(s).forEach((p) => {
        if (p.cardFlipped && p.card && p.outer !== null) p.outer = clamp(p.outer - p.card.delta);
      });
      dealEventCards(s);
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
function auctionView(s) {
  const a = s.auction;
  return {
    status: a.status,
    idx: a.idx,
    total: s.lots.length,
    lot: s.lots[a.idx] || null,
    deadline: a.deadline,
    bidCount: Object.keys(a.bids).filter((k) => a.bids[k].amount > 0).length,
    waitForHost: a.waitForHost,
    results: a.results,
    lots: s.lots,
  };
}

function distribution(values) {
  const buckets = new Array(10).fill(0);
  values.forEach((v) => { buckets[Math.min(9, Math.floor(v / 10))] += 1; });
  return buckets;
}

export function hostView(s, roomCode) {
  const ps = alive(s);
  const sc = scored(s);
  const outers = sc.map((p) => p.outer);
  const warmups = ps.filter((p) => p.warmup !== null).map((p) => p.warmup);
  const spent = (p) => 100 - p.points;
  const mostLots = ps.slice().sort((a, b) => b.won.length - a.won.length || spent(b) - spent(a))[0] || null;
  const richest = ps.slice().sort((a, b) => b.points - a.points)[0] || null;

  const hits = ps.filter((p) => p.card && p.card.kind === 'hit')
    .map((p) => ({ name: p.name, group: p.card.group, groupLabel: p.card.groupLabel, text: p.card.text, delta: p.card.delta }));
  // 某組當天完全沒人 → 主持人把那張卡當旁白念出來
  const narrate = ['A', 'B', 'C']
    .filter((k) => !ps.some((p) => groupOf(p) === k))
    .map((k) => ({ name: null, group: k, groupLabel: DECKS[k].label, absent: true, delta: DECKS[k].cards[0].delta, text: DECKS[k].cards[0].text }));

  return {
    role: 'host',
    room: roomCode,
    phase: PHASES[s.phaseIdx],
    phaseIdx: s.phaseIdx,
    phases: PHASES,
    pointsInPlay: pointsInPlay(s),
    verse: VERSE,
    auction: auctionView(s),
    players: ps.map((p) => ({
      pid: p.pid, name: p.name, outer: p.outer, outerStart: p.outerStart,
      inner: p.inner || 0,
      points: p.points, won: p.won, group: groupOf(p),
      warmup: p.warmup,
      cardKind: p.card ? p.card.kind : null, cardFlipped: p.cardFlipped,
      metoo: p.metoo, hasBurden: p.hasBurden, burdenShare: !!p.burdenShared,
      receivedVerse: p.receivedVerse, adjust: p.adjust,
    })),
    stats: {
      count: ps.length,
      answeredWarmup: warmups.length,
      answeredScore: sc.length,
      warmupDist: distribution(warmups),
      outerDist: distribution(outers),
      outerHigh: outers.length ? Math.max(...outers) : null,
      outerLow: outers.length ? Math.min(...outers) : null,
      outerAvg: outers.length ? Math.round(outers.reduce((a, b) => a + b, 0) / outers.length) : null,
      startAvg: sc.length ? Math.round(sc.reduce((a, b) => a + b.outerStart, 0) / sc.length) : null,
      mostLots: mostLots ? { name: mostLots.name, won: mostLots.won, points: mostLots.points } : null,
      richest: richest ? { name: richest.name, points: richest.points, won: richest.won } : null,
      empties: ps.filter((p) => p.won.length === 0).map((p) => ({ name: p.name, points: p.points })),
      flipped: ps.filter((p) => p.cardFlipped).length,
      metoo: ps.filter((p) => p.metoo).map((p) => p.name),
      burdens: ps.filter((p) => p.hasBurden).length,
      sharedBurdens: ps.filter((p) => p.burdenShared).map((p) => ({ name: p.name, text: p.burdenShared })),
      hitCards: hits.concat(narrate),
      decks: Object.values(DECKS).map((d) => ({ key: d.key, label: d.label, rule: d.rule, character: d.character })),
      groupCounts: { A: ps.filter((p) => groupOf(p) === 'A').length, B: ps.filter((p) => groupOf(p) === 'B').length, C: ps.filter((p) => groupOf(p) === 'C').length },
      versesReceived: ps.filter((p) => p.receivedVerse).length,
      cardsDone: ps.filter((p) => p.cardDone).length,
      innerAvg: ps.length ? Math.round(ps.reduce((a, b) => a + b.inner, 0) / ps.length) : 0,
      mysteryWinners: ps.filter((p) => p.won.some((w) => w.mystery)).map((p) => p.name),
    },
  };
}

export function playerView(s, pid, roomCode) {
  const p = s.players[pid];
  const base = {
    role: 'player',
    room: roomCode,
    phase: PHASES[s.phaseIdx],
    phaseIdx: s.phaseIdx,
    pointsInPlay: pointsInPlay(s),
    verse: VERSE,
    auction: auctionView(s),
    playerCount: alive(s).length,
    // 手機在等別人的時候要看得到進度。只有人數，不含任何人的答案。
    answeredWarmup: alive(s).filter((x) => x.warmup !== null).length,
    answeredScore: alive(s).filter((x) => x.outer !== null).length,
  };
  if (!p) return { ...base, me: null };
  return {
    ...base,
    me: {
      pid: p.pid, name: p.name, warmup: p.warmup, outer: p.outer, outerStart: p.outerStart,
      inner: p.inner || 0, innerCap: INNER_CAP,
      points: p.points, won: p.won,
      card: p.cardFlipped ? p.card : (p.card ? { hidden: true } : null),
      cardFlipped: p.cardFlipped, metoo: p.metoo,
      hasBurden: p.hasBurden, burdenShare: !!p.burdenShared,
      receivedVerse: p.receivedVerse, cardDone: p.cardDone,
      myBid: s.auction.bids[p.pid] ? s.auction.bids[p.pid].amount : null,
    },
  };
}

// 房間的鬧鐘。第一關只有拍賣需要計時。
export function onAlarm(s, now) {
  if (PHASES[s.phaseIdx].id !== 'auction') return null;
  return advanceAuction(s, now);
}
