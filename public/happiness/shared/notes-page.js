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
    auc.hidden = !isAuction;
    if (isAuction) {
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
    el('prev').onclick = function () { post('prev'); };
    el('next').onclick = function () { post('next'); };
    el('prevlot').onclick = function () { post('prevLot'); };
    el('nextlot').onclick = function () { post('nextLot'); };
    el('extend').onclick = function () { post('extend'); };
    el('waitbtn').onclick = function () { post('toggleWait'); };
    el('restart').onclick = function () {
      if (confirm('整場拍賣重跑？所有人的點數和標到的東西都會還原。')) post('restartAuction');
    };
    var on = function (id, fn) { var b = el(id); if (b) b.onclick = fn; };
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
