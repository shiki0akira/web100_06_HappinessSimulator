// 第三關「萬世巨星」的規則。純函式，不碰網路也不碰儲存。
//
// 這一關完全不依賴前兩關 —— 上一次沒來的人不會少玩到任何東西。
// 接過來的只有卡片上的兩條線。**第三關起第一次來的人，幸福根基直接給 15。**
//
// 一句話講完這一關：走三個岔路的人生模擬器（八個結局，分數刻意打亂），
// 講罪＝射不中，介紹萬世巨星，玩八題猜句子，最後藉著他到父那裡去。
import {
  FORKS, ENDINGS, MAP, SIN, STAR, TRACES,
  QUIZ, AFTERLIFE, LIFE, VERSE, CROSS, WHOIS,
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
  { id: 'map',       tag: '互動點 1', title: '人生模擬器 · 選一條路' },
  { id: 'endings',   tag: '結算頁',   title: '你走到哪裡' },
  { id: 'sin',       tag: '信息',     title: '為什麼我們做不出最好的選擇' },
  { id: 'star',      tag: '開場',     title: '萬世巨星' },
  { id: 'quiz',      tag: '互動點 2', title: '這句話是誰說的' },
  { id: 'answers',   tag: '解答',     title: '八題的答案' },
  { id: 'reveal',    tag: '揭曉',     title: '就是這一位' },
  { id: 'afterlife', tag: '互動點 3', title: '天堂和地獄' },
  { id: 'life',      tag: '信息',     title: '永生的生命' },
  { id: 'verse',     tag: '經文',     title: '領受經文' },
  { id: 'cross',     tag: '高潮',     title: '藉著他到父那裡去' },
  { id: 'prayer',    tag: '互動點 4', title: '祝福禱告' },
  { id: 'card',      tag: '週卡',     title: '儲存模擬回憶' },
  { id: 'end',       tag: '預告',     title: '下週預告' },
];

const phaseId = (s) => (PHASES[s.phaseIdx] || PHASES[0]).id;
// 岔路只有那一頁在開，而且走過的岔路不能回頭改 —— 「你算不到結果」靠它。
const mapOpen = (s) => phaseId(s) === 'map';

export function createState() {
  return {
    week: 3,
    phaseIdx: 0,
    players: {},
    order: [],
    forkIdx: 0,          // 現在走到第幾個岔路（0–2）
    walked: false,       // 八個結局結算過了沒
    quizIdx: 0,          // 猜句子開到第幾題
    quizOpen: [],        // 哪幾題已經揭答案了
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
const openList = (s) => (Array.isArray(s.quizOpen) ? s.quizOpen : (s.quizOpen = []));
const pathOf = (p) => arr(p.path).join('');
const endingOf = (key) => ENDINGS.find((e) => e.path === key) || null;

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
    path: [],             // 三個岔路各選了 A 還是 B
    gain: 0,              // 結局加了幾分
    answers: [],          // 八題各選了哪一個（不加分，只是他自己的記錄）
    correct: 0,
    vote: null,           // 天堂和地獄
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

// ── 人生模擬器 ──────────────────────────────────────────────────────────
// 三個岔路，主持人按「往前走」才推進。走過的不能回頭改。
export function forkNext(s) {
  if (s.forkIdx >= FORKS.length - 1) return false;
  s.forkIdx += 1;
  return true;
}

export function forkPrev(s) {
  if (s.forkIdx <= 0) return false;
  s.forkIdx -= 1;
  return true;
}

// 走到結局那一頁才結算。**每一條都是加分，沒有人會掉** ——
// 這一關接在被打到低點的第二關之後，全場往上是這一關的語氣。
export function walk(s) {
  if (s.walked) return false;
  s.walked = true;
  alive(s).forEach((p) => {
    const e = endingOf(pathOf(p));
    if (!e || p.outer === null) return;
    p.gain = e.gain;
    p.outer = clamp(p.outer + e.gain);
  });
  return true;
}

// ── 猜句子 ──────────────────────────────────────────────────────────────
// 一題一題開，開完馬上揭答案。**這一頁不加分** —— 幸福指數整晚只有地圖會動。
export function revealQuiz(s) {
  const i = s.quizIdx;
  const q = QUIZ[i];
  if (!q || openList(s).indexOf(i) >= 0) return false;
  s.quizOpen.push(i);
  alive(s).forEach((p) => {
    if (arr(p.answers)[i] === q.answer) p.correct = (p.correct || 0) + 1;
  });
  return true;
}

// 一顆按鈕按到底：還沒揭就揭答案，揭過了才換下一題。
// **不要拆成兩顆** —— 現場一定會有人只按「下一題」，那一題就沒揭到。
export function quizStep(s) {
  if (openList(s).indexOf(s.quizIdx) < 0) return revealQuiz(s);
  if (s.quizIdx < QUIZ.length - 1) { s.quizIdx += 1; return true; }
  return false;
}

export function quizPrev(s) {
  if (s.quizIdx <= 0) return false;
  s.quizIdx -= 1;
  return true;
}

// ── 階段切換 ────────────────────────────────────────────────────────────
export function enterPhase(s, idx) {
  s.phaseIdx = Math.max(0, Math.min(PHASES.length - 1, idx));
  const id = phaseId(s);
  // 走到結局那一頁就結算。爬不回頭 —— 翻走再翻回來不會重算。
  if (id === 'endings') walk(s);
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
    // 岔路：A 或 B。主持人按「往前走」之前隨時可以改，走過的不能回頭。
    case 'fork': {
      if (!mapOpen(s) || s.walked) break;
      const i = Math.max(0, Math.min(FORKS.length - 1, Math.floor(Number(msg.idx))));
      if (i !== s.forkIdx) break;
      const v = msg.value === 'B' ? 'B' : 'A';
      const a = arr(p.path).slice();
      a[i] = v;
      p.path = a;
      break;
    }
    // 猜句子：三選一。揭答案之前隨時可以改，揭了就定了。**不加分。**
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
    // 天堂和地獄。沒有標準答案，**不加分**。
    case 'vote':
      p.vote = Math.max(0, Math.min(AFTERLIFE.options.length - 1, Math.floor(Number(msg.value))));
      break;
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
    case 'forkNext': forkNext(s); return null;
    case 'forkPrev': forkPrev(s); return null;
    case 'quizStep': quizStep(s); return null;
    case 'quizPrev': quizPrev(s); return null;
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
// 還沒走完就**不送出結局的文字和分數** —— 送出去等於把答案印在手機上。
function mapView(s) {
  const ps = alive(s);
  const i = s.forkIdx;
  const f = FORKS[i];
  return {
    idx: i,
    total: FORKS.length,
    age: f.age,
    a: f.a, b: f.b,
    picked: ps.filter((p) => arr(p.path)[i]).length,
    counts: {
      A: ps.filter((p) => arr(p.path)[i] === 'A').length,
      B: ps.filter((p) => arr(p.path)[i] === 'B').length,
    },
    // 走過的岔路攤開誰走了哪一邊 —— 那是地圖的形狀
    trail: FORKS.map((ff, k) => (k < i || s.walked ? {
      age: ff.age,
      a: ps.filter((p) => arr(p.path)[k] === 'A').map((p) => p.name),
      b: ps.filter((p) => arr(p.path)[k] === 'B').map((p) => p.name),
    } : null)),
  };
}

// 結局頁：八條全部攤開。**只看自己那一條是運氣，八條一起看才是「沒有規則」。**
function endingsView(s) {
  const ps = alive(s);
  const shown = s.walked;
  return ENDINGS.map((e) => ({
    path: e.path,
    // 短標籤：穩定 → 加班 → 投資
    steps: e.path.split('').map((c, k) => (c === 'A' ? FORKS[k].a.short : FORKS[k].b.short)),
    text: shown ? e.text : '',
    gain: shown ? e.gain : null,
    who: ps.filter((p) => pathOf(p) === e.path).map((p) => p.name),
  }));
}

function quizView(s) {
  const open = openList(s);
  const i = s.quizIdx;
  const q = QUIZ[i];
  const revealed = open.indexOf(i) >= 0;
  const row = {
    idx: i,
    total: QUIZ.length,
    text: q.text,
    options: q.options,
    revealed,
    answered: alive(s).filter((p) => typeof arr(p.answers)[i] === 'number').length,
    counts: q.options.map((_, k) => alive(s).filter((p) => arr(p.answers)[i] === k).length),
  };
  if (revealed) {
    row.answer = q.answer;
    row.src = q.src || '';
    row.jesus = !!q.jesus;
  }
  return row;
}

function boardView(s) {
  const open = openList(s);
  return QUIZ.map((q, i) => ({
    text: q.text,
    by: q.options[q.answer],
    jesus: !!q.jesus,
    open: open.indexOf(i) >= 0,
  }));
}

function voteCounts(s) {
  const c = new Array(AFTERLIFE.options.length).fill(0);
  alive(s).forEach((p) => { if (typeof p.vote === 'number') c[p.vote] += 1; });
  return c;
}

// 誰投了哪一個。主持人要知道誰選了「沒有想過」—— 第六關決志的時候用得到。
function voteWho(s) {
  return AFTERLIFE.options.map((_, i) =>
    alive(s).filter((p) => p.vote === i).map((p) => p.name));
}

function common(s) {
  return {
    week: 3,
    phase: PHASES[s.phaseIdx],
    phaseIdx: s.phaseIdx,
    forks: FORKS,
    map: MAP,
    mapNow: mapView(s),
    endings: endingsView(s),
    walked: !!s.walked,
    sin: SIN,
    star: STAR,
    traces: TRACES,
    quiz: quizView(s),
    board: boardView(s),
    afterlife: AFTERLIFE,
    life: LIFE,
    verse: VERSE,
    cross: CROSS,
    whois: WHOIS,
    mapOpen: mapOpen(s),
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
      path: arr(p.path), gain: p.gain || 0,
      answered: typeof arr(p.answers)[s.quizIdx] === 'number',
      correct: p.correct || 0,
      vote: typeof p.vote === 'number' ? p.vote : null,
      hasBurden: !!p.hasBurden,
      receivedVerse: !!p.receivedVerse, cardDone: !!p.cardDone, adjust: p.adjust || 0,
    })),
    stats: {
      count: ps.length,
      reconnected: sc.length,
      newcomers: ps.filter((p) => p.newcomer).length,
      forkPicked: ps.filter((p) => arr(p.path)[s.forkIdx]).length,
      answered: ps.filter((p) => typeof arr(p.answers)[s.quizIdx] === 'number').length,
      voted: ps.filter((p) => typeof p.vote === 'number').length,
      voteCounts: voteCounts(s),
      voteWho: voteWho(s),
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
    forkPicked: alive(s).filter((x) => arr(x.path)[s.forkIdx]).length,
    answered: alive(s).filter((x) => typeof arr(x.answers)[s.quizIdx] === 'number').length,
    voted: alive(s).filter((x) => typeof x.vote === 'number').length,
  };
  if (!p) return { ...base, me: null };
  const e = s.walked ? endingOf(pathOf(p)) : null;
  return {
    ...base,
    me: {
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart,
      inner: p.inner || 0, innerCap: INNER_CAP,
      visits: p.visits, newcomer: p.newcomer,
      path: arr(p.path),
      gain: p.gain || 0,
      ending: e ? { text: e.text, gain: e.gain } : null,
      answers: arr(p.answers), correct: p.correct || 0,
      vote: typeof p.vote === 'number' ? p.vote : null,
      whois: arr(p.whois),
      hasBurden: !!p.hasBurden, prayed: !!p.prayed,
      receivedVerse: !!p.receivedVerse, cardDone: !!p.cardDone,
    },
  };
}

// 第三關沒有計時的東西 —— 房間的鬧鐘只用在清空。
