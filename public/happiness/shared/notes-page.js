// 主持人備忘錄。跑在主持人自己的手機上，跟大螢幕連同一個房間。
// 七關共用這一支，內容來自各關的 wN/notes.js（window.WEEK_NOTES）。
//
// 為什麼要有這一頁：主持提示本來印在大螢幕上，但那是寫給主持人自己看的字，
// 全場都看得到就很怪。搬到你手機上，大螢幕就只剩下要給房間看的東西。
(function () {
  'use strict';
  var N = window.WEEK_NOTES || {};
  var WEEK = N.week || 1;
  var S = null, conn = null, sig = '';
  var ROOM = Room.readCode();

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var el = function (id) { return document.getElementById(id); };
  function post(cmd, extra) { if (conn) conn.host(cmd, extra); }

  var KIND = {
    say:  { label: '念', cls: 'say' },
    do:   { label: '做', cls: 'do' },
    warn: { label: '別', cls: 'warn' },
  };

  function render() {
    if (!S) return;

    el('wk').textContent = '第 ' + WEEK + ' 關 · ' + (N.title || '');
    el('tag').textContent = S.phase.tag;
    el('title').textContent = S.phase.title;
    el('pos').textContent = (S.phaseIdx + 1) + ' / ' + S.phases.length;

    var n = N[S.phase.id];
    var live = n && n.count ? n.count(S.stats) : (S.stats.count + ' 人在場');
    el('live').textContent = live || '';

    // 拍賣進行中，把大螢幕底下那排控制鈕搬過來 —— 主持人拿著手機在走動，
    // 不會想為了按「立即開標」跑回電腦前面。
    var auc = el('auction');
    var isAuction = S.phase.id === 'auction' && S.auction;
    if (auc) auc.hidden = !isAuction;
    if (auc && isAuction) {
      el('waitbtn').textContent = '每項之間等我：' + (S.auction.waitForHost ? '開' : '關');
      el('nextlot').textContent = S.auction.status === 'bidding' ? '立即開標' : '下一項 →';
    }

    // 第二關的「三十年後」：十二張牌一張一張翻，主持人拿著手機也控得動。
    var flip = el('flipctl');
    var isFlip = S.phase.id === 'after30' && S.shelf;
    if (flip) {
      flip.hidden = !isFlip;
      if (isFlip) {
        var doneAll = S.shelf.flipped >= S.shelf.total;
        el('flipnext').textContent = doneAll ? '都翻完了' : '翻下一張（' + S.shelf.flipped + '/' + S.shelf.total + '）';
        el('flipnext').disabled = doneAll;
        el('flipall').disabled = doneAll;
      }
    }

    // 第三關的猜句子：一題一題揭答案，主持人拿著手機也控得動。
    var quizc = el('quizctl');
    if (quizc) {
      quizc.hidden = S.phase.id !== 'quiz' || !S.quiz;
      if (!quizc.hidden) {
        // 一顆按鈕按到底：還沒揭就是「揭曉答案」，揭過了才變「下一題」。
        var lastQ = S.quiz.idx >= S.quiz.total - 1;
        el('quizprev').disabled = S.quiz.idx <= 0;
        el('quizstep').textContent = !S.quiz.revealed
          ? '揭曉答案（' + (S.quiz.idx + 1) + '/' + S.quiz.total + '）'
          : (lastQ ? '最後一題' : '下一題 →（' + (S.quiz.idx + 2) + '/' + S.quiz.total + '）');
        el('quizstep').disabled = S.quiz.revealed && lastQ;
      }
    }

    // 第三關的人生模擬器：大家選完再往前走。
    var mapc = el('mapctl');
    if (mapc) {
      mapc.hidden = S.phase.id !== 'map' || !S.mapNow;
      if (!mapc.hidden) {
        var lastFork = S.mapNow.idx >= S.mapNow.total - 1;
        el('forkprev').disabled = S.mapNow.idx <= 0;
        el('forknext').textContent = lastFork
          ? '走完了，按下一頁'
          : '往前走 →（' + S.stats.forkPicked + '/' + S.stats.count + ' 已選）';
        el('forknext').disabled = lastFork;
      }
    }

    // 第三關的「藉著他到父那裡去」：一段一段點出來，不要一次全亮。
    var crossc = el('crossctl');
    if (crossc) {
      crossc.hidden = S.phase.id !== 'cross';
      if (!crossc.hidden) {
        el('crossstep').textContent = S.crossStep >= 2 ? '三段都出來了' : '下一段（' + ((S.crossStep || 0) + 1) + '/3）';
        el('crossstep').disabled = S.crossStep >= 2;
      }
    }

    // 第二關的寶箱：主持人拿著手機也能打開它。
    var giftc = el('giftctl');
    if (giftc) {
      giftc.hidden = S.phase.id !== 'gift';
      if (!giftc.hidden) {
        el('opengift').textContent = S.giftOpen ? '已經打開了' : '打開寶箱';
        el('opengift').disabled = !!S.giftOpen;
      }
    }

    var next = [S.phaseIdx, live].join('|');
    if (next === sig) return;
    sig = next;

    var body = el('body');
    if (!n) {
      body.innerHTML = '<p class="lead muted">這一頁沒有特別的提示。照著大螢幕走就好。</p>';
    } else {
      body.innerHTML =
        (n.lead ? '<p class="lead">' + esc(n.lead) + '</p>' : '') +
        (n.items || []).map(function (it) {
          var k = KIND[it.k] || KIND.do;
          return '<div class="item ' + k.cls + '">' +
            '<span class="k">' + k.label + '</span>' +
            '<p>' + esc(it.t) + '</p>' +
          '</div>';
        }).join('');
    }


    // 上一頁／下一頁在頁尾，拇指按得到 —— 主持人可以站起來走動
    el('prev').disabled = S.phaseIdx <= 0;
    el('next').disabled = S.phaseIdx >= S.phases.length - 1;
    el('nextlbl').textContent = S.phaseIdx >= S.phases.length - 1
      ? '最後一頁'
      : S.phases[S.phaseIdx + 1].title;
  }

  function start() {
    conn = Room.connect({
      role: 'host', week: WEEK, room: ROOM,
      onState: function (d) { S = d; render(); },
      onDrop: function () { el('live').textContent = '連線中斷，重連中…'; },
    });
    // 每一關的控制鈕不一樣（拍賣／翻牌／寶箱／猜句子／爬梯子），
    // 所以一律用 on() 綁 —— 這一關沒有的那顆按鈕就是不存在，不能直接 el(id).onclick。
    var on = function (id, fn) { var b = el(id); if (b) b.onclick = fn; };
    on('prev', function () { post('prev'); });
    on('next', function () { post('next'); });
    on('prevlot', function () { post('prevLot'); });
    on('nextlot', function () { post('nextLot'); });
    on('extend', function () { post('extend'); });
    on('waitbtn', function () { post('toggleWait'); });
    on('restart', function () {
      if (confirm('整場拍賣重跑？所有人的點數和標到的東西都會還原。')) post('restartAuction');
    });
    on('quizstep', function () { post('quizStep'); });
    on('quizprev', function () { post('quizPrev'); });
    on('forkprev', function () { post('forkPrev'); });
    on('forknext', function () { post('forkNext'); });
    on('crossstep', function () { post('crossStep'); });
    on('flipnext', function () { post('flipNext'); });
    on('flipall', function () {
      if (confirm('剩下的全部翻開？')) post('flipAll');
    });
    on('opengift', function () { post('openGift'); });
  }

  if (!ROOM) {
    el('app').innerHTML =
      '<div class="ask"><h1>主持人備忘錄</h1>' +
      '<p>輸入大螢幕上的四碼房號，這支手機就會跟著大螢幕走。</p>' +
      '<input id="rc" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="房號">' +
      '<button class="btn primary" id="rgo">連上</button>' +
      '<p class="hint">在大螢幕上按鍵盤的 <b>N</b> 會跳出這一頁的 QR，掃了就不用打字。</p></div>';
    var go = function () {
      var c = el('rc').value.toUpperCase().trim();
      if (!Room.CODE_RE.test(c)) { el('rc').focus(); return; }
      location.search = '?room=' + c;
    };
    el('rgo').onclick = go;
    el('rc').onkeydown = function (e) { if (e.key === 'Enter') go(); };
  } else {
    start();
  }
})();
