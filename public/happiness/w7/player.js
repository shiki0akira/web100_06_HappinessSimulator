// 玩家手機 · 第七關「釋放與自由」
//
// ⚠️ 這一關手機會亮的：接關、O/X 八題、領受經文、天上的身分（我願意／我想再想想）、
// 祝福禱告（再加存卡）。
// **按了「我願意」，他自己的那一條慢慢補滿 100** —— 伺服器的數字要等全場補滿才變（側欄不能露出誰按了）。
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

  // 「成為上帝的兒女，我想對天父說＿＿」那一句只存在這支手機裡。**完全不上牆。**
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

  var draft = { byVisits: false };

  var wait = function (msg, sub) {
    return '<div class="wait"><div class="dot">. . .</div><p style="font-size:21px;color:var(--ink-2)">' +
      esc(msg) + '</p>' + (sub ? '<p style="font-size:17px">' + esc(sub) + '</p>' : '') + '</div>';
  };

  // 他自己的那一條幸福根基。按了「我願意」會從原本的數字慢慢長到 100。
  var myFrom = null;
  function myLine(me) {
    var v = myFrom == null ? me.innerShown : myFrom;
    return '<div class="myroot"><span class="l">幸福根基</span>' +
      '<span class="tr"><i id="myfill" style="width:' + v + '%"></i></span>' +
      '<b id="mynum">' + v + '</b></div>';
  }
  function growMine(me) {
    var fill = document.getElementById('myfill'), num = document.getElementById('mynum');
    if (!fill || myFrom == null || myFrom === me.innerShown) { myFrom = me.innerShown; return; }
    var from = myFrom, to = me.innerShown, t0 = Date.now(), DUR = 2600;
    myFrom = to;
    void fill.offsetWidth;
    fill.style.width = to + '%';
    // setInterval：分頁在背景時 requestAnimationFrame 不會跑
    var tick = setInterval(function () {
      var t = Math.min(1, (Date.now() - t0) / DUR), e = 1 - Math.pow(1 - t, 3);
      if (num) num.textContent = Math.round(from + (to - from) * e);
      if (t >= 1) clearInterval(tick);
    }, 40);
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
        '<p class="privacy center">公布之後大螢幕會出現名字。</p>';
    },

    oxTally: function (me) {
      return (me.oxN ? '<p class="bigline center">八題裡，你有 ' + me.oxO + ' 個 O</p>' : '') + wait('看大螢幕');
    },

    faith: function () {
      return '<h2 class="center">' + esc(S.faith[0]) + '</h2>' +
        '<h2 class="center" style="color:var(--root-c)">' + esc(S.faith[1]) + '</h2>' + wait('看大螢幕');
    },

    // 領受經文：跟前六關一樣。
    verse: function (me) {
      return '<div class="verse-p"><span class="ref">' + esc(S.verse.ref) + '</span>' +
        '<blockquote>「' + esc(S.verse.text) + '」</blockquote></div>' +
        (me.receivedVerse
          ? '<div class="grew"><img src="/happiness/shared/art/verse.svg" alt="">' +
            // 撞到 95 的人只長了幾格 —— 不要騙他說 +10
            '<p class="ok">已領受<br><b>' + (me.capped ? '幸福根基 ' + me.inner : '幸福根基 +10') + '</b></p></div>' +
            (me.capped ? '<p class="bigline center">' + esc(S.verse.capped) + '</p>' : '')
          : '<button class="btn primary fullbtn" id="verse">' + esc(S.verse.receive) + '</button>');
    },

    identity: function (me) {
      return '<h2 class="center">' + esc(S.identity.title) + '</h2>' + myLine(me) + wait('看大螢幕');
    },

    invite: function () {
      return '<img class="churchart" src="' + ART + 'heaven-church.svg" alt="">' +
        '<h2 class="center" style="margin-top:14px">' + esc(S.invite.title) + '</h2>' +
        '<div class="verse-p"><span class="ref">' + esc(S.invite.verse.ref) + '</span>' +
          '<blockquote>「' + esc(S.invite.verse.text) + '」</blockquote></div>';
    },

    // 天上的身分：我願意／我想再想想。**按了什麼不會上大螢幕**（大螢幕上的線不掛名字）。
    willing: function (me) {
      var w = S.willingInfo;
      if (S.filled) {
        return myLine(me) + '<p class="bigline center">' + esc(w.mine) + '</p>' +
          (me.willing === 'yes' ? '<p class="center">' + esc(w.yesReply) + '</p>' : '');
      }
      if (me.willing === 'yes') {
        return '<h2 class="center">' + esc(me.name) + '</h2>' + myLine(me) +
          '<p class="bigline center">' + esc(w.yesReply) + '</p>';
      }
      return '<h2 class="center">' + esc(S.invite.title) + '</h2>' + myLine(me) +
        (me.willing === 'later' ? '<p class="bigline center">' + esc(w.laterReply) + '</p>' : '') +
        '<button class="btn primary fullbtn" id="willyes">' + esc(w.yes) + '</button>' +
        (me.willing === 'later' ? '' : '<button class="btn ghost fullbtn" id="willlater">' + esc(w.later) + '</button>') +
        '<p class="privacy center">🔒 大螢幕上的線不掛名字，沒有人知道哪一條是你。</p>';
    },

    // 祝福禱告。**什麼都沒寫也按得下去。只有他自己看得到。**
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

    end: function () {
      return '<h2>下週見</h2>' +
        '<p>' + esc(S.next.nextLabel) + ' · ' + esc(S.next.week) + '</p>' +
        '<p>' + esc(S.next.lines[0]) + '</p>' +
        (cardURL ? '<img class="weekcard" src="' + cardURL + '" alt="第七關週卡">' : '') +
        (cardURL ? '<a class="btn ghost fullbtn" id="zoom" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">放大這張卡</a>' : '');
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

    document.querySelectorAll('[data-ox]').forEach(function (b) {
      b.onclick = function () { act('ox', { round: S.oxNow.round, k: b.dataset.ox }); };
    });

    var v = document.getElementById('verse');
    if (v) v.onclick = function () { act('verse'); };
    var wy = document.getElementById('willyes');
    if (wy) wy.onclick = function () { act('willing', { k: 'yes' }); };
    var wl = document.getElementById('willlater');
    if (wl) wl.onclick = function () { act('willing', { k: 'later' }); };

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
          inner: me.innerShown, innerLabel: '幸福根基',
          verseRef: S.verse.ref, verseText: S.verse.text,
          // 按了「我願意」的人印這一句；其他人印「我可以說不。」（**這張卡只在他自己的手機上**）
          path: { label: 'MY CARD', steps: [me.willing === 'yes' ? S.willingInfo.cardYes : S.willingInfo.cardNo] },
          stamp: S.identity.title,
          burdenLabel: 'MY PRAYER',
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

    statusEl.hidden = false;
    document.getElementById('myname').textContent = me.name;
    document.getElementById('mystate').textContent = S.phase.title;
    document.getElementById('outerv').textContent = me.outer == null ? '—' : me.outer;
    document.getElementById('outerbar').style.width = (me.outer == null ? 0 : me.outer) + '%';
    document.getElementById('innerv').textContent = me.innerShown ? me.innerShown : '—';
    document.getElementById('innerbar').style.width = me.innerShown + '%';

    // ⚠️ 禱告那一格正在打的字不能進這一行 —— 一變就整頁重畫，焦點會被踢掉。
    var next = [
      S.phase.id, S.oxNow.round, S.oxNow.revealed, S.filled,
      me.outer, me.inner, me.innerShown, me.oxChoice, me.oxO,
      me.receivedVerse, me.capped, me.willing, me.cardDone, me.prayed,
      draft.byVisits,
    ].join('|');
    if (next !== sig) {
      // 換頁的時候他那一條從目前的數字開始畫，不要重播
      if (sig.split('|')[0] !== S.phase.id) myFrom = null;
      sig = next;
      screen.innerHTML = (views[S.phase.id] || function () { return wait('看大螢幕'); })(me);
      bind(me);
      growMine(me);
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
