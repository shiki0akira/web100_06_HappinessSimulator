// 第三關「萬世巨星」的規則。純函式，不碰網路也不碰儲存。
//
// 這一關完全不依賴前兩關 —— 上一次沒來的人不會少玩到任何東西。
// 接過來的只有卡片上的兩條線。**第三關起第一次來的人，幸福根基直接給 15。**
//
// 一句話講完這一關：八句話猜猜看是誰說的（耶穌只佔四題），
// 然後選一條路往上爬，三條梯子都構不到 —— 那時候第 8 題那句話再出現一次。
import {
  QUIZ, QUIZ_PLUS, TRACES, REVEAL,
  SINS, SIN_ASK, SIN_TEACH, JUDGE,
  LADDERS, ROADS, GOAL,
  VERSE, WAY, PAID, PAID_PLUS, BAPTISM, WHOIS,
} from './w3-data.js';

// 幸福根基的規則七關都一樣。上限 95 不是 100 —— 你自己填不滿。
export const INNER_CAP = 95;
export const INNER_PER_WEEK = 15;
export const INNER_VERSE = 10;
export const INNER_PRAYER = 5;
// 第三關起第一次來的新朋友直接給 15。第五關才進來的人旁邊一排是 30、45、60，
// 他掛 0 會很難看 —— 而且今天他確實會領受經文、確實會禱告。
export const NEWCOMER_INNER = 15;

export const PHASES = [
  { id: 'lobby',     tag: '入場',     title: '掃碼進場' },
  { id: 'reconnect', tag: '接關',     title: '輸入幸福指數' },
  { id: 'quiz',      tag: '互動點 1', title: '這句話是誰說的' },
  { id: 'reveal',    tag: '揭曉',     title: '萬世巨星' },
  { id: 'sins',      tag: '互動點 2', title: '這些算不算罪' },
  { id: 'sin_teach', tag: '信息',     title: '罪不是一張壞事清單' },
  { id: 'judge',     tag: '信息',     title: '死後還有審判' },
  { id: 'roads',     tag: '互動點 3', title: '人生模擬器 · 三條路' },
  { id: 'way',       tag: '高潮',     title: '救恩之路' },
  { id: 'paid',      tag: '信息',     title: '耶穌代替我們償還罪債' },
  { id: 'verse',     tag: '經文',     title: '領受經文' },
  { id: 'baptism',   tag: '信息',     title: '信而受洗，成為上帝的兒女' },
  { id: 'prayer',    tag: '互動點 4', title: '祝福禱告' },
  { id: 'card',      tag: '週卡',     title: '儲存模擬回憶' },
  { id: 'end',       tag: '預告',     title: '下週預告' },
];

const phaseId = (s) => (PHASES[s.phaseIdx] || PHASES[0]).id;
// 選梯子只有那一頁在開，而且爬完就不能改了 ——「這就是你選的路」靠它。
const roadsOpen = (s) => phaseId(s) === 'roads' && !s.climbed;

export function createState() {
  return {
    week: 3,
    phaseIdx: 0,
    players: {},
    order: [],
    quizIdx: 0,          // 現在開到第幾題
    quizOpen: [],        // 哪幾題已經揭答案了
    revealStep: 0,       // 揭曉那一頁點到第幾段（0–1）
    climbed: false,      // 三條梯子爬過了沒
    paid: false,         // 第 10 頁的 +15 發過了沒
    wayStep: 0,          // 救恩之路那一頁點到第幾段（0–2）
    seq: 0,
  };
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const alive = (s) => s.order.map((id) => s.players[id]).filter(Boolean);
const scored = (s) => alive(s).filter((p) => p.outer !== null);
// 幸福根基只會漲。沒有任何事件扣得到它 —— 那是它唯一的意義。
const grow = (p, n) => { p.inner = Math.min(INNER_CAP, (p.inner || 0) + n); };
const ladderOf = (id) => LADDERS.find((l) => l.id === id) || null;
// 防呆：舊版規則建立的房間還會在 DO 裡活六小時，別讓它們把房間打掛。
const arr = (v) => (Array.isArray(v) ? v : []);
const openList = (s) => (Array.isArray(s.quizOpen) ? s.quizOpen : (s.quizOpen = []));

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
    answers: [],          // 八題各選了哪一個（null = 還沒答）
    correct: 0,           // 猜對幾題
    road: null,           // 他選的那一條梯子
    climbGain: 0,         // 爬上去加了幾分
    climbFall: 0,         // 最後一階踩空掉了幾分
    sins: [],             // 罪那一頁勾了哪幾個（不加分、不評分）
    paid: 0,              // 第 10 頁全場加的那 15 分
    whois: [],            // 「我以前以為耶穌是」複選（只有本人看得到）
    hasBurden: false,     // 「現在我覺得他是」留在他自己的手機上
    prayed: false,
    receivedVerse: false,
    cardDone: false,
    adjust: 0,
  };
  s.order.push(pid);
  return pid;
}

// ── 猜句子 ──────────────────────────────────────────────────────────────
// 一題一題開，開完馬上揭答案 —— 八題全部答完才對答案會變成考試。
// 揭答案的那一秒，猜對的人 +1。同一題揭兩次不會重複加分。
export function revealQuiz(s) {
  const i = s.quizIdx;
  const q = QUIZ[i];
  if (!q || openList(s).indexOf(i) >= 0) return false;
  s.quizOpen.push(i);
  alive(s).forEach((p) => {
    if (p.outer === null) return;
    if (arr(p.answers)[i] === q.answer) {
      p.outer = clamp(p.outer + QUIZ_PLUS);
      p.correct = (p.correct || 0) + 1;
    }
  });
  return true;
}

// 一顆按鈕按到底：還沒揭就揭答案，揭過了才換下一題。
// **不要拆成兩顆** —— 現場一定會有人只按「下一題」，那一題的分數就沒算到。
export function quizStep(s) {
  if (openList(s).indexOf(s.quizIdx) < 0) return revealQuiz(s);
  if (s.quizIdx < QUIZ.length - 1) { s.quizIdx += 1; return true; }
  return false;
}

// 回上一題。揭過的還是揭過的 —— 分數不會因為回頭再算一次。
export function quizPrev(s) {
  if (s.quizIdx <= 0) return false;
  s.quizIdx -= 1;
  return true;
}

export function quizGoto(s, i) {
  s.quizIdx = Math.max(0, Math.min(QUIZ.length - 1, Math.floor(Number(i) || 0)));
  return true;
}

// ── 爬梯子 ──────────────────────────────────────────────────────────────
// 爬四階往上，最後一階踩空掉下來。**淨值一定是正的** ——
// 爬上去再掉下來，你還是比原來高一點：人自己努力是有價值的，只是到不了。
// 這一關不准把任何人打到比進場低。
export function climb(s) {
  if (s.climbed) return false;
  s.climbed = true;
  alive(s).forEach((p) => {
    const l = ladderOf(p.road);
    if (!l || p.outer === null) return;
    p.climbGain = l.climb;
    p.climbFall = l.fall;
    p.outer = clamp(p.outer + l.climb - l.fall);
  });
  return true;
}

// 第 10 頁：全場每一個人 +15。翻到那一頁就發，不綁任何按鈕 ——
// 一綁上就變成用分數換恩典。只發一次。
export function payDebt(s) {
  if (s.paid) return false;
  s.paid = true;
  alive(s).forEach((p) => {
    if (p.outer === null) return;
    p.outer = clamp(p.outer + PAID_PLUS);
    p.paid = PAID_PLUS;
  });
  return true;
}

// ── 階段切換 ────────────────────────────────────────────────────────────
export function enterPhase(s, idx) {
  s.phaseIdx = Math.max(0, Math.min(PHASES.length - 1, idx));
  const id = phaseId(s);
  // 走到哪一頁，機制就跟著發生。爬梯子例外 —— 那要主持人親手按「開始爬」。
  if (id === 'paid') payDebt(s);
  if (id === 'way') s.wayStep = s.wayStep || 0;
  return null;
}

// ── 玩家動作 ────────────────────────────────────────────────────────────
export function applyAction(s, pid, msg) {
  const p = s.players[pid];
  if (!p) return null;
  switch (msg.type) {
    // 接關：幸福指數照卡片上打，第二條線也照卡片上打。
    // 忘記帶卡片的人才改用「這是你第幾次來」估。
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
      // 「這條線不是比賽，它從你來的第一天開始長。」
      p.newcomer = p.inner === 0;
      if (p.newcomer) p.inner = NEWCOMER_INNER;
      p.innerStart = p.inner;
      break;
    }
    // 猜句子：三選一。揭答案之前隨時可以改，揭了就定了。
    case 'quiz': {
      const i = Math.max(0, Math.min(QUIZ.length - 1, Math.floor(Number(msg.idx))));
      if (openList(s).indexOf(i) >= 0) break;
      const v = Math.floor(Number(msg.value));
      if (!(v >= 0 && v < QUIZ[i].options.length)) break;
      const a = arr(p.answers).slice();
      a[i] = v;
      p.answers = a;
      break;
    }
    // 罪那一頁：複選。**不加分、不扣分、不評分。**
    case 'sins': {
      const ids = arr(msg.ids).map(Number)
        .filter((x, i, list) => x >= 0 && x < SINS.length && list.indexOf(x) === i);
      p.sins = ids;
      break;
    }
    // 選一條路。爬完就不能改了。
    case 'road': {
      if (!roadsOpen(s)) break;
      p.road = ladderOf(msg.id) ? msg.id : null;
      break;
    }
    case 'verse':
      if (!p.receivedVerse) { p.receivedVerse = true; grow(p, INNER_VERSE); }
      break;
    // 祝福禱告。上面複選「以前」，下面自己寫「現在」——
    // 那句話留在玩家自己的手機上，這裡只收「有沒有寫」和那幾個選項。
    case 'burden': {
      p.whois = arr(msg.whois).map(Number)
        .filter((x, i, list) => x >= 0 && x < WHOIS.options.length && list.indexOf(x) === i);
      p.hasBurden = !!msg.has;
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
    case 'quizStep': quizStep(s); return null;
    case 'quizPrev': quizPrev(s); return null;
    case 'quizReveal': revealQuiz(s); return null;
    case 'quizGoto': quizGoto(s, msg.idx); return null;
    // 揭曉那一頁分兩段：先八題排開，再「你早就在用他了」
    case 'revealStep': s.revealStep = Math.min(1, (s.revealStep || 0) + 1); return null;
    // 三條梯子一起往上爬。爬完停在同一個高度 —— 不夠。
    case 'climb': climb(s); return null;
    // 救恩之路那一頁分三段點出來，不要一次全亮
    case 'wayStep': s.wayStep = Math.max(0, Math.min(2, (s.wayStep || 0) + 1)); return null;
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
// 還沒揭答案的題目**不送出正確答案** —— 送出去就等於把答案印在手機上。
function quizView(s) {
  const open = openList(s);
  const i = s.quizIdx;
  const q = QUIZ[i];
  const revealed = open.indexOf(i) >= 0;
  const counts = q.options.map((_, k) =>
    alive(s).filter((p) => arr(p.answers)[i] === k).length);
  const row = {
    idx: i,
    total: QUIZ.length,
    text: q.text,
    options: q.options,
    revealed,
    answered: alive(s).filter((p) => typeof arr(p.answers)[i] === 'number').length,
    counts,
  };
  if (revealed) {
    row.answer = q.answer;
    row.src = q.src || '';
    row.jesus = !!q.jesus;
  }
  return row;
}

// 揭曉那一頁：八題全部攤開，哪幾句是他說的。
function boardView(s) {
  const open = openList(s);
  return QUIZ.map((q, i) => ({
    text: q.text,
    by: q.options[q.answer],
    jesus: !!q.jesus,
    open: open.indexOf(i) >= 0,
  }));
}

function laddersView(s) {
  const ps = alive(s);
  return LADDERS.map((l) => ({
    id: l.id, name: l.name, sub: l.sub, steps: l.steps,
    climb: l.climb, fall: l.fall,
    who: ps.filter((p) => p.road === l.id).map((p) => p.name),
    n: ps.filter((p) => p.road === l.id).length,
  }));
}

function sinCounts(s) {
  return SINS.map((_, i) => alive(s).filter((p) => arr(p.sins).indexOf(i) >= 0).length);
}

function common(s) {
  return {
    week: 3,
    phase: PHASES[s.phaseIdx],
    phaseIdx: s.phaseIdx,
    quiz: quizView(s),
    board: boardView(s),
    traces: TRACES,
    reveal: REVEAL,
    sins: SINS,
    sinAsk: SIN_ASK,
    sinTeach: SIN_TEACH,
    judge: JUDGE,
    ladders: laddersView(s),
    roads: ROADS,
    goal: GOAL,
    verse: VERSE,
    way: WAY,
    revealStep: s.revealStep || 0,
    wayStep: s.wayStep || 0,
    paidInfo: PAID,
    paidPlus: PAID_PLUS,
    baptism: BAPTISM,
    whois: WHOIS,
    climbed: !!s.climbed,
    paid: !!s.paid,
    roadsOpen: roadsOpen(s),
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
      answered: typeof arr(p.answers)[s.quizIdx] === 'number',
      correct: p.correct || 0,
      road: p.road,
      climbGain: p.climbGain || 0, climbFall: p.climbFall || 0,
      sinsDone: arr(p.sins).length > 0,
      hasBurden: !!p.hasBurden,
      receivedVerse: !!p.receivedVerse, cardDone: !!p.cardDone, adjust: p.adjust || 0,
    })),
    stats: {
      count: ps.length,
      reconnected: sc.length,
      newcomers: ps.filter((p) => p.newcomer).length,
      answered: ps.filter((p) => typeof arr(p.answers)[s.quizIdx] === 'number').length,
      quizDone: openList(s).length,
      quizTotal: QUIZ.length,
      sinsDone: ps.filter((p) => arr(p.sins).length > 0).length,
      sinCounts: sinCounts(s),
      roadsPicked: ps.filter((p) => p.road).length,
      outerAvg: outers.length ? Math.round(outers.reduce((a, b) => a + b, 0) / outers.length) : null,
      startAvg: starts.length ? Math.round(starts.reduce((a, b) => a + b, 0) / starts.length) : null,
      innerAvg: ps.length ? Math.round(ps.reduce((a, b) => a + (b.inner || 0), 0) / ps.length) : 0,
      innerStartAvg: sc.length ? Math.round(sc.reduce((a, b) => a + (b.innerStart || 0), 0) / sc.length) : null,
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
    room: roomCode,
    ...common(s),
    playerCount: alive(s).length,
    // 手機在等別人的時候要看得到進度。只有人數，不含任何人的答案。
    reconnected: alive(s).filter((x) => x.outer !== null).length,
    answered: alive(s).filter((x) => typeof arr(x.answers)[s.quizIdx] === 'number').length,
    sinsDone: alive(s).filter((x) => arr(x.sins).length > 0).length,
    roadsPicked: alive(s).filter((x) => x.road).length,
  };
  if (!p) return { ...base, me: null };
  return {
    ...base,
    me: {
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart,
      inner: p.inner || 0, innerCap: INNER_CAP,
      visits: p.visits, newcomer: p.newcomer,
      answers: arr(p.answers), correct: p.correct || 0,
      road: p.road, climbGain: p.climbGain || 0, climbFall: p.climbFall || 0,
      sins: arr(p.sins),
      paid: p.paid || 0,
      whois: arr(p.whois),
      hasBurden: !!p.hasBurden, prayed: !!p.prayed,
      receivedVerse: !!p.receivedVerse, cardDone: !!p.cardDone,
    },
  };
}

// 第三關沒有計時的東西 —— 房間的鬧鐘只用在清空。
