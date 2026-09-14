// 玩家手機 · 第四關「幸福連線」
//
// ⚠️ 這一關手機只會亮四次：接關、打電話、撥出、寫那一句（再加存卡）。
// 其餘的頁手機都是安靜的 —— 見證、一起禱告、恩典卡那十二分鐘要他們抬頭看人。
(function () {
  'use strict';
  var S = null, pid = null, src = null, sig = '', cardURL = null, cardBlob = null;
  var screen = document.getElementById('screen');
  var statusEl = document.getElementById('status');

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var WEEK = 4;
  var ROOM = Room.readCode();
  // 測試用：同一台電腦要開多個玩家，就在網址後面加 &seat=2、&seat=3……
  var SEAT = new URLSearchParams(location.search).get('seat') || '';
  var PID_KEY = 'happiness_pid_w4_' + ROOM + (SEAT ? '_' + SEAT : '');
  var LINE_KEY = 'happiness_line_w4_' + ROOM + (SEAT ? '_' + SEAT : '');

  // 「我現在最需要他幫我的是＿＿」那一句只存在這支手機裡，
  // 一個字都不會離開這台裝置。**這一關完全不上牆，連「我願意分享」都沒有。**
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

  // ── 畫面 ─────────────────────────────────────────────────────────────
  var wait = function (msg, sub) {
    return '<div class="wait"><div class="dot">. . .</div><p style="font-size:21px;color:var(--ink-2)">' +
      esc(msg) + '</p>' + (sub ? '<p style="font-size:17px">' + esc(sub) + '</p>' : '') + '</div>';
  };

  var views = {
    lobby: function (me) {
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

    intro: function () {
      return '<h2>' + esc(S.intro.title) + '</h2>' +
        '<p>' + esc(S.intro.line) + '</p>' +
        wait('看大螢幕');
    },

    // 七件事，**可以複選**，一排一個。主持人公布之前都可以改。
    calls: function (me) {
      var c = S.callsNow;
      var picks = me.picks || [];
      var head = '<div class="qn">' + (c.idx + 1) + ' / ' + c.total + '</div>' +
        '<div class="when">' + esc(c.text) + '</div>';

      if (c.revealed) {
        if (!picks.length) return head + wait('看大螢幕', '這一題你沒有選');
        // 他選了幾件就給他幾段 —— 複選的人本來就該看到每一件後來怎麼了。
        return head +
          picks.map(function (i) {
            var l = c.lines[i];
            if (!l) return '';
            return '<div class="reply"><span class="replyfrom">' + esc(l.name) + '</span><br>' +
              esc(l.reply) + '</div>';
          }).join('') +
          // 不替這一頁下結論 —— 「每一件都陪了你」是下一頁統計圖的收口。
          wait('看大螢幕');
      }

      var otherOn = picks.indexOf(S.otherIdx) >= 0;
      return head +
        '<div class="lotgrid lines">' + c.lines.map(function (l, i) {
          return '<div class="lotchk line' + (picks.indexOf(i) >= 0 ? ' on' : '') + '" data-call="' + i + '">' +
            '<span class="box"></span>' +
            '<span class="t"><b>' + esc(l.name) + '</b></span></div>';
        }).join('') + '</div>' +
        // 勾了「其他」才長出輸入框。**這一格會上大螢幕**，所以底下那句警語不能省。
        (otherOn
          ? '<div class="otherbox">' +
              '<input id="oth" maxlength="16" placeholder="你會做什麼？" value="' + esc(me.other || '') + '">' +
              '<p class="warn">⚠️ 這一格寫的東西**全場都看得到**。不想公開就取消勾選，完全沒關係。</p>' +
            '</div>'
          : '') +
        '<p class="privacy">' + (picks.length
          ? '可以複選。主持人公布之前都可以改。'
          : '你真的會做的那幾件 —— 可以選好幾個。') + '</p>';
    },

    idol: function () {
      return '<h2>' + esc(S.idol.title) + '</h2>' + wait('聽主持人說');
    },

    ask: function () {
      return '<h2>' + esc(S.ask.title) + '</h2>' + wait('看大螢幕');
    },

    // 第三通。**一按就接** —— 不要鈴聲、不要等待、不要語音信箱。
    // **不加分。** 那一刻的重量在「接通」和那半句經文上，不在數字上。
    hotline: function (me) {
      if (me.called) {
        return '<div class="connected">' + esc(S.hotline.connected) + '</div>' +
          '<div class="halfverse">「' + esc(S.hotline.half) + '」</div>' +
          wait('看大螢幕');
      }
      return '<h2>' + esc(S.hotline.title) + '</h2>' +
        '<img class="dialart" src="/happiness/shared/art/hotline.svg" alt="">' +
        '<div class="dialconds">' + S.hotline.conds.map(function (x) {
          return '<span>' + esc(x) + '</span>';
        }).join('') + '</div>' +
        '<div class="dialknows">' + esc(S.hotline.knows) + '</div>' +
        '<button class="btn primary fullbtn" id="dial">' + esc(S.hotline.dial) + '</button>';
    },

    // 見證那四分鐘手機要安靜。抬頭看講的那個人。
    testimony: function () {
      return '<h2>見證分享</h2>' + wait('把手機放下', '聽他講');
    },

    verse: function (me) {
      return '<div class="verse-p"><span class="ref">' + esc(S.verse.ref) + '</span>' +
        '<blockquote>「' + esc(S.verse.text) + '」</blockquote></div>' +
        (me.receivedVerse
          ? '<div class="grew"><img src="/happiness/shared/art/verse.svg" alt="">' +
            '<p class="ok">已領受<br><b>幸福根基 +10</b></p></div>'
          : '<button class="btn primary fullbtn" id="verse">領受</button>');
    },

    // 祝福禱告。七關收尾的固定儀式，這一關有指定題目。
    // 開頭印出來 —— 空白的框大家會寫「平安喜樂」。**什麼都沒寫也按得下去。**
    need: function (me) {
      var mine = readLine();
      return '<h2>祝福禱告</h2>' +
        '<p class="fieldlbl">' + esc(S.need.ask) + '<span class="sub">' + esc(S.need.hint) + '</span></p>' +
        '<textarea id="nd" maxlength="120" placeholder="' + esc(S.need.ask) + '……">' + esc(mine) + '</textarea>' +
        '<button class="btn primary fullbtn" id="savend">' + (me.prayed ? '更新' : '寫好了') + '</button>' +
        (me.prayed
          ? '<div class="grew"><img src="/happiness/shared/art/prayer.svg" alt="">' +
            '<p class="ok">已存下<br><b>幸福根基 +5</b></p></div>'
          : '') +
        '<p class="privacy">🔒 這一句只存在你這支手機裡，大螢幕上只看得到「幾人已寫下」。它會印在你今天的卡片上，下一關開場要用到它。</p>';
    },

    how: function () {
      return '<h2>' + esc(S.how.title) + '</h2>' +
        '<div class="howlist">' + S.how.items.map(function (it, i) {
          return '<div class="howrow"><b>' + (i + 1) + '. ' + esc(it.k) + '</b>' +
            '<span>' + esc(it.v) + '</span></div>';
        }).join('') + '</div>';
    },

    // 一起禱告。手機上只有起頭和收尾那兩句 ——
    // **不要印制式禱告文**，那會讓他低頭跟著念，而這一頁是要他自己講。
    pray: function () {
      return '<h2>' + esc(S.pray.title) + '</h2>' +
        '<div class="prayscript">' +
          '<p>' + esc(S.pray.open) + '</p>' +
          '<p class="dim">' + esc(S.pray.middle) + '</p>' +
          '<p>' + esc(S.pray.close) + '</p>' +
        '</div>' +
        '<p class="privacy">心裡講也可以。</p>';
    },

    // 天父的回信。**手機不做第二顆按鈕** —— 那一封是全場一起拆的，
    // 每個人自己點一次就變成七支手機各拆各的，那個時刻就散了。
    letter: function () {
      if (!S.letterOpen) return '<h2>' + esc(S.grace.title) + '</h2>' + wait('看大螢幕', esc(S.grace.sealed));
      return '<div class="letterp">' +
          '<img src="/happiness/shared/art/letter-open.svg" alt="">' +
          '<blockquote>「' + esc(S.grace.half) + '」</blockquote>' +
          '<span class="ref">' + esc(S.verse.ref) + '</span>' +
          '<span class="from">' + esc(S.grace.from) + '</span>' +
        '</div>';
    },

    // **不給「下載」。** 下載到手機上就掉進檔案夾裡，而且 iOS 的下載流程
    // 每支手機長得都不一樣，現場會卡住。大家本來就都用截圖。
    card: function (me) {
      if (!me.cardDone) return '<h2>儲存模擬回憶</h2>' + wait('生成中');
      return '<h2>儲存模擬回憶</h2>' +
        '<p>這張卡是下一關的入場券。</p>' +
        '<img class="weekcard" id="cardimg" alt="第四關週卡">' +
        '<a class="btn primary fullbtn" id="zoom" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">放大這張卡</a>';
    },

    end: function (me) {
      return '<h2>下週見</h2>' +
        '<p>那張恩典卡收好，下一關第一件事就是把它拿出來。</p>' +
        (cardURL ? '<img class="weekcard" src="' + cardURL + '" alt="第四關週卡">' : '') +
        (cardURL ? '<a class="btn ghost fullbtn" id="zoom" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">放大這張卡</a>' : '') +
        '<p class="privacy">忘記截也沒關係。下一關直接重新評估現在的自己，一樣算數。</p>';
    },
  };

  // 開新分頁看的那一張：**照這支手機的比例補成整頁**。
  // 卡片是固定的 1080×1560，直接開起來底下會露出一條瀏覽器的白，
  // 而且每支手機露出來的長度還不一樣。
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

    // 複選：點一下切換那一格。點到「其他」底下才會長出輸入框。
    document.querySelectorAll('[data-call]').forEach(function (d) {
      d.onclick = function () { act('call', { idx: S.callsNow.idx, value: Number(d.dataset.call) }); };
    });

    // 「其他」自己寫的那一句。邊打邊送上去 —— 現場沒有人會記得按送出，
    // 而且主持人按「公布結果」的那一刻要看得到他打到一半的東西。
    var oth = document.getElementById('oth');
    if (oth) {
      var push = function () { act('callOther', { idx: S.callsNow.idx, text: oth.value }); };
      oth.oninput = push;
      oth.onblur = push;
      oth.onkeydown = function (e) { if (e.key === 'Enter') { push(); oth.blur(); } };
    }

    var dl = document.getElementById('dial');
    if (dl) dl.onclick = function () { act('dial'); };

    var v = document.getElementById('verse');
    if (v) v.onclick = function () { act('verse'); };

    var save = document.getElementById('savend');
    if (save) save.onclick = function () {
      var text = document.getElementById('nd').value;
      writeLine(text);
      // 只送「有寫」這件事上去。那句話留在這支手機裡，一個字都不會離開。
      // **什麼都沒寫也算送出** —— 幸福根基 +5 看的是他按了沒。
      act('need', { has: !!text.trim() });
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
          week: 4,
          name: me.name,
          outer: me.outer, outerPrev: me.outerStart,
          inner: me.inner, innerLabel: '幸福根基',
          verseRef: S.verse.ref, verseText: S.verse.text,
          // 卡片上**不印恩典卡** —— 實體卡在他手上，第五關兩張並排。
          // 這一句是這張卡唯一的個人文字，而且第五關開場就是靠它。
          burdenLabel: 'I ASKED FOR',
          burdenAsk: S.need.ask + '：',
          burden: readLine(),
        });
        cardURL = cv.toDataURL('image/png');
        img.src = cardURL;
        // 開新分頁看的是這一份。**blob: 不是 data:** ——
        // Chrome 擋掉 data: 的頂層導航，blob: 才開得起來。
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
        screen.innerHTML = '<h2>幸福模擬器</h2><p>第四關 · 幸福連線</p>' +
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

    // ⚠️ **me.other 不能進這一行。** 它一變就會整頁重畫，
    // 而他正在那個輸入框裡打字 —— 打一個字焦點就被踢掉一次。
    // 勾選（picks）要進來，因為「其他」那一格勾了才長出輸入框。
    var next = [
      S.phase.id, S.callsNow.idx, S.callsNow.revealed, S.letterOpen,
      me.outer, me.inner, me.visits, (me.picks || []).join(','), me.called,
      me.receivedVerse, me.cardDone, me.hasNeed, me.prayed,
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
    screen.innerHTML = '<h2>幸福模擬器</h2><p>第四關 · 幸福連線</p>' +
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
