// 玩家手機 · 第五關「當上帝來敲門」
//
// ⚠️ 這一關手機會亮的：接關、想不想收禮物、五次敲門、彩蛋開門、領受、寫那個人（再加存卡）。
// 其餘的頁手機都是安靜的 —— 上帝是誰、見證、翻卡片那十幾分鐘要他們抬頭看人。
(function () {
  'use strict';
  var S = null, pid = null, src = null, sig = '', cardURL = null, cardBlob = null;
  // 祝福禱告那顆按鈕：按下去之後 3 秒內寫「已更新」，不然按了看起來沒反應
  var blessSaved = false, blessSavedTimer = null;
  // 彩蛋：「隔著門問」「假裝不在家」只在這支手機上換字，**不送伺服器**
  var eggMsg = '', hideIdx = 0;
  var screen = document.getElementById('screen');
  var statusEl = document.getElementById('status');

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var WEEK = 5;
  var ROOM = Room.readCode();
  // 測試用：同一台電腦要開多個玩家，就在網址後面加 &seat=2、&seat=3……
  var SEAT = new URLSearchParams(location.search).get('seat') || '';
  var PID_KEY = 'happiness_pid_w5_' + ROOM + (SEAT ? '_' + SEAT : '');
  var LINE_KEY = 'happiness_line_w5_' + ROOM + (SEAT ? '_' + SEAT : '');

  // 「這個禮拜，我想把祝福帶給＿＿」那一句只存在這支手機裡，
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

  // 彩蛋的時間：**現在真實的時間**
  function nowText() {
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes();
    var part = h < 6 ? '凌晨' : h < 12 ? '早上' : h < 13 ? '中午' : h < 18 ? '下午' : '晚上';
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return '今天 · ' + part + ' ' + h12 + ':' + (m < 10 ? '0' : '') + m;
  }
  setInterval(function () {
    var c = document.getElementById('pclock');
    if (c) c.textContent = nowText();
  }, 10000);

  // 送出之前只活在這支手機上的暫存
  var draft = { byVisits: false };

  // ── 畫面 ─────────────────────────────────────────────────────────────
  var wait = function (msg, sub) {
    return '<div class="wait"><div class="dot">. . .</div><p style="font-size:21px;color:var(--ink-2)">' +
      esc(msg) + '</p>' + (sub ? '<p style="font-size:17px">' + esc(sub) + '</p>' : '') + '</div>';
  };

  var list = function (title, items) {
    return '<h2>' + esc(title) + '</h2>' +
      '<div class="howlist">' + items.map(function (t, i) {
        return '<div class="howrow"><b>' + (i + 1) + '. ' + esc(t) + '</b></div>';
      }).join('') + '</div>';
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
        '<img class="doorart" src="/happiness/shared/art/door-knock.svg" alt="">' +
        wait('看大螢幕');
    },

    // 不算分，隨時可以改。
    gift: function (me) {
      return '<h2>' + esc(S.gift.title) + '</h2>' +
        '<div class="opts">' + S.gift.options.map(function (o, i) {
          return '<button class="opt' + (me.want === i ? ' on' : '') + '" data-want="' + i + '">' + esc(o) + '</button>';
        }).join('') + '</div>' +
        '<p class="privacy">' + (me.want >= 0 ? '選好了。隨時可以改。' : '選一個。') + '</p>';
    },

    // 敲門人生。公布之前可以改，公布之後看自己那一格發生了什麼。
    knocks: function (me) {
      var k = S.knockNow;
      var head = '<div class="qn">' + (k.idx + 1) + ' / ' + k.total + '</div>' +
        '<div class="kcal">第 ' + k.day + ' 天 · ' + esc(k.time) + '</div>' +
        '<div class="kscene">' +
          '<div class="peep"><img src="/happiness/shared/art/visitor-' + esc(k.art) + '.svg" alt=""></div>' +
          '<div><div class="kwho">' + esc(k.who) + '</div>' +
          '<div class="ksays">「' + esc(k.says) + '」</div></div>' +
        '</div>';

      if (k.revealed) {
        if (me.knock < 0) return head + wait('看大螢幕', '這一次你沒有選');
        var col = k.cols[me.knock];
        var lines = [];
        if (k.luck && me.luck >= 0) lines.push(k.luck[me.luck].t);
        if (col.t && !(k.luck && me.knock === 0)) lines.push(col.t);
        var g = me.gain == null ? 0 : me.gain;
        return head +
          '<div class="reply"><span class="replyfrom">' + esc(col.label) + '</span><br>' +
            lines.map(esc).join('<br>') + '</div>' +
          (me.outer !== null
            ? '<div class="hit ' + (g > 0 ? 'up' : g < 0 ? '' : 'zero') + '">幸福指數 ' + fmt(g) + '</div>'
            : '') +
          wait('看大螢幕');
      }

      return head +
        '<div class="opts">' + S.choices.map(function (c, i) {
          return '<button class="opt' + (me.knock === i ? ' on' : '') + '" data-knock="' + i + '">' + esc(c) + '</button>';
        }).join('') + '</div>' +
        '<p class="privacy">' + (me.knock >= 0 ? '主持人公布之前都可以改。' : '你平常會怎麼做，就怎麼按。') + '</p>';
    },

    month: function (me) {
      return '<h2>' + esc(S.month.title) + '</h2>' +
        (me.outer !== null
          ? '<div class="monthme"><span>開始</span><b>' + me.knockBase + '</b><span>→　現在</span><b>' + me.outer + '</b></div>'
          : '') +
        '<p class="privacy">' + esc(S.month.end) + '</p>' +
        wait('看大螢幕');
    },

    // 彩蛋。**不在模擬裡、不算分。** 三顆鈕都在，但只有「開門」會讓敲門聲停下來。
    egg: function (me) {
      if (me.opened) {
        return '<img class="doorart" src="/happiness/shared/art/door-open.svg" alt="">' +
          '<div class="opened">' + esc(S.egg.opened) + '</div>' +
          '<p class="eggnote">' + esc(S.egg.note) + '</p>' +
          (S.eggNow.done
            ? '<div class="eggreveal">' + esc(S.egg.reveal) + '</div>'
            : wait('看大螢幕'));
      }
      return '<div class="clock" id="pclock">' + esc(nowText()) + '</div>' +
        '<img class="doorart" src="/happiness/shared/art/door-knock.svg" alt="">' +
        '<div class="eggsays">「' + esc(S.egg.says) + '」</div>' +
        '<div class="eggmsg" id="eggmsg">' + esc(eggMsg) + '</div>' +
        '<div class="opts">' + S.choices.map(function (c, i) {
          return '<button class="opt" data-egg="' + i + '">' + esc(c) + '</button>';
        }).join('') + '</div>';
    },

    who: function () { return list(S.who.title, S.who.items); },

    seek: function () { return list(S.seek.title, S.seek.items); },

    verse: function (me) {
      return '<div class="verse-p"><span class="ref">' + esc(S.verse.ref) + '</span>' +
        '<blockquote>「' + esc(S.verse.text) + '」</blockquote></div>' +
        (me.receivedVerse
          ? '<div class="grew"><img src="/happiness/shared/art/verse.svg" alt="">' +
            '<p class="ok">已領受<br><b>幸福根基 +10</b></p></div>'
          : '<button class="btn primary fullbtn" id="verse">領受</button>');
    },

    // 見證那四分鐘手機要安靜。抬頭看講的那個人。
    testimony: function () {
      return '<h2>見證分享</h2>' + wait('把手機放下', '聽他講');
    },

    // 翻卡片。沒有卡的人什麼都不用做。
    cards: function () {
      return '<h2>' + esc(S.cards.title) + '</h2>' +
        '<p>上一次有來的人，打開相簿，找第四關那張卡，看看你寫的那一句。</p>' +
        '<p class="bigline">' + esc(S.cards.line) + '</p>' +
        '<p class="privacy">沒有卡的人，就聽聽看。</p>';
    },

    // 回應。**第 1 點只印字** —— 手機上沒有任何按鈕。
    respond: function () { return list(S.respond.title, S.respond.items); },

    // 祝福禱告。七關收尾的固定儀式，這一關有指定題目。**什麼都沒寫也按得下去。**
    bless: function (me) {
      var mine = readLine();
      return '<h2>祝福禱告</h2>' +
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
        '<img class="weekcard" id="cardimg" alt="第五關週卡">' +
        '<a class="btn primary fullbtn" id="zoom" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">放大這張卡</a>';
    },

    end: function () {
      return '<h2>下週見</h2>' +
        '<p>你寫的那個人，這禮拜去敲他的門。</p>' +
        (cardURL ? '<img class="weekcard" src="' + cardURL + '" alt="第五關週卡">' : '') +
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

    document.querySelectorAll('[data-want]').forEach(function (b) {
      b.onclick = function () { act('want', { value: Number(b.dataset.want) }); };
    });

    document.querySelectorAll('[data-knock]').forEach(function (b) {
      b.onclick = function () { act('knock', { idx: S.knockNow.idx, value: Number(b.dataset.knock) }); };
    });

    // 彩蛋。只有「開門」送伺服器；另外兩顆只換這支手機上的那一行字，
    // **而且不重畫整頁** —— 門上的敲門動畫不會被打斷。
    document.querySelectorAll('[data-egg]').forEach(function (b) {
      b.onclick = function () {
        var i = Number(b.dataset.egg);
        if (i === 0) { act('open'); return; }
        if (i === 1) {
          eggMsg = S.egg.ask;
        } else {
          eggMsg = S.egg.hide[hideIdx % S.egg.hide.length];
          hideIdx += 1;
        }
        var m = document.getElementById('eggmsg');
        if (m) m.textContent = eggMsg;
      };
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
        drawWeekCard(cv, {
          week: 5,
          name: me.name,
          outer: me.outer, outerPrev: me.outerStart,
          inner: me.inner, innerLabel: '幸福根基',
          verseRef: S.verse.ref, verseText: S.verse.text,
          // 卡片上**不印禮物、不印彩蛋有沒有開門** —— 那一格不該看起來像「已決志」的紀錄。
          burdenLabel: 'I WILL BLESS',
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
        screen.innerHTML = '<h2>幸福模擬器</h2><p>第五關 · 當上帝來敲門</p>' +
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

    // 離開彩蛋那一頁，手機上那一行字就清掉 —— 回來的時候重新開始。
    if (S.phase.id !== 'egg') { eggMsg = ''; hideIdx = 0; }

    // ⚠️ 祝福禱告那一格正在打的字不能進這一行 —— 一變就整頁重畫，焦點會被踢掉。
    var next = [
      S.phase.id, S.knockNow.idx, S.knockNow.revealed, S.eggNow.done,
      me.outer, me.inner, me.visits, me.want, me.knock, me.gain, me.luck, me.opened,
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
    screen.innerHTML = '<h2>幸福模擬器</h2><p>第五關 · 當上帝來敲門</p>' +
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
