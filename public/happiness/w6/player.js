// 玩家手機 · 第六關「十字架的勝利」
//
// ⚠️ 這一關手機會亮的：接關、挑一塊、抽一張、選職業、五回合出手、
// 領受經文＋領受復活、第二階段出手、最後一擊、寫那一仗（再加存卡）。
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
  function jobArt(a) { return '/happiness/shared/art/' + a + '.svg'; }

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

  function classOf(k) {
    for (var i = 0; i < S.classes.length; i++) if (S.classes[i].k === k) return S.classes[i];
    return null;
  }

  // 打鬥那兩頁共用：**每一回合**四個職業挑一個，或什麼都不做。
  // 第一階段選的時候**看不到它代表什麼**，公布了才翻出來；第二階段已經知道了，照樣寫出來。
  function battleScreen(me, b, isWin) {
    var head = '<div class="qn">第 ' + (b.round + 1) + ' / ' + b.total + ' 回合 · ' + esc(b.aspect) + '</div>' +
      '<h2 style="margin-top:6px">' + esc(b.attack) + '</h2>';
    var mine = isWin ? me.winChoice : me.choice;
    var c = classOf(mine);

    if (b.revealed) {
      if (!mine) return head + wait('看大螢幕', '這一回合你沒有選');
      return head +
        '<div class="reply">' + (c ? '<img class="replyart" src="' + jobArt(c.art) + '" alt="">' : '') +
          '<span class="replyfrom">' + esc(c ? c.t + '　' + c.act : S.idle.t) + '</span><br>' +
          esc(c ? (isWin ? '這一次，它擋不住。' : c.d) : S.idle.d) + '</div>' +
        (isWin
          ? '<div class="hit up">魔王 −' + (c ? c.dmg * S.winInfo.boost : 0) + '</div>'
          : '<div class="hit">幸福指數 −' + (c ? c.loss : S.idle.loss) + '　魔王 −' + (c ? c.dmg : 0) + '</div>') +
        wait('看大螢幕');
    }

    return head +
      '<div class="opts">' + S.classes.map(function (k) {
        return '<button class="opt jobopt' + (mine === k.k ? ' on' : '') + '" data-pick="' + esc(k.k) + '">' +
          '<img src="' + jobArt(k.art) + '" alt="">' + esc(k.t) +
          (isWin ? '<small>' + esc(k.act) + '　傷害 ' + k.dmg * S.winInfo.boost + '</small>' : '') + '</button>';
      }).join('') +
        '<button class="opt' + (mine === 'idle' ? ' on' : '') + '" data-pick="idle">' + esc(S.idle.t) + '</button>' +
      '</div>' +
      '<p class="privacy">' + (isWin ? '' : '選了、公布了才知道它代表什麼。') +
        (mine === undefined ? '選一個。主持人公布之前都可以改。' : '主持人公布之前都可以改。') + '</p>';
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

    // 挑一塊，挑完同一頁就抽。**抽了之後就不能換一塊。**
    cards: function (me) {
      if (me.aspect && me.pick >= 0) {
        return '<div class="qn">' + esc(me.aspectName) + ' · 你抽到的</div>' +
          '<div class="mine"><div class="tx">' + esc(me.drawn.text) + '</div></div>' +
          wait(S.drawInfo.waiting);
      }
      if (me.aspect) {
        var n = me.deck || 4;
        var backs = '';
        for (var i = 0; i < n; i++) backs += '<button class="drawcard" data-draw="' + i + '">？</button>';
        return '<div class="qn">' + esc(me.aspectName) + '</div>' +
          '<h2 style="margin-top:6px">抽一張</h2>' +
          '<div class="deck">' + backs + '</div>' +
          '<p class="privacy">' + esc(S.drawInfo.hint) + '</p>' +
          '<button class="btn ghost fullbtn" id="backaspect">' + esc(S.pickInfo.change) + '</button>';
      }
      return '<h2>' + esc(S.pickInfo.title) + '</h2>' +
        '<p>' + esc(S.pickInfo.sub) + '</p>' +
        '<div class="aspects">' + S.aspects.map(function (a) {
          return '<button class="ab" data-aspect="' + esc(a.k) + '">' +
            '<img src="' + aspectArt(a.k) + '" alt="">' + esc(a.t) + '</button>';
        }).join('') + '</div>' +
        '<p class="privacy">' + esc(S.pickInfo.hint) + '只有你自己看得到。</p>';
    },

    // 公布。翻到這一頁伺服器就公布了。
    draw: function (me) {
      if (!(me.aspect && me.pick >= 0)) {
        return '<h2>' + esc(S.drawInfo.title) + '</h2>' +
          '<p>你上一頁沒有抽，所以這一頁沒有你的牌。</p>' + wait('看大螢幕');
      }
      return '<div class="qn">' + esc(me.aspectName) + ' · 你抽到的</div>' +
        '<div class="mine"><div class="tx">' + esc(me.drawn.text) + '</div></div>' +
        (me.cardLoss ? '<div class="hit">幸福指數 ' + fmt(-me.cardLoss) + '</div>' : '') + wait('看大螢幕');
    },

    tally: function (me) {
      return '<h2>' + esc(S.tally.title) + '</h2>' + myCard(me) + wait('看大螢幕');
    },

    bossIn: function () {
      return '<h2 class="center">' + esc(S.boss.name) + '</h2>' +
        '<img class="bossart" src="/happiness/shared/art/boss.svg" alt="">' +
        '<div class="hpline">' + S.boss.hp + ' / ' + S.boss.hp + '</div>';
    },

    // 四個職業：只有圖和名字。**這一頁不用選**，每一回合打的時候才選。
    job: function () {
      return '<h2>' + esc(S.jobInfo.title) + '</h2>' +
        '<p>' + esc(S.jobInfo.sub) + '</p>' +
        '<div class="aspects">' + S.classes.map(function (c) {
          return '<div class="ab"><img src="' + jobArt(c.art) + '" alt="">' + esc(c.t) + '</div>';
        }).join('') + '</div>' +
        '<p class="privacy">' + esc(S.jobInfo.hint) + '</p>';
    },

    fight: function (me) { return battleScreen(me, S.fightNow, false); },

    lost: function (me) {
      return '<h2 class="center">' + esc(S.lost.line) + '</h2>' +
        '<div class="hpline">' + S.boss.hp + ' / ' + S.boss.hp + '　血條補滿了</div>' +
        (me.fightLoss ? '<div class="hit">這五回合你掉了 ' + me.fightLoss + ' 分</div>' : '') +
        wait('看大螢幕');
    },

    // 十字架。**手機上沒有任何按鈕。** 最後一段就是「復活的大能」。
    cross: function () {
      var st = S.crossStep || 0;
      if (st >= 2) {
        return '<img class="bossart" src="/happiness/shared/art/' + esc(S.power.art) + '.svg" alt="">' +
          '<h2 class="center" style="margin-top:14px">' + esc(S.power.title) + '</h2>';
      }
      return '<h2 class="center">' + esc(S.cross.steps[st].t) + '</h2>' +
        '<img class="crossart" src="/happiness/shared/art/' + (st === 0 ? 'boss' : 'cross-dark') + '.svg" alt="">' +
        wait('看大螢幕');
    },

    // 領受經文 ＋ 領受復活。兩顆分開按。
    // ⚠️ 領受復活**不是門檻** —— 沒按的人第二階段照樣打得動。
    verse: function (me) {
      return '<div class="verse-p"><span class="ref">' + esc(S.verse.ref) + '</span>' +
        '<blockquote>「' + esc(S.verse.text) + '」</blockquote></div>' +
        (me.receivedVerse
          ? '<div class="grew"><img src="/happiness/shared/art/verse.svg" alt="">' +
            '<p class="ok">已領受<br><b>幸福根基 +10</b></p></div>'
          : '<button class="btn primary fullbtn" id="verse">' + esc(S.verse.receive) + '</button>') +
        (me.revived
          ? '<div class="grew"><img src="/happiness/shared/art/tomb-open.svg" alt="">' +
            '<p class="ok">' + esc(S.verse.revived) + '</p></div>'
          : '<button class="btn fullbtn revivebtn" id="revive">' + esc(S.verse.revive) + '</button>');
    },

    win: function (me) { return battleScreen(me, S.winNow, true); },

    // 最後一擊。**每個人都按得到。**
    beat: function (me) {
      if (S.beatNow.done) {
        return '<div class="qn center">' + esc(S.beatInfo.done) + '</div>' +
          '<img class="bossart" src="/happiness/shared/art/victory-party.svg" alt="" style="width:100%;max-width:360px">' +
          (me.beatGain ? '<div class="hit up">幸福指數 ' + fmt(me.beatGain) + '</div>' : '') +
          '<div class="qn center" style="margin-top:16px">' + esc(S.victory.lead) + '</div>' +
          '<h2 class="center" style="margin-top:6px">' + esc(S.victory.title) + '</h2>' +
          '<p class="bigline center">' + esc(S.victory.line) + '</p>';
      }
      if (me.beat) return '<h2 class="center">' + esc(S.beatInfo.title) + '</h2>' + wait('等其他人出手');
      return '<h2 class="center">' + esc(S.beatInfo.title) + '</h2>' +
        '<p class="center">' + esc(S.beatInfo.sub) + '</p>' +
        '<img class="bossart" src="/happiness/shared/art/boss.svg" alt="">' +
        '<button class="btn primary fullbtn" id="beat">' + esc(S.beatInfo.button) + '</button>';
    },

    goodOpen: function () {
      return '<h2>' + esc(S.good.title) + '</h2>' +
        '<div class="goodtwo">' +
          '<div class="gcol" style="opacity:.4"><h3>' + esc(S.good.leftLabel) + '</h3><ul>' +
            S.good.left.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
          '</ul></div>' +
          '<div class="gcol right"><h3>' + esc(S.good.rightLabel) + '</h3>' +
            '<ul>' + S.good.right.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
          '</div>' +
        '</div>' + wait('看大螢幕');
    },

    // 得勝禱告。**什麼都沒寫也按得下去。**
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
    var back = document.getElementById('backaspect');
    if (back) back.onclick = function () { act('aspect', { k: '' }); };

    document.querySelectorAll('[data-draw]').forEach(function (b) {
      b.onclick = function () { act('draw', {}); };
    });

    document.querySelectorAll('[data-pick]').forEach(function (b) {
      b.onclick = function () {
        var isWin = S.phase.id === 'win';
        act('act', { round: isWin ? S.winNow.round : S.fightNow.round, k: b.dataset.pick });
      };
    });

    var v = document.getElementById('verse');
    if (v) v.onclick = function () { act('verse'); };
    var rv = document.getElementById('revive');
    if (rv) rv.onclick = function () { act('revive'); };
    var bt = document.getElementById('beat');
    if (bt) bt.onclick = function () { act('beat'); };

    var save = document.getElementById('savebl');
    if (save) save.onclick = function () {
      var text = document.getElementById('bl').value;
      writeLine(text);
      // 只送「有寫」這件事上去。那句話留在這支手機裡，一個字都不會離開。
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
        drawWeekCard(cv, {
          week: 6,
          name: me.name,
          outer: me.outer, outerPrev: me.outerStart,
          inner: me.inner, innerLabel: '幸福根基',
          verseRef: S.verse.ref, verseText: S.verse.text,
          // 他抽到的那一張 —— 隔週再看到這張卡，他想得起今天打的是什麼。
          path: me.drawn ? { label: 'MY CARD', steps: [me.drawn.aspect + ' · ' + me.drawn.text] } : null,
          // 第八週的護照要收這一行（架構第九節）。
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
      S.phase.id, S.cardsNow.open, S.crossStep,
      S.fightNow.round, S.fightNow.revealed, S.winNow.round, S.winNow.revealed,
      S.beatNow.done, S.hp,
      me.outer, me.inner, me.visits, me.aspect, me.pick,
      me.choice, me.winChoice, me.revived, me.beat,
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
