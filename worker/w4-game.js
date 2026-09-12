// 第四關「幸福連線」的規則。純函式，不碰網路也不碰儲存。
//
// 這一關完全不依賴前三關 —— 上一次沒來的人不會少玩到任何東西。
// 接過來的只有卡片上的兩條線。**第三關起第一次來的人，幸福根基直接給 15。**
//
// 一句話講完這一關：深夜兩點你做了七件事（可以複選），每一件都陪了你但沒有一件
// 拿得走那件事；隔三頁之後你打第三通 —— 那一支不限時間、不需要金錢，
// **第一聲就接了**。然後教他怎麼禱告，一起禱告，最後抽實體的恩典卡。
//
// ⚠️ **這一關的幸福指數一分都不動**（CALL_COST 和 ANSWER_GAIN 都是 0）。
// 七關裡只有這一關整晚不碰那條線 —— 今天外面什麼都沒變，
// 真正動的是另外那一條：幸福根基 +15。
import {
  INTRO, LINES, ROUNDS, CALL_COST, ANSWER_GAIN,
  TALLY, IDOL, ASK, HOTLINE, VERSE, NEED, HOW, PRAY, GRACE,
} from './w4-data.js';

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
  { id: 'intro',     tag: '標題',     title: '幸福連線' },
  { id: 'calls',     tag: '互動點 1', title: '深夜兩點，你會怎麼做' },
  { id: 'tally',     tag: '結算頁',   title: '今天晚上，我們都去了哪裡' },
  { id: 'idol',      tag: '信息',     title: '人雕刻了偶像，又向偶像祈求？' },
  { id: 'ask',       tag: '信息',     title: '有沒有一支專線，是不用條件的？' },
  { id: 'hotline',   tag: '互動點 1', title: '上帝會接我電話嗎' },
  // 順序：經文先發下去，見證接著替它作證，然後才教怎麼做、一起做、
  // 最後收到回信。**祝福禱告排在最後**，跟其他六關一樣是收尾的固定儀式。
  { id: 'verse',     tag: '經文',     title: '領受經文' },
  { id: 'testimony', tag: '見證',     title: '見證分享' },
  { id: 'how',       tag: '信息',     title: '我們要如何禱告呢' },
  { id: 'pray',      tag: '全場',     title: '我們開始來禱告' },
  { id: 'letter',    tag: '揭曉',     title: '天父的回信' },
  { id: 'need',      tag: '互動點 2', title: '祝福禱告' },
  { id: 'card',      tag: '週卡',     title: '儲存模擬回憶' },
  { id: 'end',       tag: '預告',     title: '下週預告' },
];

const phaseId = (s) => (PHASES[s.phaseIdx] || PHASES[0]).id;
// 只有那一頁在開，而且公布過的那一輪不能回頭改。
const callsOpen = (s) => phaseId(s) === 'calls';
// 「其他」那一格的文字有長度上限 —— 它會上大螢幕，一行排得下才有用。
const OTHER_MAX = 16;

export function createState() {
  return {
    week: 4,
    phaseIdx: 0,
    players: {},
    order: [],
    roundIdx: 0,         // 現在跑到第幾輪（0–1）
    roundOpen: [],       // 哪幾輪已經公布了
    forceConnect: false, // 有人手機掛了的時候，主持人手動讓大螢幕接通
    letterOpen: false,   // 天父的回信拆了沒（跟第二關的寶箱一樣，主持人按）
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
// 複選：每一輪存的是一個「選了哪幾格」的陣列。
const picksOf = (p, i) => arr(arr(p.calls)[i]);
const otherOf = (p, i) => String(arr(p.others)[i] || '');
const openRounds = (s) => (Array.isArray(s.roundOpen) ? s.roundOpen : (s.roundOpen = []));
const roundShown = (s, i) => openRounds(s).indexOf(i) >= 0;
const callsDone = (s) => openRounds(s).length >= ROUNDS.length;
const otherIdx = LINES.findIndex((l) => l.other);

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
    calls: [],            // 兩輪各選了哪幾格（**複選**）
    others: [],           // 兩輪各自己寫了什麼（會上大螢幕）
    called: false,        // 第三通按了沒
    hasNeed: false,       // 「我現在最需要他幫我的是」留在他自己的手機上
    prayed: false,
    receivedVerse: false,
    cardDone: false,
    adjust: 0,
  };
  s.order.push(pid);
  return pid;
}

// ── 深夜兩點，你會怎麼做 ────────────────────────────────────────────────
// 兩輪，每一輪都是：大家勾（**可以複選，隨時改**）→ 主持人按「公布結果」
// （七格同時翻出那件事後來怎麼了）→ 按「下一題」。
//
// ⚠️ **這一頁一分都不動。** 只要有數字跳出來，全場就會開始找
// 「那我選的這個算好還壞」，而這一頁要講的正好相反。
export function revealRound(s) {
  const i = s.roundIdx;
  if (!ROUNDS[i] || roundShown(s, i)) return false;
  s.roundOpen.push(i);
  if (CALL_COST) {
    alive(s).forEach((p) => {
      if (!picksOf(p, i).length || p.outer === null) return;
      p.outer = clamp(p.outer + CALL_COST);
    });
  }
  return true;
}

// 一顆按鈕按到底：還沒公布就公布，公布過了才換下一輪。
// **不要拆成兩顆** —— 現場一定會有人只按「下一題」，那一輪就沒公布到。
export function callStep(s) {
  if (!roundShown(s, s.roundIdx)) return revealRound(s);
  if (s.roundIdx < ROUNDS.length - 1) { s.roundIdx += 1; return true; }
  return false;
}

export function callPrev(s) {
  if (s.roundIdx <= 0) return false;
  s.roundIdx -= 1;
  return true;
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
    // 勾一格／取消一格。**複選**，公布之前隨時可以改。
    case 'call': {
      if (!callsOpen(s)) break;
      const i = Math.max(0, Math.min(ROUNDS.length - 1, Math.floor(Number(msg.idx))));
      if (i !== s.roundIdx || roundShown(s, i)) break;
      const v = Math.floor(Number(msg.value));
      if (!(v >= 0 && v < LINES.length)) break;
      const rows = arr(p.calls).slice();
      const cur = arr(rows[i]).slice();
      const at = cur.indexOf(v);
      if (at >= 0) cur.splice(at, 1); else cur.push(v);
      rows[i] = cur;
      p.calls = rows;
      break;
    }
    // 「其他」那一格自己寫的字。**這一格會上大螢幕** ——
    // 主持人要在開始前就講明白（w4/notes.js）。
    case 'callOther': {
      if (!callsOpen(s)) break;
      const i = Math.max(0, Math.min(ROUNDS.length - 1, Math.floor(Number(msg.idx))));
      if (i !== s.roundIdx || roundShown(s, i)) break;
      const rows = arr(p.others).slice();
      rows[i] = String(msg.text || '').slice(0, OTHER_MAX);
      p.others = rows;
      break;
    }
    // 第三通。**一按就接**，而且不花任何條件、也不加任何分數 ——
    // 那一刻的重量在畫面和那半句經文上。一給分全場就開始算「我按了有沒有賺到」。
    case 'dial':
      if (phaseId(s) !== 'hotline') break;
      if (!p.called) {
        p.called = true;
        if (ANSWER_GAIN && p.outer !== null) p.outer = clamp(p.outer + ANSWER_GAIN);
      }
      break;
    case 'verse':
      if (!p.receivedVerse) { p.receivedVerse = true; grow(p, INNER_VERSE); }
      break;
    // 「我現在最需要他幫我的是」。那句話留在玩家自己的手機上，
    // 這裡只收「有沒有寫」這個布林值。**完全不上牆。**
    case 'need': {
      p.hasNeed = !!msg.has;
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
    case 'callStep': callStep(s); return null;
    case 'callPrev': callPrev(s); return null;
    // 有人手機掛了、或者有人就是不按的時候，讓大螢幕接通。
    // **每個人自己的 +20 還是要他自己按** —— 這顆只動大螢幕。
    case 'connect': s.forceConnect = true; return null;
    // 拆信。跟第二關的寶箱一樣 —— **那一下要由人按，不要自己跑。**
    case 'openLetter': s.letterOpen = true; return null;
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
// 還沒公布就**不送出那一輪的結果** —— 送出去等於把答案印在手機上。
function callsView(s) {
  const ps = alive(s);
  const i = s.roundIdx;
  const r = ROUNDS[i];
  const shown = roundShown(s, i);
  return {
    idx: i,
    total: ROUNDS.length,
    text: r.text,
    revealed: shown,
    multi: true,
    // 勾了就馬上出現在大螢幕上 —— 誰站在哪一格，全場看得到。
    lines: LINES.map((l, k) => ({
      name: l.name,
      cond: l.cond,
      other: !!l.other,
      who: ps.filter((p) => picksOf(p, i).indexOf(k) >= 0)
        .map((p) => (l.other && otherOf(p, i)
          ? p.name + '：' + otherOf(p, i)
          : p.name)),
      reply: shown ? r.replies[k] : '',
    })),
    // 「幾人已選」＝至少勾了一格的人
    picked: ps.filter((p) => picksOf(p, i).length).length,
  };
}

// 統計頁：兩輪加起來，全場都去了哪裡。
// **算的是人數（至少選過一次），不是次數** —— 主持人要念的那一句是
// 「今天晚上有五個人自己撐過去」，那是人，不是動作次數。
function tallyView(s) {
  const ps = alive(s);
  const rows = LINES.map((l, k) => {
    const who = ps.filter((p) =>
      ROUNDS.some((_, i) => picksOf(p, i).indexOf(k) >= 0));
    return {
      name: l.name,
      other: !!l.other,
      n: who.length,
      who: who.map((p) => p.name),
      // 「其他」那一格印的是他們自己寫的字 —— 這一格才是這一頁最好看的地方
      texts: l.other
        ? ps.flatMap((p) => ROUNDS
            .map((_, i) => (picksOf(p, i).indexOf(k) >= 0 ? otherOf(p, i) : ''))
            .filter(Boolean)
            .map((t) => ({ name: p.name, text: t })))
        : [],
    };
  });
  const max = rows.reduce((m, r) => Math.max(m, r.n), 0);
  // 多的排前面，同數維持原本的順序（「其他」永遠排最後，它是壓軸）
  const order = rows.map((r, i) => ({ r, i }))
    .sort((a, b) => (a.r.other - b.r.other) || (b.r.n - a.r.n) || (a.i - b.i))
    .map((x) => x.r);
  return { rows: order, max: Math.max(max, 1), total: ps.length };
}

// 第三通：大螢幕上的「接通」是**全場都按了**才翻，
// 但每一支手機是**他自己一按就接**。個人的那一下是即時的，牆上那一下是全場的。
function hotlineView(s) {
  const ps = alive(s);
  const dialed = ps.filter((p) => p.called).length;
  return {
    dialed,
    total: ps.length,
    gain: ANSWER_GAIN,
    connected: !!s.forceConnect || (ps.length > 0 && dialed >= ps.length),
  };
}

function common(s) {
  return {
    week: 4,
    phase: PHASES[s.phaseIdx],
    phaseIdx: s.phaseIdx,
    intro: INTRO,
    callsNow: callsView(s),
    callsDone: callsDone(s),
    callsOpen: callsOpen(s),
    tally: TALLY,
    tallyNow: tallyView(s),
    hotlineNow: hotlineView(s),
    idol: IDOL,
    ask: ASK,
    hotline: HOTLINE,
    verse: VERSE,
    need: NEED,
    how: HOW,
    pray: PRAY,
    grace: GRACE,
    letterOpen: !!s.letterOpen,
  };
}

export function hostView(s, roomCode) {
  const ps = alive(s);
  const sc = scored(s);
  const outers = sc.map((p) => p.outer);
  const starts = sc.map((p) => p.outerStart);
  const nameOf = (k) => (LINES[k] ? LINES[k].name : '');

  return {
    role: 'host',
    room: roomCode,
    phases: PHASES,
    ...common(s),
    players: ps.map((p) => ({
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart, inner: p.inner || 0,
      visits: p.visits, newcomer: p.newcomer,
      // 他做過的那幾件，接話全靠這一行（去重，不然兩輪同一格會印兩次）
      callNames: ROUNDS.flatMap((_, i) => picksOf(p, i).map(nameOf))
        .filter((n, i, all) => n && all.indexOf(n) === i),
      picked: picksOf(p, s.roundIdx).length > 0,
      called: !!p.called,
      // 這一關幸福指數不動，所以側欄不會出現任何加減號
      gain: p.called ? ANSWER_GAIN : 0,
      hasNeed: !!p.hasNeed, prayed: !!p.prayed,
      receivedVerse: !!p.receivedVerse, cardDone: !!p.cardDone, adjust: p.adjust || 0,
    })),
    stats: {
      count: ps.length,
      reconnected: sc.length,
      newcomers: ps.filter((p) => p.newcomer).length,
      callPicked: ps.filter((p) => picksOf(p, s.roundIdx).length).length,
      dialed: ps.filter((p) => p.called).length,
      outerAvg: outers.length ? Math.round(outers.reduce((a, b) => a + b, 0) / outers.length) : null,
      startAvg: starts.length ? Math.round(starts.reduce((a, b) => a + b, 0) / starts.length) : null,
      innerAvg: ps.length ? Math.round(ps.reduce((a, b) => a + (b.inner || 0), 0) / ps.length) : 0,
      innerStartAvg: sc.length ? Math.round(sc.reduce((a, b) => a + (b.innerStart || 0), 0) / sc.length) : null,
      versesReceived: ps.filter((p) => p.receivedVerse).length,
      cardsDone: ps.filter((p) => p.cardDone).length,
      // 「已寫下」＝按過那顆按鈕的人。什麼都沒寫也算 —— 你等的就是那顆按鈕。
      needs: ps.filter((p) => p.prayed).length,
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
    callPicked: alive(s).filter((x) => picksOf(x, s.roundIdx).length).length,
    otherIdx,
  };
  if (!p) return { ...base, me: null };
  return {
    ...base,
    me: {
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart,
      inner: p.inner || 0, innerCap: INNER_CAP,
      visits: p.visits, newcomer: p.newcomer,
      picks: picksOf(p, s.roundIdx),
      other: otherOf(p, s.roundIdx),
      called: !!p.called,
      hasNeed: !!p.hasNeed, prayed: !!p.prayed,
      receivedVerse: !!p.receivedVerse, cardDone: !!p.cardDone,
    },
  };
}

// 第四關沒有計時的東西 —— 房間的鬧鐘只用在清空。
