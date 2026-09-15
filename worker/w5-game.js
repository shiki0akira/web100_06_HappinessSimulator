// 第五關「當上帝來敲門」的規則。純函式，不碰網路也不碰儲存。
//
// 這一關完全不依賴前四關 —— 上一次沒來的人不會少玩到任何東西。
// 接過來的只有卡片上的兩條線。**第三關起第一次來的人，幸福根基直接給 15。**
//
// 一句話講完這一關：五次有人敲門（外送員、推銷、房東、鄰居、朋友），
// 每一次選開門／隔著門問／假裝不在家，幸福指數跟著動。結算完之後
// **門外又有人在敲 —— 這一次不在模擬裡、不算分**，全場都開了門，主持人發真的禮物。
//
// ⚠️ **幸福指數只在人生模擬器那五次動。** 彩蛋那一次一分都不算 ——
// 只要有分數，全場就會開始算「給上帝開門加幾分」，那就是「信了就加分」。
import {
  INTRO, CHOICES, KNOCKS, MONTH, EGG,
  WHO, SEEK, VERSE, CARDS, RESPOND, BLESS,
} from './w5-data.js';

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
  { id: 'intro',     tag: '標題',     title: '當上帝來敲門' },
  { id: 'knocks',    tag: '互動點 1', title: '人生模擬器 · 有人來敲門' },
  { id: 'month',     tag: '結算頁',   title: '這五天，誰開了門？' },
  // 彩蛋放在結算之後：**它不在模擬裡**，所以日曆收掉了才出現。
  { id: 'egg',       tag: '彩蛋',     title: '有人在敲門' },
  { id: 'who',       tag: '信息',     title: '上帝是誰？' },
  { id: 'seek',      tag: '信息',     title: '上帝主動尋找、拯救罪人' },
  // 經文排在第二段和第三段中間：禮物送到了 → 接待他的，就作兒女 → 那我們怎麼回應。
  { id: 'verse',     tag: '經文',     title: '領受經文' },
  { id: 'testimony', tag: '見證',     title: '見證分享' },
  // 架構原本排在第五關開場的翻卡片，移到見證後面：
  // 「他回應了你嗎？→ 那你要怎麼回應他？」
  { id: 'cards',     tag: '回顧',     title: '翻開你上一次的卡片' },
  { id: 'respond',   tag: '信息',     title: '我們應該如何回應？' },
  { id: 'bless',     tag: '互動點 3', title: '祝福禱告' },
  { id: 'card',      tag: '週卡',     title: '儲存模擬回憶' },
  { id: 'end',       tag: '預告',     title: '下週預告' },
];

const phaseId = (s) => (PHASES[s.phaseIdx] || PHASES[0]).id;

export function createState() {
  return {
    week: 5,
    phaseIdx: 0,
    players: {},
    order: [],
    knockIdx: 0,         // 現在是第幾次敲門（0–4）
    knockOpen: [],       // 哪幾次已經公布了
    forceOpen: false,    // 有人手機沒電的時候，主持人手動讓大螢幕翻過去
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
const openList = (s) => (Array.isArray(s.knockOpen) ? s.knockOpen : (s.knockOpen = []));
const shown = (s, i) => openList(s).indexOf(i) >= 0;
const choiceOf = (p, i) => {
  const v = arr(p.knocks)[i];
  return v === 0 || v === 1 || v === 2 ? v : -1;
};

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
    knocks: [],           // 五次敲門各選了什麼（0 開門／1 隔著門問／2 假裝不在家）
    gains: [],            // 每一次公布實際動了多少（夾 0–100 之後的真實變動）
    knockBase: null,      // 第一次公布之前的幸福指數 —— 手機統計頁的起點，也是重跑時要還原的值
    opened: false,        // 彩蛋那一扇門開了沒（**不算分**）
    hasBless: false,      // 「我想把祝福帶給」留在他自己的手機上
    prayed: false,
    receivedVerse: false,
    cardDone: false,
    adjust: 0,
  };
  s.order.push(pid);
  return pid;
}

// ── 人生模擬器 ────────────────────────────────────────────────────────────
// 五次，每一次都是：大家選（公布前可以改）→ 主持人按「公布結果」→ 按「下一次敲門」。
// **公布之後那一次就鎖住了**，同一次不會重複計分。
export function revealKnock(s) {
  const i = s.knockIdx;
  const k = KNOCKS[i];
  if (!k || shown(s, i)) return false;
  s.knockOpen.push(i);
  alive(s).forEach((p) => {
    if (p.outer === null) return;
    if (p.knockBase === null || p.knockBase === undefined) p.knockBase = p.outer;
    const c = choiceOf(p, i);
    const gains = arr(p.gains).slice();
    if (c < 0) { gains[i] = 0; p.gains = gains; return; }
    const d = k.outcomes[c].d;
    const before = p.outer;
    p.outer = clamp(p.outer + d);
    gains[i] = p.outer - before;
    p.gains = gains;
  });
  return true;
}

// 一顆按鈕按到底：還沒公布就公布，公布過了才換下一次敲門。
// **不要拆成兩顆** —— 現場一定會有人只按「下一次」，那一次就沒公布到。
export function knockStep(s) {
  if (!shown(s, s.knockIdx)) return revealKnock(s);
  if (s.knockIdx < KNOCKS.length - 1) { s.knockIdx += 1; return true; }
  return false;
}

export function knockPrev(s) {
  if (s.knockIdx <= 0) return false;
  s.knockIdx -= 1;
  return true;
}

// 重跑整個人生模擬器：每個人的幸福指數還原到第一次公布之前。
export function knockRestart(s) {
  alive(s).forEach((p) => {
    if (p.knockBase !== null && p.knockBase !== undefined) p.outer = p.knockBase;
    p.knockBase = null;
    p.knocks = [];
    p.gains = [];
  });
  s.knockIdx = 0;
  s.knockOpen = [];
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
    // 敲門：只收現在這一次，公布之前隨時可以改。
    case 'knock': {
      if (phaseId(s) !== 'knocks') break;
      const i = Math.floor(Number(msg.idx));
      if (i !== s.knockIdx || shown(s, i)) break;
      const v = Math.floor(Number(msg.value));
      if (!(v >= 0 && v < CHOICES.length)) break;
      const rows = arr(p.knocks).slice();
      rows[i] = v;
      p.knocks = rows;
      break;
    }
    // 彩蛋開門。**不算分。** 只收「開了」這件事 ——
    // 「隔著門問」「假裝不在家」只在他自己手機上換字，不會送到這裡。
    case 'open':
      if (phaseId(s) !== 'egg') break;
      p.opened = true;
      break;
    case 'verse':
      if (!p.receivedVerse) { p.receivedVerse = true; grow(p, INNER_VERSE); }
      break;
    // 「這個禮拜，我想把祝福帶給＿＿」。那句話留在玩家自己的手機上，
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
    case 'knockStep': knockStep(s); return null;
    case 'knockPrev': knockPrev(s); return null;
    case 'knockRestart': knockRestart(s); return null;
    // 有人手機沒電的時候，讓大螢幕翻過去。**這一顆只動大螢幕**，不替任何人按手機。
    case 'openAll': s.forceOpen = true; return null;
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
// 還沒公布就**不送出那一次的結果** —— 送出去等於把答案印在手機上。
// 大螢幕上**只有人數，沒有名字**：第 5 天那一次對某些人是真的。
function knockView(s) {
  const ps = alive(s);
  const i = s.knockIdx;
  const k = KNOCKS[i];
  const open = shown(s, i);
  return {
    idx: i,
    total: KNOCKS.length,
    day: k.day, who: k.who, art: k.art, says: k.says,
    revealed: open,
    cols: CHOICES.map((label, c) => ({
      label,
      n: open ? ps.filter((p) => choiceOf(p, i) === c).length : null,
      d: open ? k.outcomes[c].d : null,
      t: open ? k.outcomes[c].t : '',
    })),
    picked: ps.filter((p) => choiceOf(p, i) >= 0).length,
  };
}

// 統計：五次敲門，每一次三格，印人數和名字（跟第四關的統計圖一樣）。
// 還沒公布的那一次不送名字 —— 送出去等於把答案印在牆上。
function monthView(s) {
  const ps = alive(s);
  return {
    rows: KNOCKS.map((k, i) => {
      const open = shown(s, i);
      return {
        day: k.day, who: k.who, art: k.art, shown: open,
        cols: CHOICES.map((label, c) => {
          const names = open ? ps.filter((p) => choiceOf(p, i) === c).map((p) => p.name) : [];
          return { label, n: names.length, names };
        }),
      };
    }),
    total: ps.length,
  };
}

// 彩蛋：大螢幕等**全場都開了**才翻。大螢幕只顯示「幾人已開門」，不顯示是誰還沒開。
function eggView(s) {
  const ps = alive(s);
  const opened = ps.filter((p) => p.opened).length;
  return {
    opened,
    total: ps.length,
    done: !!s.forceOpen || (ps.length > 0 && opened >= ps.length),
  };
}

function common(s) {
  return {
    week: 5,
    phase: PHASES[s.phaseIdx],
    phaseIdx: s.phaseIdx,
    intro: INTRO,
    choices: CHOICES,
    knockNow: knockView(s),
    knocksDone: openList(s).length >= KNOCKS.length,
    month: MONTH,
    monthNow: monthView(s),
    egg: EGG,
    eggNow: eggView(s),
    who: WHO,
    seek: SEEK,
    verse: VERSE,
    cards: CARDS,
    respond: RESPOND,
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
      knocked: choiceOf(p, s.knockIdx) >= 0,
      opened: !!p.opened,
      hasBless: !!p.hasBless, prayed: !!p.prayed,
      receivedVerse: !!p.receivedVerse, cardDone: !!p.cardDone, adjust: p.adjust || 0,
    })),
    stats: {
      count: ps.length,
      reconnected: sc.length,
      newcomers: ps.filter((p) => p.newcomer).length,
      knockPicked: ps.filter((p) => choiceOf(p, s.knockIdx) >= 0).length,
      opened: ps.filter((p) => p.opened).length,
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
  const i = s.knockIdx;
  const base = {
    role: 'player',
    room: roomCode,
    ...common(s),
    playerCount: alive(s).length,
    // 手機在等別人的時候要看得到進度。只有人數，不含任何人的答案。
    reconnected: alive(s).filter((x) => x.outer !== null).length,
  };
  if (!p) return { ...base, me: null };
  const c = choiceOf(p, i);
  return {
    ...base,
    me: {
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart,
      inner: p.inner || 0, innerCap: INNER_CAP,
      visits: p.visits, newcomer: p.newcomer,
      knock: c,
      // 五天的起點。還沒公布過就是現在的值。
      knockBase: p.knockBase === null || p.knockBase === undefined ? p.outer : p.knockBase,
      // 公布之後才有：他這一次實際動了多少
      gain: shown(s, i) && c >= 0 ? (Number(arr(p.gains)[i]) || 0) : null,
      opened: !!p.opened,
      hasBless: !!p.hasBless, prayed: !!p.prayed,
      receivedVerse: !!p.receivedVerse, cardDone: !!p.cardDone,
    },
  };
}

// 第五關沒有計時的東西 —— 房間的鬧鐘只用在清空。
