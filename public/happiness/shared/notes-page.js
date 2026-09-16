// 主持人備忘錄。跑在主持人自己的手機上，跟大螢幕連同一個房間。
// 七關共用這一支，內容來自各關的 wN/notes.js（window.WEEK_NOTES）。
//
// 為什麼要有這一頁：主持提示本來印在大螢幕上，但那是寫給主持人自己看的字，
// 全場都看得到就很怪。搬到你手機上，大螢幕就只剩下要給房間看的東西。
(function () {
  'use strict';
  var N = window.WEEK_NOTES || {};
  // ⚠️ 沒有 WEEK_NOTES 就**不要連線**。以前這裡是 `N.week || 1`，
  // 結果某一關的 notes.js 打錯一個逗號，備忘錄就安安靜靜連到第一關的房間、
  // 照著第一關的流程走 —— 現場看到的是「怎麼變成第一關了」，完全猜不到是語法錯誤。
  var WEEK = N.week || 0;
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

    // 第三關的人生模擬器：大家選完你才公布結果，公布完再往前走。
    var mapc = el('mapctl');
    if (mapc) {
      mapc.hidden = S.phase.id !== 'map' || !S.mapNow;
      if (!mapc.hidden) {
        // 一顆按鈕按到底：還沒公布就是「公布結果」，公布過了才變「往前走」。
        var lastFork = S.mapNow.idx >= S.mapNow.total - 1;
        el('forkprev').disabled = S.mapNow.idx <= 0;
        el('forkstep').textContent = !S.mapNow.revealed
          ? '公布結果（' + S.stats.forkPicked + '/' + S.stats.count + ' 已選）'
          : (lastFork ? '走完了，按下一頁' : '往前走 →（' + (S.mapNow.idx + 2) + '/' + S.mapNow.total + '）');
        el('forkstep').disabled = S.mapNow.revealed && lastFork;
      }
    }

    // 第四關的「你會怎麼做」：大家勾完你才公布，公布完再開下一題。
    var callc = el('callctl');
    if (callc) {
      callc.hidden = S.phase.id !== 'calls' || !S.callsNow;
      if (!callc.hidden) {
        // 一顆按鈕按到底：還沒公布就是「公布結果」，公布過了才變「下一題」。
        var lastCall = S.callsNow.idx >= S.callsNow.total - 1;
        el('callprev').disabled = S.callsNow.idx <= 0;
        el('callstep').textContent = !S.callsNow.revealed
          ? '公布結果（' + S.stats.callPicked + '/' + S.stats.count + ' 已選）'
          : (lastCall ? '都公布了，按下一頁' : '下一題 →（' + (S.callsNow.idx + 2) + '/' + S.callsNow.total + '）');
        el('callstep').disabled = S.callsNow.revealed && lastCall;
      }
    }

    // 第四關的第三通：有人手機掛了、或者就是不按，讓大螢幕接通。
    // **這顆只動大螢幕**，每個人自己那一下還是要他自己按。
    var dialc = el('dialctl');
    if (dialc) {
      dialc.hidden = S.phase.id !== 'hotline' || !S.hotlineNow;
      if (!dialc.hidden) {
        el('connectnow').textContent = S.hotlineNow.connected
          ? '已接通'
          : '全場接通（' + S.hotlineNow.dialed + '/' + S.hotlineNow.total + ' 已撥）';
        el('connectnow').disabled = S.hotlineNow.connected;
      }
    }

    // 第五關的敲門人生：大家選完你才公布，公布完再開下一次敲門。
    var knockc = el('knockctl');
    if (knockc) {
      knockc.hidden = S.phase.id !== 'knocks' || !S.knockNow;
      if (!knockc.hidden) {
        var lastKnock = S.knockNow.idx >= S.knockNow.total - 1;
        el('knockprev').disabled = S.knockNow.idx <= 0;
        el('knockstep').textContent = !S.knockNow.revealed
          ? '公布結果（' + S.stats.knockPicked + '/' + S.stats.count + ' 已選）'
          : (lastKnock ? '都公布了，按下一頁' : '下一次敲門 →（' + (S.knockNow.idx + 2) + '/' + S.knockNow.total + '）');
        el('knockstep').disabled = S.knockNow.revealed && lastKnock;
      }
    }

    // 第五關的彩蛋：有人手機沒電，讓大螢幕翻過去。**這顆只動大螢幕。**
    var eggc = el('eggctl');
    if (eggc) {
      eggc.hidden = S.phase.id !== 'egg' || !S.eggNow;
      if (!eggc.hidden) {
        el('opennow').textContent = S.eggNow.done
          ? '已經翻過去了'
          : '全場開門（' + S.eggNow.opened + '/' + S.eggNow.total + ' 已開）';
        el('opennow').disabled = S.eggNow.done;
      }
    }

    // 第五關的「我認識的上帝」：卡片一張一張翻到背面。
    var seekc = el('seekctl');
    if (seekc) {
      seekc.hidden = S.phase.id !== 'seek' || !S.seekOpen;
      if (!seekc.hidden) {
        var sOpen = S.seekOpen.filter(Boolean).length;
        el('seeknext').textContent = sOpen >= S.seekOpen.length
          ? '都翻開了'
          : '翻下一張（' + (sOpen + 1) + '/' + S.seekOpen.length + '）';
        el('seeknext').disabled = sOpen >= S.seekOpen.length;
      }
    }

    // 第六關的抽一張：大家抽完你才公布（公布的那一刻才扣分）。
    var pickc = el('pickctl');
    if (pickc) {
      pickc.hidden = S.phase.id !== 'draw' || !S.cardsNow;
      if (!pickc.hidden) {
        el('pickreveal').textContent = S.cardsNow.open
          ? '已經公布了'
          : '公布結果（' + S.stats.picked + '/' + S.stats.count + ' 已抽）';
        el('pickreveal').disabled = S.cardsNow.open;
      }
    }

    // 第六關的大魔王：統計念完，前三名合體。
    var mergec = el('mergectl');
    if (mergec) {
      mergec.hidden = S.phase.id !== 'boss' || !S.bossNow;
      if (!mergec.hidden) {
        el('bossmerge').textContent = S.bossNow.merged ? '已經合體了' : '合體（前三名 → 大魔王）';
        el('bossmerge').disabled = S.bossNow.merged;
      }
    }

    // 第六關的靠自己打：大家出招完你才公布，公布完再開下一回合。
    var fightc = el('fightctl');
    if (fightc) {
      fightc.hidden = S.phase.id !== 'fight' || !S.fightNow;
      if (!fightc.hidden) {
        var lastF = S.fightNow.round >= S.fightNow.total - 1;
        el('fightprev').disabled = S.fightNow.round <= 0;
        el('fightstep').textContent = !S.fightNow.revealed
          ? '公布結果（' + S.stats.moved + '/' + S.stats.count + ' 已出招）'
          : (lastF ? '都打完了，按下一頁' : '下一回合 →（' + (S.fightNow.round + 2) + '/' + S.fightNow.total + '）');
        el('fightstep').disabled = S.fightNow.revealed && lastF;
      }
    }

    // 第六關的十字架：四段一段一段走。**每一段的停頓都不准省。**
    var crossc = el('crossctl');
    if (crossc) {
      crossc.hidden = S.phase.id !== 'cross';
      if (!crossc.hidden) {
        var st = S.crossStep || 0;
        var LBL = ['下一步（他走到最前面）', '下一步（三天）', '下一步（復活）', '走完了，按下一頁'];
        el('crossback').disabled = st <= 0;
        el('crossnext').textContent = LBL[st];
        el('crossnext').disabled = st >= 3;
      }
    }

    // 第六關的在生活中得勝：你按「出招」才抽人；能量條一格一個被打中的人。
    var togc = el('togetherctl');
    if (togc) {
      togc.hidden = S.phase.id !== 'together' || !S.togetherNow;
      if (!togc.hidden) {
        var t6 = S.togetherNow;
        var lastT = t6.round >= t6.total - 1;
        el('togprev').disabled = t6.round <= 0;
        el('togstep').textContent = !t6.struck
          ? '出招（' + (t6.round + 1) + '/' + t6.total + '）'
          : (lastT ? '三回合都打完了，按下一頁' : '下一回合 →（' + (t6.round + 2) + '/' + t6.total + '）');
        el('togstep').disabled = t6.struck && lastT;
        el('wonallbtn').textContent = t6.energy.done
          ? '能量條滿了'
          : '全場得勝（' + t6.energy.lit + '/' + t6.energy.planned + '）';
        el('wonallbtn').disabled = t6.energy.done;
      }
    }

    // 第六關的收口：翻開開場那張蓋著的卡（在耶穌基督裡的好）。
    var goodc = el('goodctl');
    if (goodc) {
      goodc.hidden = S.phase.id !== 'won';
      if (!goodc.hidden) {
        el('goodopen').textContent = S.goodOpen ? '蓋回去' : '翻開「在耶穌基督裡的好」';
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
    // **最後一頁不要把「下一頁」鎖起來。** 現場主持人按到底的時候，
    // 一顆變灰的按鈕會讓人以為是當掉了 —— 底下那行字已經寫著「最後一頁」，
    // 按下去不會動，但它看起來是活的。第一頁的「←」同理。
    el('prev').disabled = false;
    el('next').disabled = false;
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
    on('forkstep', function () { post('forkStep'); });
    on('flipnext', function () { post('flipNext'); });
    on('flipall', function () {
      if (confirm('剩下的全部翻開？')) post('flipAll');
    });
    on('callprev', function () { post('callPrev'); });
    on('callstep', function () { post('callStep'); });
    on('connectnow', function () { post('connect'); });
    on('knockprev', function () { post('knockPrev'); });
    on('knockstep', function () { post('knockStep'); });
    on('opennow', function () { post('openAll'); });
    on('seeknext', function () { post('seekNext'); });
    on('opengift', function () { post('openGift'); });
    on('pickreveal', function () { post('cardsReveal'); });
    on('bossmerge', function () { post('bossMerge'); });
    on('fightprev', function () { post('fightPrev'); });
    on('fightstep', function () { post('fightStep'); });
    on('crossback', function () { post('crossBack'); });
    on('crossnext', function () { post('crossNext'); });
    on('togprev', function () { post('togetherPrev'); });
    on('togstep', function () { post('togetherStep'); });
    on('wonallbtn', function () { post('wonAll'); });
    on('goodopen', function () { post('goodOpen'); });
  }

  if (!WEEK) {
    // notes.js 掛了（多半是文案裡少一個逗號）。**寧可壞得明顯，也不要默默連錯關。**
    el('app').innerHTML =
      '<div class="ask"><h1>備忘錄載入失敗</h1>' +
      '<p>這一關的 <b>notes.js</b> 沒有載進來 —— 通常是檔案裡有語法錯誤。</p>' +
      '<p class="hint">大螢幕照常可以跑，翻頁用電腦上的控制列。</p></div>';
  } else if (!ROOM) {
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
