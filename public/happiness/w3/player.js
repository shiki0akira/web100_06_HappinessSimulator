// 玩家手機 · 第三關「萬世巨星」
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

  var WEEK = 3;
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
  var draft = { byVisits: false, whois: [] };

  // ── 畫面 ─────────────────────────────────────────────────────────────
  var wait = function (msg, sub) {
    return '<div class="wait"><div class="dot">. . .</div><p style="font-size:21px;color:var(--ink-2)">' +
      esc(msg) + '</p>' + (sub ? '<p style="font-size:17px">' + esc(sub) + '</p>' : '') + '</div>';
  };

  // 他自己走過的路。走到哪裡就印到哪裡。
  function myPath(me) {
    if (!me.path.length) return '';
    return '<div class="mypath">' + me.path.map(function (c, k) {
      return '<span>' + esc(c === 'A' ? S.forks[k].a.short : S.forks[k].b.short) + '</span>';
    }).join('<i>→</i>') + '</div>';
  }

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
            '<input id="ic" type="tel" inputmode="numeric" maxlength="2" placeholder="0 – 95" class="numin">') +
        '<button class="btn primary fullbtn" id="sendrec">送出</button>' +
        '<button class="btn ghost fullbtn" id="togglemode">' +
          (draft.byVisits ? '我有卡片，改填幸福根基' : '忘記帶卡片？改填「這是你第幾次來」') + '</button>';
    },

    // 岔路：兩顆單選按鈕，點來點去都可以 —— 主持人公布結果之前都算數。
    // 公布之後這一頁就變成他自己那一邊的結果。
    map: function (me) {
      var m = S.mapNow;
      var mine = me.path[m.idx];
      // 跟大螢幕同一句話。手機上留著 N / 5，因為這裡沒有別的進度可看。
      var head = '<div class="qn">當你 ' + esc(m.when) + '…　<small>' +
          (m.idx + 1) + ' / ' + m.total + '</small></div>' +
        myPath(me);
      if (m.revealed) {
        var x = mine === 'B' ? m.b : m.a;
        if (!mine) return head + wait('看大螢幕', '這一題你沒有選');
        return head +
          '<div class="ending">' + esc(x.result) + '</div>' +
          '<div class="hit ' + (x.delta > 0 ? 'up' : 'down') + '">幸福指數 ' +
            (x.delta > 0 ? '+' : '') + x.delta + '</div>' +
          wait('看大螢幕');
      }
      return head +
        '<div class="lotgrid">' +
          '<div class="lotchk road' + (mine === 'A' ? ' on' : '') + '" data-fork="A">' +
            '<span><b>' + esc(m.a.text) + '</b></span></div>' +
          '<div class="lotchk road' + (mine === 'B' ? ' on' : '') + '" data-fork="B">' +
            '<span><b>' + esc(m.b.text) + '</b></span></div>' +
        '</div>' +
        (mine ? '<p class="privacy">選好了，主持人公布結果之前都可以改。</p>'
              : '<p class="privacy">選你自己會選的那一個 —— 不用想哪個是對的。</p>');
    },

    // 結局：只給他自己那一條。三十二條要在大螢幕上一起看才有意思。
    endings: function (me) {
      if (!me.ending) return '<h2>你的人生</h2>' + wait('看大螢幕', '這一輪你沒有走完');
      var t = me.ending.total;
      return '<h2>你的人生</h2>' +
        myPath(me) +
        '<div class="ending">' + esc(me.ending.text) + '</div>' +
        '<div class="hit ' + (t > 0 ? 'up' : 'down') + '">幸福指數 ' + (t > 0 ? '+' : '') + t + '</div>' +
        wait('看大螢幕', '三十二條路都在上面');
    },

    sins: function () {
      return '<h2>' + esc(S.sins.title) + '</h2>' + wait('看大螢幕');
    },

    sin: function () {
      return '<h2>' + esc(S.sin.title) + '</h2>' + wait('聽主持人說');
    },

    star: function () {
      return '<h2>' + esc(S.star.teaseTitle) + '</h2>' +
        '<p>' + esc(S.star.teaseKicker) + '</p>' +
        wait('看大螢幕');
    },

    // 猜句子：三選一，點一下就好。**不加分。**
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
            ? '<p class="myans">' + (right ? '你答對了' : '你選的是「' + esc(q.options[mine]) + '」') + '</p>'
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

    // 解答頁：只跟他講他自己的成績，別人的不關他的事。
    answers: function (me) {
      return '<h2>八題的答案</h2>' +
        '<div class="score">你答對 <b>' + me.correct + '</b> 題</div>' +
        wait('看大螢幕');
    },

    reveal: function () {
      return '<h2>' + esc(S.star.title) + '</h2>' +
        '<div class="quotelist">' + S.board.filter(function (b) { return b.jesus; }).map(function (b) {
          return '<div class="qrow">「' + esc(b.text) + '」</div>';
        }).join('') + '</div>' +
        wait('看大螢幕');
    },

    afterlife: function (me) {
      if (me.vote !== null) return wait('已投票：' + S.afterlife.options[me.vote], '看大螢幕');
      return '<h2>' + esc(S.afterlife.ask) + '</h2>' +
        '<div class="lotgrid">' + S.afterlife.options.map(function (o, i) {
          return '<button class="btn fullbtn" style="margin-top:0" data-v="' + i + '">' + esc(o) + '</button>';
        }).join('') + '</div>' +
        '<p class="privacy">沒有標準答案。</p>';
    },

    life: function () {
      return '<div class="verse-p"><span class="ref">' + esc(S.life.ref) + '</span>' +
        '<blockquote>「' + esc(S.life.quote) + '」</blockquote></div>' +
        wait('聽主持人說');
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
    // 這一頁手機上**只寫「看大螢幕」**。三段同樣的字印在他手裡，
    // 他會低頭讀完，然後主持人正在講的那三句就沒有人在聽了。
    cross: function () {
      return '<h2>' + esc(S.cross.title) + '</h2>' + wait('看大螢幕');
    },

    // 祝福禱告：上面複選「以前」，下面自己寫「現在」。兩格都只有本人看得到。
    prayer: function (me) {
      var mine = readLine();
      var chosen = (me.hasBurden || me.whois.length) ? me.whois : draft.whois;
      return '<h2>祝福禱告</h2>' +
        '<p class="fieldlbl">' + esc(S.whois.ask) + '<span class="sub">可以複選，點一點就好</span></p>' +
        '<div class="lotgrid">' + S.whois.options.map(function (o, i) {
          var on = chosen.indexOf(i) >= 0;
          return '<div class="lotchk' + (on ? ' on' : '') + '" data-who="' + i + '">' +
            '<span class="box"></span><span>' + esc(o) + '</span></div>';
        }).join('') + '</div>' +
        '<p class="fieldlbl">' + esc(S.whois.now) + '<span class="sub">自己寫一句</span></p>' +
        '<textarea id="bd" maxlength="120" placeholder="' + esc(S.whois.now) + '……">' + esc(mine) + '</textarea>' +
        '<button class="btn primary fullbtn" id="savebd">' + (me.prayed ? '更新' : '寫好了') + '</button>' +
        (me.prayed
          ? '<div class="grew"><img src="/happiness/shared/art/prayer.svg" alt="">' +
            '<p class="ok">已存下<br><b>幸福根基 +5</b></p></div>'
          : '') +
        '<p class="privacy">🔒 這兩格只存在你這支手機裡，主持人的畫面只看得到「已填寫」。它們會並排印在你今天的卡片上。</p>';
    },

    // **不給「下載」。** 下載到手機上就掉進檔案夾裡，而且 iOS 的下載流程
    // 每支手機長得都不一樣，現場會卡住。大家本來就都用截圖 ——
    // 那就給他一頁滿版的圖，按一下截圖就走。
    card: function (me) {
      if (!me.cardDone) return '<h2>儲存模擬回憶</h2>' + wait('生成中');
      return '<h2>儲存模擬回憶</h2>' +
        '<p>這張卡是下一關的入場券。</p>' +
        '<img class="weekcard" id="cardimg" alt="第三關週卡">' +
        '<a class="btn primary fullbtn" id="zoom" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">放大這張卡</a>';
    },

    end: function (me) {
      return '<h2>下週見</h2>' +
        '<p>下次見。記得帶著你的卡片——開場會請你輸入上面的兩個數字。</p>' +
        (cardURL ? '<img class="weekcard" src="' + cardURL + '" alt="第三關週卡">' : '') +
        (cardURL ? '<a class="btn ghost fullbtn" id="zoom" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">放大這張卡</a>' : '') +
        '<p class="privacy">忘記截也沒關係。下一關直接重新評估現在的自己，一樣算數。</p>';
    },
  };



  // 開新分頁看的那一張：**照這支手機的比例補成整頁**。
  // 卡片是固定的 1080×1560，直接開起來底下會露出一條瀏覽器的白，
  // 而且每支手機露出來的長度還不一樣。這裡把它放進一張跟螢幕同比例的底上，
  // 開起來剛好滿版 —— 截圖就是乾淨的一整張，沒有白邊。
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

    document.querySelectorAll('[data-fork]').forEach(function (d) {
      d.onclick = function () { act('fork', { idx: S.mapNow.idx, value: d.dataset.fork }); };
    });

    document.querySelectorAll('[data-q]').forEach(function (b) {
      b.onclick = function () { act('quiz', { idx: S.quiz.idx, value: Number(b.dataset.q) }); };
    });

    document.querySelectorAll('[data-v]').forEach(function (b) {
      b.onclick = function () { act('vote', { value: Number(b.dataset.v) }); };
    });

    document.querySelectorAll('[data-who]').forEach(function (d) {
      d.onclick = function () {
        var i = Number(d.dataset.who);
        if (me.hasBurden || me.whois.length) draft.whois = me.whois.slice();
        var at = draft.whois.indexOf(i);
        if (at >= 0) draft.whois.splice(at, 1); else draft.whois.push(i);
        // 勾了就先存上去，免得他勾完手機掉線就沒了。
        // **但這裡不算送出** —— 幸福根基 +5 和「已存下」要等他自己按那顆按鈕。
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
      act('burden', { whois: (me.whois.length ? me.whois : draft.whois), has: !!text.trim(), submit: true });
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
          week: 3,
          name: me.name,
          outer: me.outer, outerPrev: me.outerStart,
          inner: me.inner, innerLabel: '幸福根基',
          verseRef: S.verse.ref, verseText: S.verse.text,
          // 人生模擬器按的那五下也留在卡片上 ——
          // 隔週再看到這張卡，他想得起自己選了什麼。
          path: {
            label: 'MY PATH',
            steps: me.path.map(function (c, k) {
              return c === 'A' ? S.forks[k].a.short : S.forks[k].b.short;
            }),
          },
          // 卡片上並排印「以前／現在」—— 這一關真正的產出
          listLabel: 'I THOUGHT',
          bought: me.whois.map(function (i) { return S.whois.options[i]; }),
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
      S.phase.id, S.mapNow.idx, S.mapNow.revealed, S.quiz.idx, S.quiz.revealed,
      me.outer, me.inner, me.visits, me.path.join(''), me.answers.join(','), me.vote,
      me.whois.join(','), me.receivedVerse, me.cardDone, me.hasBurden,
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
