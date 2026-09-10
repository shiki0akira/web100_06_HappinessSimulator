// 玩家手機 · 第三關「萬世巨星」
(function () {
  'use strict';
  var S = null, pid = null, src = null, sig = '', cardURL = null;
  var screen = document.getElementById('screen');
  var statusEl = document.getElementById('status');

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var WEEK = 3;
  var CLIMB_MS = 4000;
  var ROOM = Room.readCode();
  // 測試用：同一台電腦要開多個玩家，就在網址後面加 &seat=2、&seat=3……
  var SEAT = new URLSearchParams(location.search).get('seat') || '';
  var PID_KEY = 'happiness_pid_w3_' + ROOM + (SEAT ? '_' + SEAT : '');
  var LINE_KEY = 'happiness_line_w3_' + ROOM + (SEAT ? '_' + SEAT : '');

  // 「現在我覺得他是＿＿」那一句只存在這支手機裡，一個字都不會離開這台裝置。
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
  var draft = { byVisits: false, sins: [], sinsSent: false, whois: [] };

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
        '<p><span class="sub">第一次來的話自由填 —— 按你現在的感覺給自己一個分數就好，第二格填 0，系統會幫你補上 15。</span></p>' +
        '<p class="fieldlbl">幸福指數</p>' +
        '<input id="oc" type="tel" inputmode="numeric" maxlength="3" placeholder="0 – 100" class="numin">' +
        (draft.byVisits
          ? '<p class="fieldlbl">這是你第幾次來？<span class="sub">系統會幫你算第二條線</span></p>' +
            '<input id="vc" type="tel" inputmode="numeric" maxlength="1" placeholder="1" class="numin">'
          : '<p class="fieldlbl">幸福根基<span class="sub">卡片上的第二個數字，第一次來就填 0</span></p>' +
            '<input id="ic" type="tel" inputmode="numeric" maxlength="2" placeholder="0 – 95" class="numin">') +
        '<button class="btn primary fullbtn" id="sendrec">送出</button>' +
        '<button class="btn ghost fullbtn" id="togglemode">' +
          (draft.byVisits ? '我有卡片，改填幸福根基' : '忘記帶卡片？改填「這是你第幾次來」') + '</button>';
    },

    // 猜句子：三選一，點一下就好。揭答案之前隨時可以改。
    quiz: function (me) {
      var q = S.quiz;
      var mine = me.answers[q.idx];
      var picked = typeof mine === 'number';
      var head = '<div class="qn">Q' + (q.idx + 1) + ' / ' + q.total + '</div>' +
        '<div class="quote">「' + esc(q.text) + '」</div>';
      if (q.revealed) {
        // 答錯不要有紅色、不要有音效。這一頁的功能是好玩，不是考倒他們。
        var right = picked && mine === q.answer;
        return head +
          '<div class="ansbox' + (right ? ' right' : '') + '">' +
            '<span class="lbl">答案</span><b>' + esc(q.options[q.answer]) + '</b>' +
            '<span class="src">' + esc(q.src) + '</span></div>' +
          (picked
            ? '<p class="myans">' + (right ? '你答對了　<b>+1</b>' : '你選的是「' + esc(q.options[mine]) + '」') + '</p>'
            : '<p class="myans">這一題你沒有答。</p>') +
          wait('看大螢幕');
      }
      return head +
        '<div class="lotgrid">' + q.options.map(function (o, i) {
          return '<button class="btn fullbtn' + (mine === i ? ' primary' : '') + '" style="margin-top:0" data-q="' + i + '">' +
            esc(o) + '</button>';
        }).join('') + '</div>' +
        (picked ? '<p class="privacy">選好了，主持人揭答案之前都可以改。</p>' : '');
    },

    reveal: function () {
      return '<h2>萬世巨星</h2>' +
        '<p>' + esc(S.reveal.lead) + '</p>' +
        '<div class="quotelist">' + S.board.filter(function (b) { return b.jesus; }).map(function (b) {
          return '<div class="qrow">「' + esc(b.text) + '」</div>';
        }).join('') + '</div>' +
        wait('看大螢幕');
    },

    // 罪：複選。不加分、不扣分、不評分。
    sins: function (me) {
      var chosen = draft.sinsSent ? me.sins : draft.sins;
      return '<h2>' + esc(S.sinAsk.title) + '</h2>' +
        '<p>' + esc(S.sinAsk.lead) + '</p>' +
        '<div class="lotgrid">' + S.sins.map(function (o, i) {
          var on = chosen.indexOf(i) >= 0;
          return '<div class="lotchk' + (on ? ' on' : '') + '" data-sin="' + i + '">' +
            '<span class="box"></span><span>' + esc(o) + '</span></div>';
        }).join('') + '</div>' +
        '<button class="btn primary fullbtn" id="savesins">' + (draft.sinsSent ? '更新' : '送出') + '</button>' +
        '<p class="privacy">沒有標準答案，也不加分。憑你自己的感覺勾。</p>';
    },

    sin_teach: function () {
      return '<div class="misskey">' + esc(S.sinTeach.key) + '</div>' + wait('聽主持人說');
    },

    judge: function () {
      return '<h2>' + esc(S.judge.title) + '</h2>' + wait('聽主持人說');
    },

    // 三條路：選一條，然後全場一起往上爬。
    roads: function (me) {
      if (S.climbed) {
        var mine = null;
        S.ladders.forEach(function (l) { if (l.id === me.road) mine = l; });
        if (!mine) return '<h2>人生模擬器</h2>' + wait('看大螢幕', '這一輪你沒有選路');
        return '<h2>' + esc(mine.name) + '</h2>' +
          '<div class="steps" id="steps">' + mine.steps.map(function (t, i) {
            return '<div class="st" data-i="' + i + '">' + esc(t) + '</div>';
          }).join('') + '</div>' +
          '<div class="short" id="short">' + esc(S.roads.short) + '</div>' +
          (me.climbGain
            ? '<div class="hit up">+' + me.climbGain + '　然後 −' + me.climbFall + '</div>'
            : '');
      }
      if (me.road) {
        var name = '';
        S.ladders.forEach(function (l) { if (l.id === me.road) name = l.name; });
        return '<h2>你選了</h2>' +
          '<div class="picked">' + esc(name) + '</div>' +
          '<button class="btn ghost fullbtn" id="reroad">改一條</button>' +
          '<p class="privacy">爬上去之後就不能改了。</p>';
      }
      return '<h2>' + esc(S.roads.title) + '</h2>' +
        '<p>' + esc(S.roads.lead) + '　<span class="sub">三條都試過的話，選你花最多力氣的那一條。</span></p>' +
        '<div class="lotgrid">' + S.ladders.map(function (l) {
          return '<div class="lotchk road" data-road="' + esc(l.id) + '">' +
            '<span><b>' + esc(l.name) + '</b><span class="sub">' + esc(l.sub) + '</span></span></div>';
        }).join('') + '</div>';
    },

    way: function () {
      var h = S.verse.halves;
      return '<div class="verse-p half' + (S.wayStep >= 2 ? ' second' : '') + '">' +
        '<blockquote>「<span class="on">' + esc(h[0]) + '</span>' +
          '<span class="' + (S.wayStep >= 2 ? 'on' : 'off') + '">' + esc(h[1]) + '</span>」</blockquote>' +
        '<span class="ref">' + esc(S.verse.ref) + '</span></div>' +
        wait('看大螢幕');
    },

    paid: function (me) {
      return '<h2>' + esc(S.paidInfo.title) + '</h2>' +
        '<div class="cross">✝</div>' +
        '<p style="text-align:center">' + esc(S.paidInfo.line) + '</p>' +
        (me.paid ? '<div class="hit up">幸福指數 +' + me.paid + '</div>' : '');
    },

    verse: function (me) {
      return '<div class="verse-p"><span class="ref">' + esc(S.verse.ref) + '</span>' +
        '<blockquote>「' + esc(S.verse.text) + '」</blockquote></div>' +
        (me.receivedVerse
          ? '<div class="grew"><img src="/happiness/shared/art/verse.svg" alt="">' +
            '<p class="ok">已領受<br><b>幸福根基 +10</b></p></div>'
          : '<button class="btn primary fullbtn" id="verse">領受</button>');
    },

    // 這一頁手機上沒有任何按鈕。今天不做決志、不舉手、不點名。
    baptism: function () {
      return '<h2>' + esc(S.baptism.title) + '</h2>' +
        S.baptism.lines.map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('') +
        '<div class="close">' + esc(S.baptism.close) + '</div>';
    },

    // 祝福禱告：上面複選「以前」，下面自己寫「現在」。兩格都只有本人看得到。
    prayer: function (me) {
      var mine = readLine();
      var chosen = me.hasBurden || me.whois.length ? me.whois : draft.whois;
      return '<h2>祝福禱告</h2>' +
        '<p class="fieldlbl">' + esc(S.whois.ask) + '<span class="sub">可以複選，點一點就好</span></p>' +
        '<div class="lotgrid">' + S.whois.options.map(function (o, i) {
          var on = chosen.indexOf(i) >= 0;
          return '<div class="lotchk' + (on ? ' on' : '') + '" data-who="' + i + '">' +
            '<span class="box"></span><span>' + esc(o) + '</span></div>';
        }).join('') + '</div>' +
        '<p class="fieldlbl">' + esc(S.whois.now) + '<span class="sub">自己寫一句</span></p>' +
        '<textarea id="bd" maxlength="120" placeholder="' + esc(S.whois.now) + '……">' + esc(mine) + '</textarea>' +
        '<button class="btn primary fullbtn" id="savebd">' + (me.hasBurden ? '更新' : '寫好了') + '</button>' +
        (me.prayed || me.hasBurden
          ? '<div class="grew"><img src="/happiness/shared/art/prayer.svg" alt="">' +
            '<p class="ok">已存下<br><b>幸福根基 +5</b></p></div>'
          : '') +
        '<p class="privacy">🔒 這兩格只存在你這支手機裡，主持人的畫面只看得到「已填寫」。它們會並排印在你今天的卡片上。</p>';
    },

    card: function (me) {
      if (!me.cardDone) return '<h2>儲存模擬回憶</h2>' + wait('生成中');
      return '<h2>儲存模擬回憶</h2>' +
        '<p>長按圖片存進相簿。這張卡是下一關的入場券。</p>' +
        '<img class="weekcard" id="cardimg" alt="第三關週卡">' +
        '<a class="btn primary fullbtn" id="dl" style="display:block;text-align:center;text-decoration:none" download="幸福模擬器-W3-萬世巨星.png">下載這張卡</a>' +
        '<p class="privacy">現在就存。不要等回家——回家就忘了。</p>';
    },

    end: function (me) {
      return '<h2>下週見</h2>' +
        '<p>下次見。記得帶著你的卡片——開場會請你輸入上面的兩個數字。</p>' +
        (cardURL ? '<img class="weekcard" src="' + cardURL + '" alt="第三關週卡">' : '') +
        '<p class="privacy">忘記存也沒關係。下一關直接重新評估現在的自己，一樣算數。</p>';
    },
  };

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

    document.querySelectorAll('[data-q]').forEach(function (b) {
      b.onclick = function () { act('quiz', { idx: S.quiz.idx, value: Number(b.dataset.q) }); };
    });

    document.querySelectorAll('[data-sin]').forEach(function (d) {
      d.onclick = function () {
        var i = Number(d.dataset.sin);
        if (draft.sinsSent) { draft.sins = me.sins.slice(); draft.sinsSent = false; }
        var at = draft.sins.indexOf(i);
        if (at >= 0) draft.sins.splice(at, 1); else draft.sins.push(i);
        sig = '';
        render();
      };
    });
    var ss = document.getElementById('savesins');
    if (ss) ss.onclick = function () {
      draft.sinsSent = true;
      act('sins', { ids: draft.sins });
    };

    document.querySelectorAll('[data-road]').forEach(function (d) {
      d.onclick = function () { act('road', { id: d.dataset.road }); };
    });
    var rr = document.getElementById('reroad');
    if (rr) rr.onclick = function () { act('road', { id: null }); };

    document.querySelectorAll('[data-who]').forEach(function (d) {
      d.onclick = function () {
        var i = Number(d.dataset.who);
        if (me.hasBurden || me.whois.length) draft.whois = me.whois.slice();
        var at = draft.whois.indexOf(i);
        if (at >= 0) draft.whois.splice(at, 1); else draft.whois.push(i);
        // 勾了就先送上去，不用等他按「寫好了」—— 有人只勾不寫
        act('burden', { whois: draft.whois, has: !!readLine().trim() });
      };
    });

    var v = document.getElementById('verse');
    if (v) v.onclick = function () { act('verse'); };

    var save = document.getElementById('savebd');
    if (save) save.onclick = function () {
      var text = document.getElementById('bd').value;
      writeLine(text);
      // 只送「有寫」這件事上去。那句話留在這支手機裡，一個字都不會離開。
      act('burden', { whois: (me.whois.length ? me.whois : draft.whois), has: !!text.trim() });
      sig = '';
      render();
    };

    var rn = document.getElementById('rename');
    if (rn) rn.onclick = function () {
      var n = prompt('你的名字', me.name);
      if (n) act('rename', { name: n });
    };

    // 進到週卡這一頁＝這一關做完了。狀態回來之後才畫圖。
    if (S.phase.id === 'card' && !me.cardDone) act('card');

    var img = document.getElementById('cardimg');
    if (img) {
      var make = function () {
        var cv = document.createElement('canvas');
        drawWeekCard(cv, {
          week: 3,
          name: me.name,
          outer: me.outer, outerPrev: me.outerStart,
          inner: me.inner, innerLabel: '幸福根基',
          verseRef: S.verse.ref, verseText: S.verse.text,
          // 卡片上並排印「以前／現在」—— 這一關真正的產出
          listLabel: 'I THOUGHT',
          bought: me.whois.map(function (i) { return S.whois.options[i]; }),
          burden: readLine(),
        });
        cardURL = cv.toDataURL('image/png');
        img.src = cardURL;
        var dl = document.getElementById('dl');
        if (dl) dl.href = cardURL;
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(make); else make();
    }
  }

  // 爬梯子：手機上的階梯跟著大螢幕一起亮，跑完那一下踩空。
  var climbTimer = null;
  function runClimb(instant) {
    var box = document.getElementById('steps');
    if (!box) return;
    var sts = box.querySelectorAll('.st');
    var shortEl = document.getElementById('short');
    clearInterval(climbTimer);
    var show = function (n) {
      for (var i = 0; i < sts.length; i++) sts[i].classList.toggle('lit', i < n);
      if (shortEl) shortEl.classList.toggle('on', n >= sts.length);
    };
    if (instant) { show(sts.length); return; }
    show(0);
    var t0 = Date.now();
    climbTimer = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / CLIMB_MS);
      show(Math.min(sts.length, Math.floor(k / 0.85 * sts.length) + (k > 0 ? 1 : 0)));
      if (k >= 1) clearInterval(climbTimer);
    }, 80);
  }

  // ── 主渲染 ───────────────────────────────────────────────────────────
  var lastClimbed = false;
  function render() {
    if (!S) return;
    var me = S.me;

    if (!me) {
      statusEl.hidden = true;
      if (sig !== 'join') {
        sig = 'join';
        screen.innerHTML = '<h2>幸福模擬器</h2><p>第三關 · 萬世巨星</p>' +
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

    var next = [
      S.phase.id, S.quiz.idx, S.quiz.revealed, S.climbed, S.paid, S.wayStep,
      me.outer, me.inner, me.visits, me.answers.join(','), me.road,
      me.sins.join(','), me.whois.join(','),
      me.receivedVerse, me.cardDone, me.hasBurden,
      draft.byVisits, draft.sins.join(','), draft.sinsSent,
    ].join('|');
    if (next !== sig) {
      sig = next;
      screen.innerHTML = (views[S.phase.id] || function () { return wait('看大螢幕'); })(me);
      bind(me);
      // 爬梯子的動畫：climbed 從 false 變 true 的那一刻才跑，翻回來不重跑
      if (S.phase.id === 'roads' && S.climbed) runClimb(lastClimbed);
      else clearInterval(climbTimer);
    }
    lastClimbed = S.climbed;
  }

  // 沒有房號就先問房號（掃 QR 進來的話網址上就有，這頁不會出現）
  if (!ROOM) {
    statusEl.hidden = true;
    screen.innerHTML = '<h2>幸福模擬器</h2><p>第三關 · 萬世巨星</p>' +
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
