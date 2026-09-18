// 玩家手機 · 第七關「釋放與自由」
//
// ⚠️ 這一關手機會亮的：接關、自由是什麼、身不由己五回合、領受經文（斷鏈）、
// 拒絕的自由三回合、寫下想說不的那一件事（再加存卡）。
// **「不要」越來越難按、「好過一點」自己亮起來，都是這支手機上的事** —— 伺服器只收結果。
(function () {
  'use strict';
  var S = null, pid = null, src = null, sig = '', cardURL = null, cardBlob = null;
  var blessSaved = false, blessSavedTimer = null;
  var screen = document.getElementById('screen');
  var statusEl = document.getElementById('status');
  var ART = '/happiness/shared/art/';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var WEEK = 7;
  var ROOM = Room.readCode();
  var SEAT = new URLSearchParams(location.search).get('seat') || '';
  var PID_KEY = 'happiness_pid_w7_' + ROOM + (SEAT ? '_' + SEAT : '');
  var LINE_KEY = 'happiness_line_w7_' + ROOM + (SEAT ? '_' + SEAT : '');

  // 「我想對它說『不』的是＿＿」那一句只存在這支手機裡。**完全不上牆。**
  function readLine() { try { return localStorage.getItem(LINE_KEY) || ''; } catch (e) { return ''; } }
  function writeLine(t) { try { localStorage.setItem(LINE_KEY, t); } catch (e) {} }

  try { pid = localStorage.getItem(PID_KEY); } catch (e) { pid = null; }

  function act(type, extra) { if (src) src.action(type, extra); }

  function connect() {
    src = Room.connect({
      role: 'player', week: WEEK, room: ROOM, pid: pid,
      onState: function (d) { S = d; render(); },
      onPid: function (p) {
        pid = p;
        try { localStorage.setItem(PID_KEY, pid); } catch (e) {}
        sig = '';
      },
    });
  }
  function join(name) { if (src) src.join(name); }

  // 送出之前只活在這支手機上的暫存
  var draft = { byVisits: false };

  var wait = function (msg, sub) {
    return '<div class="wait"><div class="dot">. . .</div><p style="font-size:21px;color:var(--ink-2)">' +
      esc(msg) + '</p>' + (sub ? '<p style="font-size:17px">' + esc(sub) + '</p>' : '') + '</div>';
  };

  // 他身上的鎖鏈：一條一行
  function chainList(chains) {
    if (!chains.length) return '';
    return '<div class="chains">' + chains.map(function (c) {
      return '<span><img src="' + ART + 'chain-link.svg" alt="">' + esc(c) + '</span>';
    }).join('') + '</div>';
  }

  // 斷鏈：**在這支手機上親眼看到它斷**才播鳥飛走（重新整理進來就直接是斷的）
  var sawBound = false, flyAt = 0;
  function breakWatch(me) {
    if (!me.broken) { sawBound = true; flyAt = 0; return; }
    if (sawBound && !flyAt) { sawBound = false; flyAt = Date.now(); }
  }
  function flying() { return flyAt && Date.now() - flyAt < 2600; }

  // 經文卡（第 7 頁，還沒領受的人在第 8 頁也先回到這裡）
  function verseCard(me, back) {
    var head = (back ? '<p class="privacy" style="margin-top:0">先領受這一句，再一起往下走。</p>' : '') +
      '<div class="verse-p"><span class="ref">' + esc(S.verse.ref) + '</span>' +
      '<blockquote>「' + esc(S.verse.text) + '」</blockquote></div>';
    if (!me.broken) {
      return head + (me.chainsHad ? '<div class="qn center" style="margin-top:8px">你身上的鎖鏈</div>' + chainList(me.chains) : '') +
        '<button class="btn primary fullbtn" id="verse">' + esc(S.verse.receive) + '</button>';
    }
    var birds = '';
    for (var i = 0; i < Math.max(me.chainsHad, 3); i++) birds += '<img src="' + ART + 'bird.svg" alt="" style="animation-delay:' + (i * 0.18) + 's">';
    return head +
      (flying() || me.chainsHad ? '<div class="birds' + (flying() ? ' fly' : '') + '">' + birds + '</div>' : '') +
      '<img class="freeart" src="' + ART + 'bound-0.svg" alt="">' +
      '<div class="grew"><img src="/happiness/shared/art/verse.svg" alt="">' +
        // 撞到 95 的人只長了幾格 —— 不要騙他說 +10
        '<p class="ok">鎖鏈斷了<br><b>' + (me.capped ? '幸福根基 ' + Math.min(me.inner, 95) : '幸福根基 +10') + '</b>' +
        (me.breakGain ? '<br><b style="color:var(--vol)">幸福指數 +' + me.breakGain + '</b>' : '') + '</p></div>' +
      (me.capped ? '<p class="bigline center">' + esc(S.verse.capped) + '</p>' : '');
  }

  var views = {
    lobby: function () {
      return '<h2>你已經進場了</h2>' +
        '<p>目前 ' + S.playerCount + ' 個人在場。等主持人開始，這個畫面會自己跳。</p>' +
        '<p class="mono" style="color:var(--ink-3);font-size:16px">手機不要鎖螢幕，等一下會用到。</p>' +
        '<button class="btn ghost fullbtn" id="rename">改名字</button>';
    },

    reconnect: function (me) {
      if (me.outer !== null) {
        return wait('已接上：' + me.outer + ' 分', '幸福根基 ' + (me.inner ? me.inner : '—'));
      }
      return '<h2>打開上一次的卡片</h2>' +
        '<p><span class="sub">第一次來的話自由填 —— 按你現在的感覺給自己一個分數就好，第二格填 0。</span></p>' +
        '<p class="fieldlbl">幸福指數</p>' +
        '<input id="oc" type="tel" inputmode="numeric" maxlength="3" placeholder="0 – 100" class="numin">' +
        (draft.byVisits
          ? '<p class="fieldlbl">這是你第幾次來？<span class="sub">系統會幫你算第二條線</span></p>' +
            '<input id="vc" type="tel" inputmode="numeric" maxlength="1" placeholder="1" class="numin">'
          : '<p class="fieldlbl">幸福根基<span class="sub">卡片上的第二個數字，第一次來就填 0</span></p>' +
            '<input id="ic" type="tel" inputmode="numeric" maxlength="2" class="numin">') +
        '<button class="btn primary fullbtn" id="sendrec">送出</button>' +
        '<button class="btn ghost fullbtn" id="togglemode">' +
          (draft.byVisits ? '我有卡片，改填幸福根基' : '忘記帶卡片？改填「這是你第幾次來」') + '</button>';
    },

    // O/X：兩顆大按鈕。公布之前都可以改。
    ox: function (me) {
      var o = S.oxNow, mine = me.oxChoice;
      var head = '<div class="qn">' + esc(S.oxInfo.title) + ' · 第 ' + (o.round + 1) + ' / ' + o.total + ' 題</div>' +
        '<h2 style="margin-top:6px">' + esc(o.q) + '</h2>';
      if (o.revealed) {
        if (!mine) return head + wait('看大螢幕', '這一題你沒有選');
        var same = (mine === 'o' ? o.o : o.x).length - 1;
        return head + '<div class="oxmine ' + mine + '">' + (mine === 'o' ? 'O' : 'X') + '</div>' +
          '<p class="center">' + (same > 0 ? '跟你一樣的還有 ' + same + ' 個人' : '只有你選這一邊') + '</p>' + wait('看大螢幕');
      }
      return head +
        '<div class="oxbtns">' +
          '<button class="oxbtn o' + (mine === 'o' ? ' on' : '') + '" data-ox="o">O</button>' +
          '<button class="oxbtn x' + (mine === 'x' ? ' on' : '') + '" data-ox="x">X</button>' +
        '</div>' +
        '<p class="privacy center">' + '公布之後大螢幕會出現名字。</p>';
    },

    oxTally: function (me) {
      return (me.oxN ? '<p class="bigline center">八題裡，你有 ' + me.oxO + ' 個 O</p>' : '') + wait('看大螢幕');
    },

    // 身不由己。**第 3 回合起「不要」要長按；第 4 回合起「好過一點」自己亮著。**
    bound: function (me) {
      var b = S.boundNow, info = S.boundInfo;
      var head = '<div class="qn">第 ' + (b.round + 1) + ' / ' + b.total + ' 回合 · ' + esc(b.bond) + '</div>' +
        '<h2 style="margin-top:6px">' + esc(b.text) + '</h2>';
      if (b.revealed) {
        return head + '<div class="qn center" style="margin-top:18px">你身上的鎖鏈</div>' + chainList(me.chains) + wait('看大螢幕');
      }
      var mine = me.boundChoice;
      // 「好過一點」自己亮著：他還沒選的時候，看起來已經選好了
      var lit = b.lit && !mine;
      var holdSec = b.hold ? (b.hold / 1000) : 0;
      return head +
        (me.chains.length ? '<div class="qn" style="margin-top:14px">你身上的鎖鏈</div>' + chainList(me.chains) : '') +
        '<div class="opts">' +
          '<button class="opt' + (mine === 'ease' || lit ? ' on' : '') + '" data-bound="ease">' + esc(b.ease) +
            '<small>' + esc(info.easeLabel) + (lit ? '　·　再點一下就送出' : '') + '</small></button>' +
          '<button class="opt hold' + (mine === 'no' ? ' on2' : '') + '" data-bound="no"' + (b.hold ? ' data-hold="' + b.hold + '"' : '') + '>' +
            '<i class="fillbar" style="animation-duration:' + (b.hold || 1) + 'ms"></i>' +
            '<span>' + esc(b.no) + '</span>' +
            '<small>' + esc(info.noLabel) + (b.hold ? '　·　長按 ' + holdSec + ' 秒' : '') + '</small></button>' +
        '</div>' +
        (b.hold >= 2000 ? '<p class="privacy center">' + esc(info.handHint) + '</p>' : '') +
        (mine ? '<p class="ok center" style="margin-top:12px">已決定。主持人公布之前都可以改。</p>' : '');
    },

    bill: function (me) {
      return '<h2 class="center">' + esc(S.bill.title) + '</h2>' +
        '<img class="freeart" src="' + ART + 'bound-' + Math.min(5, me.chains.length) + '.svg" alt="">' +
        chainList(me.chains) +
        (me.billLoss ? '<div class="hit">' + esc(S.bill.billLead) + '　幸福指數 −' + me.billLoss + '</div>' : '') +
        (S.billStep >= 1 ? '<p class="bigline center">' + esc(S.bill.line) + '</p>' : '') +
        wait('看大螢幕');
    },

    story: function () { return wait('看大螢幕'); },

    verse: function (me) { return verseCard(me, false); },

    faith: function () {
      return '<h2 class="center">' + esc(S.verse.faith[0]) + '</h2>' +
        '<h2 class="center" style="color:var(--root-c)">' + esc(S.verse.faith[1]) + '</h2>' + wait('看大螢幕');
    },

    // 拒絕的自由。**還沒領受的人先回到經文卡。**「不要」是普通按鈕。
    refuse: function (me) {
      if (!me.broken) return verseCard(me, true);
      var r = S.refuseNow, info = S.refuseInfo;
      var mine = me.refuseChoice;
      var head = '<div class="qn">' + esc(info.title) + ' · 第 ' + (r.round + 1) + ' / ' + r.total + ' 回合</div>' +
        '<h2 style="margin-top:6px">' + esc(r.text) + '</h2>';
      var said = mine === 'no'
        ? '<div class="said no">' + esc(info.saidNo) + '</div>'
        : mine === 'ease' ? '<div class="said">' + esc(info.saidEase) + '</div>' : '';
      if (r.revealed) return head + said + wait('看大螢幕');
      return head +
        '<div class="opts">' +
          '<button class="opt' + (mine === 'ease' ? ' on' : '') + '" data-refuse="ease">' + esc(r.ease) + '<small>' + esc(S.boundInfo.easeLabel) + '</small></button>' +
          '<button class="opt' + (mine === 'no' ? ' on2' : '') + '" data-refuse="no">' + esc(r.no) + '<small>' + esc(S.boundInfo.noLabel) + '</small></button>' +
        '</div>' + said;
    },

    trueFree: function () { return wait('看大螢幕'); },

    full: function (me) {
      if (!S.filled) return wait('看大螢幕');
      return '<div class="hundred">100</div>' +
        '<p class="bigline center">' + esc(S.full.mine) + '</p>' +
        wait('看大螢幕');
    },

    bless: function (me) {
      var mine = readLine();
      return '<h2>' + esc(S.bless.title) + '</h2>' +
        '<p class="fieldlbl">' + esc(S.bless.ask) + '<span class="sub">' + esc(S.bless.hint) + '</span></p>' +
        '<textarea id="bl" maxlength="60" placeholder="' + esc(S.bless.ask) + '……">' + esc(mine) + '</textarea>' +
        '<button class="btn primary fullbtn" id="savebl">' + (blessSaved ? '已更新' : (me.prayed ? '更新' : '寫好了')) + '</button>' +
        (me.prayed
          ? '<div class="grew"><img src="/happiness/shared/art/prayer.svg" alt="">' +
            '<p class="ok">已存下</p></div>'
          : '') +
        '<p class="privacy">🔒 這一句只存在你這支手機裡，大螢幕上只看得到「幾人已寫下」。它會印在你今天的卡片上。</p>';
    },

    card: function (me) {
      if (!me.cardDone) return '<h2>儲存模擬回憶</h2>' + wait('生成中');
      return '<h2>儲存模擬回憶</h2>' +
        '<p>這是第七張卡。存好之後，把這幾週的卡排出來看看。</p>' +
        '<img class="weekcard" id="cardimg" alt="第七關週卡">' +
        '<a class="btn primary fullbtn" id="zoom" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">放大這張卡</a>';
    },

    end: function (me) {
      return '<h2>下週見</h2>' +
        '<p>下一關 · ' + esc(S.next.week) + '</p>' +
        '<p>' + esc(S.next.lines[0]) + '</p>' +
        (cardURL ? '<img class="weekcard" src="' + cardURL + '" alt="第七關週卡">' : '') +
        (cardURL ? '<a class="btn ghost fullbtn" id="zoom" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">放大這張卡</a>' : '');
    },

    // 天上的教會。**手機上沒有按鈕。**
    heaven: function () {
      var st = S.heavenStep, h = S.heaven;
      if (st === 0) {
        return '<img class="freeart dim" src="' + ART + 'rest.svg" alt="">' +
          '<p class="bigline center" style="color:var(--ink-2) !important">' + esc(h.steps[0]) + '</p>';
      }
      if (st === 1) {
        return '<img class="freeart wide" src="' + ART + 'tomb-open.svg" alt="">' +
          '<p class="bigline center">' + esc(h.steps[1]) + '</p>';
      }
      return '<img class="churchart" src="' + ART + 'heaven-church.svg" alt="">' +
        '<h2 class="center" style="margin-top:14px">' + esc(h.steps[2]) + '</h2>' +
        '<div class="verse-p"><span class="ref">' + esc(S.verse.ref) + '</span>' +
          '<blockquote>「' + esc(S.verse.text) + '」</blockquote></div>' +
        (cardURL ? '<img class="weekcard" src="' + cardURL + '" alt="第七關週卡">' : '');
    },
  };

  function shareCanvas(card) {
    var w = window.innerWidth || 375;
    var h = window.innerHeight || 812;
    var W = card.width;
    var H = Math.max(card.height, Math.round(W * (h / w)));
    var out = document.createElement('canvas');
    out.width = W; out.height = H;
    var c = out.getContext('2d');
    c.fillStyle = '#0E1211';
    c.fillRect(0, 0, W, H);
    c.drawImage(card, 0, Math.round((H - card.height) / 2));
    return out;
  }

  // 長按「不要」：按住的時候那一格慢慢填滿，放開就重來。
  function bindHold(b, ms, done) {
    var timer = null;
    var stop = function () { clearTimeout(timer); timer = null; b.classList.remove('holding'); };
    b.oncontextmenu = function (e) { e.preventDefault(); };
    b.onpointerdown = function (e) {
      e.preventDefault();
      b.classList.add('holding');
      timer = setTimeout(function () { stop(); done(); }, ms);
    };
    b.onpointerup = stop;
    b.onpointerleave = stop;
    b.onpointercancel = stop;
    b.onclick = function (e) { e.preventDefault(); };
  }

  function bind(me) {
    var send = document.getElementById('sendrec');
    if (send) {
      var oc = document.getElementById('oc');
      var second = document.getElementById(draft.byVisits ? 'vc' : 'ic');
      var go = function () {
        var value = Number(oc.value);
        if (!(oc.value !== '' && value >= 0 && value <= 100)) { oc.focus(); return; }
        if (draft.byVisits) act('reconnect', { value: value, mode: 'visits', visits: Number(second.value) || 1 });
        else act('reconnect', { value: value, mode: 'card', inner: Number(second.value) || 0 });
      };
      send.onclick = go;
      second.onkeydown = function (e) { if (e.key === 'Enter') go(); };
      oc.onkeydown = function (e) { if (e.key === 'Enter') second.focus(); };
      var tm = document.getElementById('togglemode');
      if (tm) tm.onclick = function () { draft.byVisits = !draft.byVisits; sig = ''; render(); };
    }

    // 自由是什麼：勾選只改暫存，按送出才上去
    document.querySelectorAll('[data-ox]').forEach(function (b) {
      b.onclick = function () { act('ox', { round: S.oxNow.round, k: b.dataset.ox }); };
    });

    document.querySelectorAll('[data-bound]').forEach(function (b) {
      var send = function () { act('bound', { round: S.boundNow.round, k: b.dataset.bound }); };
      if (b.dataset.hold) bindHold(b, Number(b.dataset.hold), send);
      else b.onclick = send;
    });
    document.querySelectorAll('[data-refuse]').forEach(function (b) {
      b.onclick = function () { act('refuse', { round: S.refuseNow.round, k: b.dataset.refuse }); };
    });

    var v = document.getElementById('verse');
    if (v) v.onclick = function () { act('verse'); };

    var save = document.getElementById('savebl');
    if (save) save.onclick = function () {
      var text = document.getElementById('bl').value;
      writeLine(text);
      act('bless', { has: !!text.trim() });
      blessSaved = true;
      clearTimeout(blessSavedTimer);
      blessSavedTimer = setTimeout(function () {
        blessSaved = false;
        var b = document.getElementById('savebl');
        if (b) b.textContent = S && S.me && S.me.prayed ? '更新' : '寫好了';
      }, 3000);
      sig = '';
      render();
    };

    var rn = document.getElementById('rename');
    if (rn) rn.onclick = function () {
      var n = prompt('你的名字', me.name);
      if (n) act('rename', { name: n });
    };

    var zm = document.getElementById('zoom');
    if (zm && cardBlob) zm.href = cardBlob;

    if (S.phase.id === 'card' && !me.cardDone) act('card');

    var img = document.getElementById('cardimg');
    if (img) {
      var make = function () {
        var cv = document.createElement('canvas');
        drawWeekCard(cv, {
          week: 7,
          name: me.name,
          outer: me.outer, outerPrev: me.outerStart,
          inner: me.inner, innerLabel: '幸福根基',
          verseRef: S.verse.ref, verseText: S.verse.text,
          // **不印第一階段選了什麼** —— 印上去就是一張罪狀。
          path: { label: 'MY CARD', steps: [S.refuseInfo.saidNo] },
          stamp: '今晚全場說了 ' + S.saidNo + ' 次不',
          burdenLabel: 'MY NO',
          burdenAsk: S.bless.ask + '：',
          burden: readLine(),
        });
        cardURL = cv.toDataURL('image/png');
        img.src = cardURL;
        shareCanvas(cv).toBlob(function (b) {
          if (!b) return;
          if (cardBlob) URL.revokeObjectURL(cardBlob);
          cardBlob = URL.createObjectURL(b);
          var z = document.getElementById('zoom');
          if (z) z.href = cardBlob;
        }, 'image/png');
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(make); else make();
    }
  }

  function render() {
    if (!S) return;
    var me = S.me;

    if (!me) {
      statusEl.hidden = true;
      if (sig !== 'join') {
        sig = 'join';
        screen.innerHTML = '<h2>幸福模擬器</h2><p>第七關 · 釋放與自由</p>' +
          '<p style="margin-top:18px">輸入你的名字就可以進場。</p>' +
          '<input id="nm" maxlength="12" placeholder="名字或暱稱" style="width:100%;padding:14px;font-size:22px;font-weight:700">' +
          '<button class="btn primary fullbtn" id="go">進場</button>';
        document.getElementById('go').onclick = function () {
          var n = document.getElementById('nm').value.trim();
          if (!n) { document.getElementById('nm').focus(); return; }
          join(n);
        };
        document.getElementById('nm').onkeydown = function (e) {
          if (e.key === 'Enter') document.getElementById('go').click();
        };
      }
      return;
    }

    breakWatch(me);

    statusEl.hidden = false;
    document.getElementById('myname').textContent = me.name;
    document.getElementById('mystate').textContent = S.phase.title;
    document.getElementById('outerv').textContent = me.outer == null ? '—' : me.outer;
    document.getElementById('outerbar').style.width = (me.outer == null ? 0 : me.outer) + '%';
    document.getElementById('innerv').textContent = me.inner ? me.inner : '—';
    document.getElementById('innerbar').style.width = me.inner + '%';

    // ⚠️ 正在打的字（其他、禱告）不能進這一行 —— 一變就整頁重畫，焦點會被踢掉。
    var next = [
      S.phase.id, S.oxNow.round, S.oxNow.revealed, S.boundNow.round, S.boundNow.revealed, S.billStep,
      S.refuseNow.round, S.refuseNow.revealed, S.filled, S.heavenStep,
      me.outer, me.inner, me.oxChoice, me.oxO, me.boundChoice, me.chains.join(','),
      me.billLoss, me.broken, me.capped, me.refuseChoice, me.cardDone, me.prayed,
      draft.byVisits, !!flying(),
    ].join('|');
    if (next !== sig) {
      sig = next;
      screen.innerHTML = (views[S.phase.id] || function () { return wait('看大螢幕'); })(me);
      bind(me);
      if (flying()) setTimeout(render, 2700);
    }
  }

  if (!ROOM) {
    statusEl.hidden = true;
    screen.innerHTML = '<h2>幸福模擬器</h2><p>第七關 · 釋放與自由</p>' +
      '<p style="margin-top:18px">輸入大螢幕上的四碼房號。</p>' +
      '<input id="rc" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="房號" ' +
        'style="width:100%;padding:16px;font-size:37px;font-weight:700;text-align:center;letter-spacing:.3em;font-family:var(--pixel)">' +
      '<button class="btn primary fullbtn" id="rgo">進場</button>' +
      '<p class="privacy">掃主持人畫面上的 QR 就不用輸入這個。</p>';
    var go = function () {
      var c = document.getElementById('rc').value.toUpperCase().trim();
      if (!Room.CODE_RE.test(c)) { document.getElementById('rc').focus(); return; }
      location.search = '?room=' + c + (SEAT ? '&seat=' + SEAT : '');
    };
    document.getElementById('rgo').onclick = go;
    document.getElementById('rc').onkeydown = function (e) { if (e.key === 'Enter') go(); };
  } else {
    connect();
  }
})();
