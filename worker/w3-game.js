// 第三關「萬世巨星」的規則。純函式，不碰網路也不碰儲存。
//
// 這一關完全不依賴前兩關 —— 上一次沒來的人不會少玩到任何東西。
// 接過來的只有卡片上的兩條線。**第三關起第一次來的人，幸福根基直接給 15。**
//
// 一句話講完這一關：走五個岔路的人生模擬器（三十二個結局，一正一負當場公布），
// 講罪＝射不中，介紹萬世巨星，玩八題猜句子，最後藉著他到父那裡去。
import {
  FORKS, ENDINGS, MAP, SIN, WHY, STAR, TRACES,
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
  { id: 'endings',   tag: '結算頁',   title: '三十二種人生' },
  { id: 'sin',       tag: '信息',     title: '為什麼我們做不出最好的選擇？' },
  { id: 'why',       tag: '信息',     title: '因為兩件事' },
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
    forkIdx: 0,          // 現在走到第幾個岔路（0–4）
    forkOpen: [],        // 哪幾個岔路已經公布結果了（公布的那一刻才動分數）
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
const openForks = (s) => (Array.isArray(s.forkOpen) ? s.forkOpen : (s.forkOpen = []));
const forkShown = (s, i) => openForks(s).indexOf(i) >= 0;
// 五個岔路都公布完了才算走完 —— 結局那一頁靠它決定要不要印名字。
const mapDone = (s) => openForks(s).length >= FORKS.length;
const pathOf = (p) => arr(p.path).join('');
const endingOf = (key) => ENDINGS.find((e) => e.path === key) || null;
// 一條路的總分就是那五個選擇的加減總和，算出來的，不另外寫一張表。
const pathTotal = (key) => String(key).split('')
  .reduce((sum, c, k) => sum + (c === 'A' ? FORKS[k].a.delta : FORKS[k].b.delta), 0);

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
    path: [],             // 五個岔路各選了 A 還是 B
    deltas: [],           // 五個岔路各加減了幾分（公布的那一刻寫進來）
    gain: 0,              // 五個岔路的加減總和，可能是負的
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
// 五個岔路。每一個都是：大家選（隨時可以改）→ 主持人按「公布結果」
// （兩邊的結果同時翻出來，分數在這一刻才動）→ 按「往前走」進下一個。
// 公布過的那一個不能回頭改 —— 「你算不到結果」靠它。

// 公布：一個加分、一個扣分，兩邊同時翻。**沒選的人不動分數。**
export function revealFork(s) {
  const i = s.forkIdx;
  const f = FORKS[i];
  if (!f || forkShown(s, i)) return false;
  s.forkOpen.push(i);
  alive(s).forEach((p) => {
    const c = arr(p.path)[i];
    if (!c || p.outer === null) return;
    const d = c === 'B' ? f.b.delta : f.a.delta;
    const ds = arr(p.deltas).slice();
    ds[i] = d;
    p.deltas = ds;
    p.gain = (p.gain || 0) + d;
    p.outer = clamp(p.outer + d);
  });
  return true;
}

// 一顆按鈕按到底：還沒公布就公布，公布過了才換下一個岔路。
// **不要拆成兩顆** —— 現場一定會有人只按「往前走」，那一關就沒公布到。
export function forkStep(s) {
  if (!forkShown(s, s.forkIdx)) return revealFork(s);
  if (s.forkIdx < FORKS.length - 1) { s.forkIdx += 1; return true; }
  return false;
}

export function forkPrev(s) {
  if (s.forkIdx <= 0) return false;
  s.forkIdx -= 1;
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
// 分數在「公布結果」那一刻就動完了，翻頁不再結算任何東西。
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
    // 岔路：A 或 B。主持人按「公布結果」之前隨時可以改來改去，公布了就定了。
    case 'fork': {
      if (!mapOpen(s)) break;
      const i = Math.max(0, Math.min(FORKS.length - 1, Math.floor(Number(msg.idx))));
      if (i !== s.forkIdx || forkShown(s, i)) break;
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
    case 'forkStep': forkStep(s); return null;
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
// 還沒公布就**不送出那一格的 delta 和結果** —— 送出去等於把答案印在手機上。
function sideView(s, i, key) {
  const f = FORKS[i][key];
  const shown = forkShown(s, i);
  return {
    short: f.short,
    text: f.text,
    delta: shown ? f.delta : null,
    result: shown ? f.result : '',
    who: alive(s).filter((p) => arr(p.path)[i] === (key === 'a' ? 'A' : 'B')).map((p) => p.name),
  };
}

function mapView(s) {
  const ps = alive(s);
  const i = s.forkIdx;
  return {
    idx: i,
    total: FORKS.length,
    age: FORKS[i].age,
    revealed: forkShown(s, i),
    // 選了就馬上出現在大螢幕上 —— 誰站在哪一邊，全場看得到。
    a: sideView(s, i, 'a'),
    b: sideView(s, i, 'b'),
    picked: ps.filter((p) => arr(p.path)[i]).length,
    // 公布過的岔路留在上面，那是地圖的形狀。只留人數和加減，不留名字 ——
    // 名字在下面那兩格已經有了，上面再排一次會把這一頁擠爆。
    trail: FORKS.map((ff, k) => (forkShown(s, k) ? {
      age: ff.age,
      a: { short: ff.a.short, delta: ff.a.delta, n: ps.filter((p) => arr(p.path)[k] === 'A').length },
      b: { short: ff.b.short, delta: ff.b.delta, n: ps.filter((p) => arr(p.path)[k] === 'B').length },
    } : null)),
  };
}

// 結局頁：三十二條全部攤開。**只看自己那一條是運氣，三十二條一起看才是「沒有規則」。**
// 有人走到的排最上面，走的人越多越上面。
function endingsView(s) {
  const ps = alive(s);
  const rows = ENDINGS.map((e) => ({
    path: e.path,
    // 短標籤：打工 → 接下 → 投資 → 留下 → 回家
    steps: e.path.split('').map((c, k) => (c === 'A' ? FORKS[k].a.short : FORKS[k].b.short)),
    text: e.text,
    total: pathTotal(e.path),
    who: ps.filter((p) => pathOf(p) === e.path).map((p) => p.name),
  }));
  // 有人走到的先排，人多的在前面；剩下的維持原本的順序。
  return rows
    .map((r, i) => ({ r, i }))
    .sort((x, y) => (y.r.who.length - x.r.who.length) || (x.i - y.i))
    .map((x) => x.r);
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
    mapDone: mapDone(s),
    sin: SIN,
    why: WHY,
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
      path: arr(p.path), deltas: arr(p.deltas), gain: p.gain || 0,
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
  // 五個岔路都公布完了才給他結局的文字 —— 提早送出就是把答案印在他手機上。
  const e = mapDone(s) ? endingOf(pathOf(p)) : null;
  return {
    ...base,
    me: {
      pid: p.pid, name: p.name,
      outer: p.outer, outerStart: p.outerStart,
      inner: p.inner || 0, innerCap: INNER_CAP,
      visits: p.visits, newcomer: p.newcomer,
      path: arr(p.path),
      deltas: arr(p.deltas),
      gain: p.gain || 0,
      ending: e ? { text: e.text, total: pathTotal(e.path) } : null,
      answers: arr(p.answers), correct: p.correct || 0,
      vote: typeof p.vote === 'number' ? p.vote : null,
      whois: arr(p.whois),
      hasBurden: !!p.hasBurden, prayed: !!p.prayed,
      receivedVerse: !!p.receivedVerse, cardDone: !!p.cardDone,
    },
  };
}

// 第三關沒有計時的東西 —— 房間的鬧鐘只用在清空。
