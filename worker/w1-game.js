// 第一關「真幸福」的規則。純函式，不碰網路也不碰儲存 —— 房間（Durable Object）負責把它接上線。
import { LOTS, PRACTICE_LOT, DECKS, VERSE } from './w1-data.js';

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
  { id: 'event_result',     tag: '互動點 4', title: '追求幸福的結果' },
  { id: 'testimony',        tag: '見證',     title: '見證分享' },
  { id: 'verse',            tag: '經文',     title: '領受經文' },
  { id: 'burden',           tag: '互動點 5', title: '祝福禱告' },
  { id: 'card',             tag: '週卡',     title: '儲存模擬回憶' },
  { id: 'end',              tag: '預告',     title: '下週預告' },
];

// 點數只有幸福拍賣會用得到。規則頁（auction_intro）之前畫面上不出現點數 ——
// 玩家還沒聽到「每人 100 點」，先看到一個數字只會讓人以為現在就該花它。
const AUCTION_START = PHASES.findIndex((p) => p.id === 'auction_intro');
const AUCTION_END = PHASES.findIndex((p) => p.id === 'auction_result');
const pointsInPlay = (s) => s.phaseIdx >= AUCTION_START && s.phaseIdx <= AUCTION_END;

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
// 幸福指數的上限比 100 高：一開始就填 100 的人，拍賣加分還是要加得上去。
// 進度條吃 % 寬度，超過 100 就是滿格，數字照實顯示。
export const OUTER_MAX = 200;
const clampOuter = (n) => Math.max(0, Math.min(OUTER_MAX, Math.round(n)));
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
    hasBurden: false,   // 重擔內容留在玩家手機上，除非他願意公開
    receivedVerse: false,
    cardDone: false,    // 生成週卡＝禱告收尾做完了
    adjust: 0,
    auctionBonus: 0,   // 拍賣結算加了幾分
    prayed: false,     // 祝福禱告那一頁送出過了沒
  };
  s.order.push(pid);
  return pid;
}

// ── 拍賣 ────────────────────────────────────────────────────────────────
// 幾樣標的。人少就少拍幾樣，人多就整組開下去 —— 拍賣本身就是這一關最好玩的地方。
function lotCountFor(n) {
  return n >= 6 ? 10 : 8;
}

function buildLots(s) {
  const count = lotCountFor(Math.max(alive(s).length, 1));
  // 第一樣是試拍品，不計分
  s.lots = [{ ...PRACTICE_LOT }].concat(LOTS.slice(0, Math.min(Math.max(count, 2), LOTS.length)));
}

export function startAuction(s, now) {
  buildLots(s);
  const wait = s.auction.waitForHost;
  clearAuctionBonus(s);
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
      // 試拍只是練習：照樣開標、照樣有人得標，但不扣點也不算他買到
      if (!lot.practice) {
        p.points -= win.amount;
        p.won.push({ lotId: lot.id, name: lot.name, price: win.amount });
      }
      result.winner = { pid: p.pid, name: p.name };
      result.amount = win.amount;
    }
  }
  a.results.push(result);
  a.status = 'reveal';
  a.deadline = a.waitForHost ? 0 : now + REVEAL_MS;
  return a.deadline || null;
}

// 退回去重跑某一樣：把那一樣（含它之後的）結果撤掉，得標的人把點數和東西還回來。
// 試拍那一樣本來就不扣點也不進手上的東西，所以找不到、也不會退錯。
function undoResultsFrom(s, idx) {
  const a = s.auction;
  while (a.results.length > idx) {
    const r = a.results.pop();
    if (!r || !r.winner) continue;
    const p = s.players[r.winner.pid];
    if (!p) continue;
    const i = p.won.findIndex((w) => w.lotId === r.lot.id && w.price === r.amount);
    if (i >= 0) { p.won.splice(i, 1); p.points += r.amount; }
  }
}

// 回上一樣。現場最常用的情境是有人手機卡住沒出到價 —— 退回去重開就好。
function prevLot(s, now) {
  const a = s.auction;
  if (a.status === 'idle') return null;
  // 開標畫面上按「上一項」＝重開現在這一樣（主持人剛看到出事）；
  // 暗標中按＝退回前一樣。都是往回退一步。
  const target = a.status === 'reveal' ? a.idx : Math.max(0, a.idx - 1);
  undoResultsFrom(s, target);
  a.idx = target;
  a.status = 'bidding';
  a.bids = {};
  a.deadline = now + BID_MS;
  return a.deadline;
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

// ── 拍賣的加分 ──────────────────────────────────────────────────────────
// 標到東西是有回報的 —— 不然這場拍賣只是在花錢。加分都記在 auctionBonus 裡，
// 主持人回頭重跑拍賣的時候整批退掉再算一次。
export const BONUS = { perLot: 5, mostLots: 5, richest: 10, poorest: 5 };

export function applyAuctionBonus(s) {
  const ps = alive(s);
  if (!ps.length) return;
  clearAuctionBonus(s);
  const maxWon = Math.max(...ps.map((p) => p.won.length));
  const maxPts = Math.max(...ps.map((p) => p.points));
  const minPts = Math.min(...ps.map((p) => p.points));
  ps.forEach((p) => {
    let b = p.won.length * BONUS.perLot;
    if (maxWon > 0 && p.won.length === maxWon) b += BONUS.mostLots;
    if (p.points === maxPts) b += BONUS.richest;
    if (p.points === minPts) b += BONUS.poorest;
    p.auctionBonus = b;
    if (p.outer !== null) p.outer = clampOuter(p.outer + b);
  });
}

function clearAuctionBonus(s) {
  alive(s).forEach((p) => {
    if (p.auctionBonus && p.outer !== null) p.outer = clampOuter(p.outer - p.auctionBonus);
    p.auctionBonus = 0;
  });
}

// ── 模擬生命中的事件 ──────────────────────────────────────────────────────────
export function dealEventCards(s) {
  const players = alive(s);
  const buckets = { A: [], B: [], C: [] };
  players.forEach((p) => {
    p.card = null; p.cardFlipped = false;
    buckets[groupOf(p)].push(p);
  });

  Object.keys(buckets).forEach((k) => {
    const group = shuffle(buckets[k]);
    if (!group.length) return;
    const deck = DECKS[k].cards;
    const hit = deck.find((c) => c.kind === 'hit');
    const rest = shuffle(deck.filter((c) => c.kind !== 'hit'));
    // 重擊卡保證發出：該組有人，就一定有人抽到
    group[0].card = { ...hit, group: k, groupLabel: DECKS[k].label, groupShort: DECKS[k].short };
    for (let i = 1; i < group.length; i++) {
      group[i].card = { ...rest[(i - 1) % rest.length], group: k, groupLabel: DECKS[k].label, groupShort: DECKS[k].short };
    }
  });

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
  if (id === 'auction_result') applyAuctionBonus(s);
  if (id === 'event_draw' && !s.eventDealt) dealEventCards(s);
  return null;
}

// ── 玩家動作 ────────────────────────────────────────────────────────────
export function applyAction(s, pid, msg, now) {
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
        // 每個人都按過出價了就直接開標。剩下的秒數只會讓全場乾等 ——
        // 不想買的人本來就不會按，那種情況還是等時間到。
        const ps = alive(s);
        if (ps.length && ps.every((x) => a.bids[x.pid])) return resolveLot(s, now || Date.now());
      }
      break;
    }
    case 'flip':
      if (p.card && !p.cardFlipped) {
        p.cardFlipped = true;
        if (p.outer !== null) p.outer = clampOuter(p.outer + p.card.delta);
      }
      break;
    // 這一關幸福根基只有這兩個入口，而且都只算一次
    case 'verse':
      if (!p.receivedVerse) { p.receivedVerse = true; grow(p, INNER_VERSE); }
      break;
    case 'card':
      p.cardDone = true;
      break;
    // 重擔：文字留在玩家自己的手機上。這裡只收「有沒有寫」，
    // 以及他主動按下「我願意分享」時才送上來的那一句。
    case 'burden':
      p.hasBurden = !!msg.has;
      // 禱告這一頁送出就加分。寫不寫得出來是他的事，一起禱告是大家的事。
      if (!p.prayed) { p.prayed = true; grow(p, INNER_PRAYER); }
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
    case 'prevLot': return prevLot(s, now);
    case 'restartAuction': return startAuction(s, now);
    case 'toggleWait':
      s.auction.waitForHost = !s.auction.waitForHost;
      return s.auction.deadline || null;
    case 'extend':
      if (s.auction.status === 'bidding') { s.auction.deadline += 15000; return s.auction.deadline; }
      return null;
    case 'redeal':
      alive(s).forEach((p) => {
        if (p.cardFlipped && p.card && p.outer !== null) p.outer = clampOuter(p.outer - p.card.delta);
      });
      dealEventCards(s);
      return null;
    case 'adjust': {
      const p = s.players[msg.pid];
      if (p && p.outer !== null) {
        const d = Number(msg.delta) || 0;
        p.outer = clampOuter(p.outer + d);
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
  // 三個統計都可能同分 —— 同分就一起列出來，不要挑一個當代表
  const topOf = (pick, best) => {
    if (!ps.length) return [];
    const target = ps.map(pick).reduce(best);
    return ps.filter((p) => pick(p) === target)
      .map((p) => ({ name: p.name, points: p.points, count: p.won.length }));
  };
  const topBuyers = topOf((p) => p.won.length, (a, b) => Math.max(a, b)).filter((x) => x.count > 0);
  const richest = topOf((p) => p.points, (a, b) => Math.max(a, b));
  const poorest = topOf((p) => p.points, (a, b) => Math.min(a, b));

  const hits = ps.filter((p) => p.card && p.card.kind === 'hit')
    .map((p) => ({ name: p.name, group: p.card.group, groupLabel: p.card.groupLabel, text: p.card.text, delta: p.card.delta }));
  // 某組當天完全沒人 → 主持人把那張卡當旁白念出來
  const narrate = ['A', 'B', 'C']
    .filter((k) => !ps.some((p) => groupOf(p) === k))
    .map((k) => ({ name: null, group: k, groupLabel: DECKS[k].label, groupShort: DECKS[k].short, absent: true, delta: DECKS[k].cards[0].delta, text: DECKS[k].cards[0].text }));

  return {
    role: 'host',
    room: roomCode,
    phase: PHASES[s.phaseIdx],
    phaseIdx: s.phaseIdx,
    phases: PHASES,
    pointsInPlay: pointsInPlay(s),
    verse: VERSE,
    bonus: BONUS,
    auction: auctionView(s),
    players: ps.map((p) => ({
      pid: p.pid, name: p.name, outer: p.outer, outerStart: p.outerStart,
      inner: p.inner || 0,
      points: p.points, won: p.won, group: groupOf(p),
      warmup: p.warmup,
      cardKind: p.card ? p.card.kind : null, cardFlipped: p.cardFlipped,
      auctionBonus: p.auctionBonus || 0,
      hasBurden: p.hasBurden,
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
      topBuyers, richest, poorest,
      flipped: ps.filter((p) => p.cardFlipped).length,
      burdens: ps.filter((p) => p.hasBurden).length,
      hitCards: hits.concat(narrate),
      // 每個人抽到的卡，翻開了才進來 —— 第 11 頁一次看完
      allCards: ps.filter((p) => p.cardFlipped && p.card)
        .map((p) => ({ name: p.name, text: p.card.text, delta: p.card.delta, kind: p.card.kind }))
        .sort((a, b) => a.delta - b.delta),
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
      points: p.points, won: p.won, auctionBonus: p.auctionBonus || 0,
      card: p.cardFlipped ? p.card : (p.card ? { hidden: true } : null),
      cardFlipped: p.cardFlipped,
      hasBurden: p.hasBurden,
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
