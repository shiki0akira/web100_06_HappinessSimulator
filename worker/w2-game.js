// 第二關「真相大白」的規則。純函式，不碰網路也不碰儲存。
//
// 這一關完全不依賴第一關 —— 上一次沒來的人不會少玩到任何東西。
// 從第一關接過來的只有一條線：卡片上的幸福指數（自己打），
// 加上「這是你第幾次來」推回來的幸福根基。
//
// 一句話講完這一關：在幸福人生商店挑三樣（買三送一），走進人生時光機，
// 三十年後回同一家店驗貨，最後才知道送的那一樣是什麼。
import { ASSETS, SHOP, PICK, GIFT, SHELF_ORDER, VERSE, POLL, TEACH, LOSS_UNIT } from './w2-data.js';

// 幸福根基的規則跟第一關一樣，七關都一樣。上限 95 不是 100 —— 你自己填不滿。
export const INNER_CAP = 95;
export const INNER_PER_WEEK = 15;
export const INNER_VERSE = 10;
export const INNER_PRAYER = 5;

export const PHASES = [
  { id: 'lobby',        tag: '入場',     title: '掃碼進場' },
  { id: 'reconnect',    tag: '接關',     title: '輸入幸福指數' },
  { id: 'shop',         tag: '互動點 1', title: '幸福人生商店' },
  { id: 'shop_result',  tag: '結算頁',   title: '全場最多人挑的' },
  { id: 'poll',         tag: '互動點 2', title: '世界越來越進步，人卻越來越痛苦' },
  { id: 'poll_result',  tag: '互動點 2', title: '全場怎麼看' },
  { id: 'verse_first',  tag: '經文',     title: '盜賊來，無非要偷竊，殺害，毀壞' },
  { id: 'timemachine',  tag: '過場',     title: '人生時光機' },
  { id: 'after30',      tag: '主遊戲',   title: '三十年後的幸福人生商店' },
  { id: 'verse_second', tag: '經文',     title: '我來了，是要叫羊得生命' },
  { id: 'gift',         tag: '高潮',     title: '買三送一的那一樣' },
  { id: 'naming',       tag: '機制事件', title: '那條線有了名字' },
  { id: 'verse',        tag: '經文',     title: '領受經文' },
  { id: 'teach',        tag: '信息',     title: '盜賊和「我」分別是什麼' },
  { id: 'prayer',       tag: '互動點 3', title: '祝福禱告' },
  { id: 'card',         tag: '週卡',     title: '儲存模擬回憶' },
  { id: 'end',          tag: '預告',     title: '下週預告' },
];

// 商店只有那一頁在開。翻頁之後就不能改了 —— 「這就是時間」那句話靠它。
const shopOpen = (s) => PHASES[s.phaseIdx].id === 'shop';

export function createState() {
  return {
    week: 2,
    phaseIdx: 0,
    players: {},
    order: [],
    flipped: [],        // 三十年後翻開了哪幾張（asset id）
    giftOpen: false,    // 「？」揭曉了沒
    named: false,       // 幸福根基正名了沒
    seq: 0,
  };
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const alive = (s) => s.order.map((id) => s.players[id]).filter(Boolean);
const scored = (s) => alive(s).filter((p) => p.outer !== null);
// 幸福根基只會漲。沒有任何事件扣得到它 —— 那是它唯一的意義。
const grow = (p, n) => { p.inner = Math.min(INNER_CAP, (p.inner || 0) + n); };
const assetOf = (id) => ASSETS.find((a) => a.id === id) || null;
// 防呆：舊版規則建立的房間存在 DO 裡，玩家身上沒有 bag 這個欄位。
// deploy 之後那些房間還會活六小時，別讓它們把整個房間打掛。
const bagIds = (p) => (Array.isArray(p.bag) ? p.bag : []);

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
    bag: [],              // 他在商店挑的三樣（asset id）
    bagDone: false,
    poll: null,
    loss: 0,              // 三十年一共掉了幾分，重跑時要還原
    opened: false,        // 按了「我打開它」
    hasBurden: false,     // 那句話留在玩家自己的手機上
    prayed: false,
    receivedVerse: false,
    cardDone: false,
    adjust: 0,
  };
  s.order.push(pid);
  return pid;
}

// ── 三十年 ──────────────────────────────────────────────────────────────
// 十二張牌攤在同一頁，主持人一張一張翻。
// 正面是「剛剛誰挑了它」，翻過去才是折舊率和為什麼 ——
// 翻開的那一秒，挑了它的人才掉分。挑工作和名聲的掉最慘，挑關係的掉最少。
const flippedIds = (s) => (Array.isArray(s.flipped) ? s.flipped : (s.flipped = []));

export function flipCard(s, id) {
  const a = assetOf(Number(id));
  if (!a || flippedIds(s).indexOf(a.id) >= 0) return false;
  s.flipped.push(a.id);
  const loss = Math.round(a.rate * LOSS_UNIT);
  alive(s).forEach((p) => {
    if (p.outer === null || bagIds(p).indexOf(a.id) < 0) return;
    p.outer = clamp(p.outer - loss);
    p.loss = (p.loss || 0) + loss;
  });
  return true;
}

// 備忘錄上的「翻下一張」：照三十年後的排序，由重到輕。
export function flipNext(s) {
  const next = SHELF_ORDER.find((id) => flippedIds(s).indexOf(id) < 0);
  return next === undefined ? false : flipCard(s, next);
}

// 他袋子裡的東西。三十年還沒過就不給折舊率 —— 手機上先看到答案就沒戲了。
function bagOf(s, p) {
  const items = bagIds(p).map((id) => {
    const a = assetOf(id);
    if (!a) return null;
    return flippedIds(s).indexOf(a.id) >= 0
      ? { id: a.id, name: a.name, aged: true, rate: a.rate,
          left: Math.round((1 - a.rate) * 100), loss: Math.round(a.rate * LOSS_UNIT) }
      : { id: a.id, name: a.name, aged: false };
  }).filter(Boolean);
  // 買三送一：挑滿三樣，第四格就是他的了 —— 只是還不知道是什麼
  if (p.bagDone) {
    items.push(s.giftOpen
      ? { gift: true, name: GIFT.name, aged: true, rate: 0, left: 100, loss: 0 }
      : { gift: true, name: GIFT.mask, aged: false });
  }
  return items;
}

// 三十年後的貨架，由重到輕。**沒翻開的那幾張不給折舊率和為什麼** ——
// 那是牌的背面，先送出去就等於先攤開答案。
function shelf(s) {
  const done = flippedIds(s);
  return {
    flipped: done.length,
    total: SHELF_ORDER.length,
    rows: SHELF_ORDER.map((id) => {
      const a = assetOf(id);
      const open = done.indexOf(id) >= 0;
      const row = {
        id: a.id, name: a.name, open,
        // 正面記著剛剛誰挑了它 —— 翻開之前那就是這張牌上唯一的字
        pickedBy: alive(s).filter((p) => bagIds(p).indexOf(a.id) >= 0).map((p) => p.name),
      };
      if (open) {
        row.rate = a.rate;
        row.left = Math.round((1 - a.rate) * 100);
        row.why = a.why;
      }
      return row;
    }),
  };
}

// ── 階段切換 ────────────────────────────────────────────────────────────
export function enterPhase(s, idx) {
  s.phaseIdx = Math.max(0, Math.min(PHASES.length - 1, idx));
  const id = PHASES[s.phaseIdx].id;
  // 走到哪一頁，機制就跟著發生 —— 主持人不用多按一次
  if (id === 'gift') s.giftOpen = true;
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
    // 商店：挑三樣。翻頁之後就不收了。
    case 'bag': {
      if (!shopOpen(s)) break;
      const valid = ASSETS.map((a) => a.id);
      const ids = (Array.isArray(msg.ids) ? msg.ids : []).map(Number)
        .filter((x, i, arr) => valid.indexOf(x) >= 0 && arr.indexOf(x) === i)
        .slice(0, PICK);
      p.bag = ids;
      p.bagDone = ids.length === PICK;
      break;
    }
    case 'poll':
      p.poll = Math.max(0, Math.min(POLL.options.length - 1, Math.floor(Number(msg.value))));
      break;
    // 不勉強、不扣分、不催。按了就按了，再按一次可以收回。
    case 'open':
      if (s.giftOpen) p.opened = !p.opened;
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
    // 三十年後那一頁：一張一張翻。翻開的那一秒，挑了它的人才掉分。
    case 'flip': flipCard(s, msg.id); return null;
    case 'flipNext': flipNext(s); return null;
    case 'flipAll':
      while (flipNext(s)) { /* 趕時間的時候用 */ }
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
// 貨架上只給名字。折舊率要等三十年過完才送出去。
const shelfMenu = () => ASSETS.map((a) => ({ id: a.id, name: a.name }));

function pollCounts(s) {
  const c = new Array(POLL.options.length).fill(0);
  alive(s).forEach((p) => { if (typeof p.poll === 'number') c[p.poll] += 1; });
  return c;
}

export function hostView(s, roomCode) {
  const ps = alive(s);
  const sc = scored(s);
  const outers = sc.map((p) => p.outer);
  const starts = sc.map((p) => p.outerStart);

  // 全場最多人挑的前三名。同票一起列，不挑一個當代表。
  const counts = ASSETS.map((a) => ({
    id: a.id, name: a.name,
    n: ps.filter((p) => bagIds(p).indexOf(a.id) >= 0).length,
  })).sort((x, y) => y.n - x.n);
  const nonZero = counts.filter((x) => x.n > 0);
  const cut = nonZero.length >= 3 ? nonZero[2].n : 0;
  // 同票一起上榜，但最多五個 —— 人少的時候大家都是一票，全部列出來就不叫排行了
  const top3 = nonZero.filter((x) => x.n >= cut).slice(0, 5);

  return {
    role: 'host',
    week: 2,
    room: roomCode,
    phase: PHASES[s.phaseIdx],
    phaseIdx: s.phaseIdx,
    phases: PHASES,
    verse: VERSE,
    poll: POLL,
    teach: TEACH,
    shop: SHOP,
    pick: PICK,
    gift: GIFT,
    assets: shelfMenu(),
    shelf: shelf(s),
    giftOpen: s.giftOpen,
    named: s.named,
    shopOpen: shopOpen(s),
    players: ps.map((p) => ({
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart, inner: p.inner || 0,
      visits: p.visits, newcomer: p.newcomer,
      bag: bagOf(s, p), bagDone: !!p.bagDone, loss: p.loss || 0,
      poll: typeof p.poll === 'number' ? p.poll : null, opened: !!p.opened,
      hasBurden: !!p.hasBurden,
      receivedVerse: !!p.receivedVerse, cardDone: !!p.cardDone, adjust: p.adjust || 0,
    })),
    stats: {
      count: ps.length,
      reconnected: sc.length,
      newcomers: ps.filter((p) => p.newcomer).length,
      bagsDone: ps.filter((p) => p.bagDone).length,
      top3,
      counts,
      answeredPoll: ps.filter((p) => typeof p.poll === 'number').length,
      pollCounts: pollCounts(s),
      outerAvg: outers.length ? Math.round(outers.reduce((a, b) => a + b, 0) / outers.length) : null,
      startAvg: starts.length ? Math.round(starts.reduce((a, b) => a + b, 0) / starts.length) : null,
      innerAvg: ps.length ? Math.round(ps.reduce((a, b) => a + (b.inner || 0), 0) / ps.length) : 0,
      hardestHit: (() => {
        const withDrop = sc.map((p) => ({ name: p.name, drop: p.outerStart - p.outer }))
          .sort((a, b) => b.drop - a.drop);
        return withDrop.length && withDrop[0].drop > 0 ? withDrop[0] : null;
      })(),
      opened: ps.filter((p) => p.opened).map((p) => p.name),
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
    poll: POLL,
    teach: TEACH,
    shop: SHOP,
    pick: PICK,
    gift: GIFT,
    assets: shelfMenu(),
    shelf: shelf(s),
    giftOpen: s.giftOpen,
    named: s.named,
    shopOpen: shopOpen(s),
    playerCount: alive(s).length,
    // 手機在等別人的時候要看得到進度。只有人數，不含任何人的答案。
    reconnected: alive(s).filter((x) => x.outer !== null).length,
    bagsDone: alive(s).filter((x) => x.bagDone).length,
    answeredPoll: alive(s).filter((x) => typeof x.poll === 'number').length,
  };
  if (!p) return { ...base, me: null };
  return {
    ...base,
    me: {
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart,
      inner: p.inner || 0, innerCap: INNER_CAP,
      visits: p.visits, newcomer: p.newcomer,
      bag: bagOf(s, p), bagIds: bagIds(p), bagDone: !!p.bagDone, loss: p.loss || 0,
      poll: typeof p.poll === 'number' ? p.poll : null, opened: !!p.opened,
      hasBurden: !!p.hasBurden,
      receivedVerse: !!p.receivedVerse, cardDone: !!p.cardDone,
    },
  };
}

// 第二關沒有計時的東西 —— 房間的鬧鐘只用在清空。
