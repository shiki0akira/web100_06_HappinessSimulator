// 玩家手機 · 第六關「十字架的勝利」
//
// ⚠️ 這一關手機會亮的：接關、挑一張困難卡、三回合出招、替被打中的人禱告、領受、
// 寫那一仗（再加存卡）。其餘的頁手機都是安靜的。
// **十字架那一頁手機上一顆按鈕都沒有** —— 只要有東西可以按，全場就會以為魔王是他們按倒的。
(function () {
  'use strict';
  var S = null, pid = null, src = null, sig = '', cardURL = null, cardBlob = null;
  // 得勝禱告那顆按鈕：按下去之後 3 秒內寫「已更新」，不然按了看起來沒反應
  var blessSaved = false, blessSavedTimer = null;
  var screen = document.getElementById('screen');
  var statusEl = document.getElementById('status');

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var WEEK = 6;
  var ROOM = Room.readCode();
  // 測試用：同一台電腦要開多個玩家，就在網址後面加 &seat=2、&seat=3……
  var SEAT = new URLSearchParams(location.search).get('seat') || '';
  var PID_KEY = 'happiness_pid_w6_' + ROOM + (SEAT ? '_' + SEAT : '');
  var LINE_KEY = 'happiness_line_w6_' + ROOM + (SEAT ? '_' + SEAT : '');

  // 「我現在正在打的那一仗是＿＿」那一句只存在這支手機裡，
  // 一個字都不會離開這台裝置。**完全不上牆。**
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

  function fmt(d) { return d > 0 ? '+' + d : d < 0 ? '−' + Math.abs(d) : '±0'; }
  function aspectArt(k) { return '/happiness/shared/art/aspect-' + k + '.svg'; }

  // 送出之前只活在這支手機上的暫存
  var draft = { byVisits: false };

  // ── 畫面 ─────────────────────────────────────────────────────────────
  var wait = function (msg, sub) {
    return '<div class="wait"><div class="dot">. . .</div><p style="font-size:21px;color:var(--ink-2)">' +
      esc(msg) + '</p>' + (sub ? '<p style="font-size:17px">' + esc(sub) + '</p>' : '') + '</div>';
  };

  function myCard(me) {
    if (!me.drawn) return '';
    return '<div class="mine"><div class="as">' + esc(me.drawn.aspect) + '</div>' +
      '<div class="tx">' + esc(me.drawn.text) + '</div></div>';
  }

  var views = {
    lobby: function () {
      return '<h2>你已經進場了</h2>' +
        '<p>目前 ' + S.playerCount + ' 個人在場。等主持人開始，這個畫面會自己跳。</p>' +
        '<p class="mono" style="color:var(--ink-3);font-size:16px">手機不要鎖螢幕，等一下會用到。</p>' +
        '<button class="btn ghost fullbtn" id="rename">改名字</button>';
    },

    // 接關。卡片上有兩個數字，兩個都自己打。忘記帶卡片才改用「第幾次來」估。
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

    // 什麼才是「好」？右邊那一格蓋著，最後一頁才翻開。
    good: function () {
      return '<h2>' + esc(S.good.title) + '</h2>' +
        '<p>' + esc(S.good.sub) + '</p>' +
        '<div class="goodtwo">' +
          '<div class="gcol"><h3>' + esc(S.good.leftLabel) + '</h3><ul>' +
            S.good.left.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
          '</ul></div>' +
          '<div class="gcol right"><h3>' + esc(S.good.rightLabel) + '</h3><div class="gq">？</div></div>' +
        '</div>' +
        '<p class="privacy">看大螢幕。</p>';
    },

    chase: function () {
      return '<h2 class="center">' + esc(S.chase.line) + '</h2>' + wait('看大螢幕');
    },

    // 第一頁：六塊裡挑一塊。**這一頁不抽卡，也看不到任何句子。**
    cards: function (me) {
      if (me.aspect) {
        return '<div class="qn">你挑的那一塊</div>' +
          '<h2 style="margin-top:6px">' + esc(me.aspectName) + '</h2>' +
          '<img class="bossart" src="' + aspectArt(me.aspect) + '" alt="" style="width:34%;max-width:120px">' +
          '<button class="btn ghost fullbtn" id="backaspect">' + esc(S.pickInfo.change) + '</button>' +
          wait('等主持人翻頁', '下一頁才抽卡');
      }
      return '<h2>' + esc(S.pickInfo.title) + '</h2>' +
        '<p>' + esc(S.pickInfo.sub) + '</p>' +
        '<div class="aspects">' + S.aspects.map(function (a) {
          return '<button class="ab" data-aspect="' + esc(a.k) + '">' +
            '<img src="' + aspectArt(a.k) + '" alt="">' + esc(a.t) + '</button>';
        }).join('') + '</div>' +
        '<p class="privacy">' + esc(S.pickInfo.hint) + '只有你自己看得到。</p>';
    },

    // 第二頁：從他挑的那一塊裡**抽**一張。點哪一張都一樣，是隨機的。
    draw: function (me) {
      if (!me.aspect) {
        return '<h2>' + esc(S.drawInfo.title) + '</h2>' +
          '<p>你上一頁沒有挑，所以這一頁沒有你的牌。</p>' + wait('看大螢幕');
      }
      if (me.pick >= 0) {
        return '<div class="qn">' + esc(me.aspectName) + ' · 你抽到的</div>' +
          '<div class="mine"><div class="tx">' + esc(me.drawn.text) + '</div></div>' +
          (S.cardsNow.open
            ? (me.cardLoss ? '<div class="hit">幸福指數 ' + fmt(-me.cardLoss) + '</div>' : '') + wait('看大螢幕')
            : wait(esc(S.drawInfo.waiting)));
      }
      var n = me.deck || 4;
      var backs = '';
      for (var i = 0; i < n; i++) backs += '<button class="drawcard" data-draw="' + i + '">？</button>';
      return '<div class="qn">' + esc(me.aspectName) + '</div>' +
        '<h2 style="margin-top:6px">' + esc(S.drawInfo.title) + '</h2>' +
        '<div class="deck">' + backs + '</div>' +
        '<p class="privacy">' + esc(S.drawInfo.hint) + '</p>';
    },

    // 統計那一頁手機安靜。他自己挑的那一張留在畫面上。
    boss: function (me) {
      if (S.bossNow.merged) {
        return '<h2 class="center">' + esc(S.bossInfo.name) + '</h2>' +
          '<img class="bossart" src="/happiness/shared/art/boss.svg" alt="">' +
          '<div class="hpline">' + S.bossInfo.hp + ' / ' + S.bossInfo.hp + '</div>' +
          wait('看大螢幕');
      }
      return '<h2>' + esc(S.tally.title) + '</h2>' + myCard(me) + wait('看大螢幕');
    },

    // 靠自己打。四招都掉一樣的分 —— 打掉多少血不一樣，代價一樣。
    fight: function (me) {
      var f = S.fightNow;
      var head = '<div class="qn">第 ' + (f.round + 1) + ' / ' + f.total + ' 回合 · ' + esc(f.aspect) + '</div>' +
        '<h2 style="margin-top:6px">' + esc(f.attack) + '</h2>';
      if (f.revealed) {
        if (me.move < 0) return head + wait('看大螢幕', '這一回合你沒有出招');
        return head +
          '<div class="reply"><span class="replyfrom">' + esc(S.moves[me.move].label) + '</span><br>' +
            esc(me.moveText) + '</div>' +
          '<div class="hit">幸福指數 −2</div>' +
          wait('看大螢幕');
      }
      return head +
        '<div class="opts">' + S.moves.map(function (m, i) {
          return '<button class="opt' + (me.move === i ? ' on' : '') + '" data-move="' + i + '">' +
            esc(m.label) + '<small>' + (m.dmg ? '傷害 ' + m.dmg : 'MISS') + '</small></button>';
        }).join('') + '</div>' +
        '<p class="privacy">' + (me.move >= 0 ? '主持人公布之前都可以改。' : '你平常累的時候會怎麼做，就怎麼按。') + '</p>';
    },

    fightEnd: function (me) {
      return '<h2>' + esc(S.fightEnd.title) + '</h2>' +
        '<div class="hpline">' + S.bossInfo.hp + ' / ' + S.bossInfo.hp + '　血條一格都沒少</div>' +
        (me.fightLoss ? '<div class="hit">這三回合你掉了 ' + me.fightLoss + ' 分</div>' : '') +
        wait('看大螢幕');
    },

    // 十字架。**手機上沒有任何按鈕。** 這一仗是他打贏的。
    cross: function (me) {
      var st = S.crossStep || 0;
      if (st >= 3) {
        return '<h2 class="center">' + esc(S.cross.steps[3].t) + '</h2>' +
          '<div class="hpline zero">0 / ' + S.bossInfo.hp + '</div>' +
          (me.crossGain ? '<div class="hit up">幸福指數 ' + fmt(me.crossGain) + '</div>' : '') +
          '<p class="privacy center">這一仗不是你打的。</p>';
      }
      if (st === 2) {
        return '<img class="crossart" src="/happiness/shared/art/cross-dark.svg" alt="">' +
          '<div class="days">' + S.cross.days.map(function (d, i) {
            return '<span class="on">' + esc(d) + '</span>';
          }).join('') + '</div>' +
          wait('看大螢幕');
      }
      return '<h2 class="center">' + esc(S.cross.steps[st].t) + '</h2>' +
        '<img class="bossart" src="/happiness/shared/art/boss.svg" alt="">' +
        wait('看大螢幕');
    },

    power: function () {
      return '<img class="bossart" src="/happiness/shared/art/' + esc(S.power.art) + '.svg" alt="">' +
        '<h2 class="center" style="margin-top:14px">' + esc(S.power.title) + '</h2>';
    },

    verse: function (me) {
      return '<div class="verse-p"><span class="ref">' + esc(S.verse.ref) + '</span>' +
        '<blockquote>「' + esc(S.verse.text) + '」</blockquote></div>' +
        (me.receivedVerse
          ? '<div class="grew"><img src="/happiness/shared/art/verse.svg" alt="">' +
            '<p class="ok">已領受<br><b>幸福根基 +10</b></p></div>'
          : '<button class="btn primary fullbtn" id="verse">領受</button>');
    },

    // 在生活中得勝。被打中的人等人扛；其他人可以替他禱告。
    // **按的人一分都不動** —— 按禱告換分數就毀了這一頁。
    together: function (me) {
      var t = S.togetherNow;
      var e = t.energy;
      var mine = (me.hits || []).filter(function (h) { return h.me; });
      var others = (me.hits || []).filter(function (h) { return !h.me; });
      var head = '<div class="qn">第 ' + (t.round + 1) + ' / ' + t.total + ' 回合 · ' + esc(t.aspect) + '</div>' +
        '<h2 style="margin-top:6px">' + esc(S.together.sub) + '</h2>';

      var mineHtml = mine.map(function (h) {
        return '<div class="hitcard"><div class="who">你被打中了</div>' +
          '<div class="what">' + esc(h.text) + '</div>' +
          '<div class="hpline" style="text-align:left">幸福指數 −' + S.together.hitLoss + '</div>' +
          (h.prays
            ? '<div class="ok" style="margin-top:8px">有 ' + h.prays + ' 個人為你禱告　＋' + S.together.prayBack + '</div>'
            : '<div class="privacy" style="margin-top:8px">等別人為你禱告。</div>') +
        '</div>';
      }).join('');

      var othersHtml = others.length
        ? others.map(function (h) {
          return '<div class="prayrow' + (h.prayed ? ' done' : '') + '">' +
            '<div class="who">' + esc(h.name) + '</div>' +
            '<div class="what">' + esc(h.text) + '</div>' +
            (h.prayed
              ? '<div class="ok">✓ 你為他禱告了</div>'
              : '<button class="btn primary" data-pray="' + h.i + '">' + esc(S.together.pray) + '</button>') +
          '</div>';
        }).join('')
        : (mine.length ? '' : wait('看大螢幕', '等主持人出招'));

      return head + mineHtml + othersHtml +
        '<div class="energy"><div class="el"><span>全場能量</span><span>' + e.lit + ' / ' + e.planned + '</span></div>' +
          '<div class="cells">' + new Array(e.planned + 1).join('x').split('').map(function (_, i) {
            return '<i class="' + (i < e.lit ? 'on' : '') + '"></i>';
          }).join('') + '</div></div>';
    },

    won: function (me) {
      var mine = (me.hits || []).filter(function (h) { return h.me; });
      var helped = (me.hits || []).filter(function (h) { return h.prayed; }).length;
      return '<h2>' + esc(S.won.title) + '</h2>' +
        (S.goodOpen
          ? '<div class="goodtwo"><div class="gcol"><h3>' + esc(S.good.leftLabel) + '</h3><ul>' +
              S.good.left.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
            '</ul></div>' +
            '<div class="gcol right"><h3>' + esc(S.good.rightLabel) + '</h3><ul>' +
              S.good.right.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
            '</ul></div></div>'
          : '<p>' + esc(S.won.sub) + '</p>') +
        (mine.length ? '<p class="privacy">你被打中 ' + mine.length + ' 次，有人扛了。</p>' : '') +
        (helped ? '<p class="privacy">你為 ' + helped + ' 個人禱告。</p>' : '') +
        wait('看大螢幕');
    },

    // 得勝禱告。七關收尾的固定儀式，這一關有指定題目。**什麼都沒寫也按得下去。**
    bless: function (me) {
      var mine = readLine();
      return '<h2>得勝禱告</h2>' +
        '<p class="fieldlbl">' + esc(S.bless.ask) + '<span class="sub">' + esc(S.bless.hint) + '</span></p>' +
        '<textarea id="bl" maxlength="60" placeholder="' + esc(S.bless.ask) + '……">' + esc(mine) + '</textarea>' +
        '<button class="btn primary fullbtn" id="savebl">' + (blessSaved ? '已更新' : (me.prayed ? '更新' : '寫好了')) + '</button>' +
        (me.prayed
          ? '<div class="grew"><img src="/happiness/shared/art/prayer.svg" alt="">' +
            '<p class="ok">已存下<br><b>幸福根基 +5</b></p></div>'
          : '') +
        '<p class="privacy">🔒 這一句只存在你這支手機裡，大螢幕上只看得到「幾人已寫下」。它會印在你今天的卡片上。</p>';
    },

    // **不給「下載」。** 大家本來就都用截圖。
    card: function (me) {
      if (!me.cardDone) return '<h2>儲存模擬回憶</h2>' + wait('生成中');
      return '<h2>儲存模擬回憶</h2>' +
        '<p>這張卡是下一關的入場券。</p>' +
        '<img class="weekcard" id="cardimg" alt="第六關週卡">' +
        '<a class="btn primary fullbtn" id="zoom" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">放大這張卡</a>';
    },

    end: function () {
      return '<h2>下週見</h2>' +
        '<p>你寫的那一仗，這禮拜不是一個人打。</p>' +
        (cardURL ? '<img class="weekcard" src="' + cardURL + '" alt="第六關週卡">' : '') +
        (cardURL ? '<a class="btn ghost fullbtn" id="zoom" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">放大這張卡</a>' : '') +
        '<p class="privacy">忘記截也沒關係。下一關直接重新評估現在的自己，一樣算數。</p>';
    },
  };

  // 開新分頁看的那一張：**照這支手機的比例補成整頁**。
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

  // ── 綁定事件 ─────────────────────────────────────────────────────────
  function bind(me) {
    var send = document.getElementById('sendrec');
    if (send) {
      var oc = document.getElementById('oc');
      var second = document.getElementById(draft.byVisits ? 'vc' : 'ic');
      var go = function () {
        var value = Number(oc.value);
        if (!(oc.value !== '' && value >= 0 && value <= 100)) { oc.focus(); return; }
        if (draft.byVisits) {
          act('reconnect', { value: value, mode: 'visits', visits: Number(second.value) || 1 });
        } else {
          act('reconnect', { value: value, mode: 'card', inner: Number(second.value) || 0 });
        }
      };
      send.onclick = go;
      second.onkeydown = function (e) { if (e.key === 'Enter') go(); };
      oc.onkeydown = function (e) { if (e.key === 'Enter') second.focus(); };
      var tm = document.getElementById('togglemode');
      if (tm) tm.onclick = function () { draft.byVisits = !draft.byVisits; sig = ''; render(); };
    }

    document.querySelectorAll('[data-aspect]').forEach(function (b) {
      b.onclick = function () { act('aspect', { k: b.dataset.aspect }); };
    });

    document.querySelectorAll('[data-draw]').forEach(function (b) {
      b.onclick = function () { act('draw', {}); };
    });

    var ba = document.getElementById('backaspect');
    if (ba) ba.onclick = function () { act('aspect', { k: '' }); };

    document.querySelectorAll('[data-move]').forEach(function (b) {
      b.onclick = function () { act('move', { round: S.fightNow.round, value: Number(b.dataset.move) }); };
    });

    document.querySelectorAll('[data-pray]').forEach(function (b) {
      b.onclick = function () { act('pray', { idx: Number(b.dataset.pray) }); };
    });

    var v = document.getElementById('verse');
    if (v) v.onclick = function () { act('verse'); };

    var save = document.getElementById('savebl');
    if (save) save.onclick = function () {
      var text = document.getElementById('bl').value;
      writeLine(text);
      // 只送「有寫」這件事上去。那句話留在這支手機裡，一個字都不會離開。
      // **什麼都沒寫也算送出** —— 幸福根基 +5 看的是他按了沒。
      act('bless', { has: !!text.trim() });
      // 按鈕先變「已更新」，3 秒後變回來。
      // ⚠️ 變回來的時候**只改按鈕上的字，不重畫整頁** —— 重畫會把他正在補的字洗掉。
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

    // 進到週卡這一頁＝這一關做完了。狀態回來之後才畫圖。
    if (S.phase.id === 'card' && !me.cardDone) act('card');

    var img = document.getElementById('cardimg');
    if (img) {
      var make = function () {
        var cv = document.createElement('canvas');
        var mine = (me.cards || [])[me.pick];
        drawWeekCard(cv, {
          week: 6,
          name: me.name,
          outer: me.outer, outerPrev: me.outerStart,
          inner: me.inner, innerLabel: '幸福根基',
          verseRef: S.verse.ref, verseText: S.verse.text,
          // 他挑的那一張 —— 隔週再看到這張卡，他想得起自己今天挑了什麼。
          path: mine ? { label: 'MY CARD', steps: [mine.aspect + ' · ' + mine.text] } : null,
          // 第八週的護照要收這一行（架構第九節）。
          // **不印他被打中幾次、幫了幾個人** —— 印上去就是一張成績單。
          stamp: '這一仗，全場 ' + S.playerCount + ' 個人一起打贏',
          burdenLabel: 'MY BATTLE',
          burdenAsk: S.bless.ask + '：',
          burden: readLine(),
        });
        cardURL = cv.toDataURL('image/png');
        img.src = cardURL;
        // 開新分頁看的是這一份。**blob: 不是 data:** —— Chrome 擋掉 data: 的頂層導航。
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

  // ── 主渲染 ───────────────────────────────────────────────────────────
  function render() {
    if (!S) return;
    var me = S.me;

    if (!me) {
      statusEl.hidden = true;
      if (sig !== 'join') {
        sig = 'join';
        screen.innerHTML = '<h2>幸福模擬器</h2><p>第六關 · 十字架的勝利</p>' +
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
    document.getElementById('innerv').textContent = me.inner ? me.inner : '—';
    document.getElementById('innerbar').style.width = me.inner + '%';

    // ⚠️ 得勝禱告那一格正在打的字不能進這一行 —— 一變就整頁重畫，焦點會被踢掉。
    var next = [
      S.phase.id, S.cardsNow.open, S.bossNow.merged, (S.me && S.me.aspect) || '',
      S.fightNow.round, S.fightNow.revealed, S.crossStep, S.goodOpen,
      S.togetherNow.round, S.togetherNow.struck,
      (me.hits || []).map(function (h) { return h.i + ':' + h.prays + (h.prayed ? 'p' : ''); }).join(','),
      me.outer, me.inner, me.visits, me.pick, me.move,
      me.receivedVerse, me.cardDone, me.prayed,
      draft.byVisits,
    ].join('|');
    if (next !== sig) {
      sig = next;
      screen.innerHTML = (views[S.phase.id] || function () { return wait('看大螢幕'); })(me);
      bind(me);
    }
  }

  // 沒有房號就先問房號（掃 QR 進來的話網址上就有，這頁不會出現）
  if (!ROOM) {
    statusEl.hidden = true;
    screen.innerHTML = '<h2>幸福模擬器</h2><p>第六關 · 十字架的勝利</p>' +
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
