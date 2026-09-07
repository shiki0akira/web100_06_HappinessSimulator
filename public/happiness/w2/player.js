// 玩家手機 · 第二關「真相大白」
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

  var WEEK = 2;
  var ROOM = Room.readCode();
  // 測試用：同一台電腦要開多個玩家，就在網址後面加 &seat=2、&seat=3……
  var SEAT = new URLSearchParams(location.search).get('seat') || '';
  var PID_KEY = 'happiness_pid_w2_' + ROOM + (SEAT ? '_' + SEAT : '');
  var BURDEN_KEY = 'happiness_burden_w2_' + ROOM + (SEAT ? '_' + SEAT : '');

  // 那一句話只存在這支手機裡，一個字都不會離開這台裝置。
  function readBurden() { try { return localStorage.getItem(BURDEN_KEY) || ''; } catch (e) { return ''; } }
  function writeBurden(t) { try { localStorage.setItem(BURDEN_KEY, t); } catch (e) {} }

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
  var draft = { newcomer: false, keep: [], editing: false };

  // ── 畫面 ─────────────────────────────────────────────────────────────
  var wait = function (msg, sub) {
    return '<div class="wait"><div class="dot">. . .</div><p style="font-size:21px;color:var(--ink-2)">' +
      esc(msg) + '</p>' + (sub ? '<p style="font-size:17px">' + esc(sub) + '</p>' : '') + '</div>';
  };

  // 他保住的那三樣。揭曉還沒開到的那幾樣不給數字 —— 手機上先看到答案就沒戲了。
  function myBoard(items, big) {
    if (!items.length) return '';
    return '<div class="mine' + (big ? ' big' : '') + '">' + items.map(function (it) {
      return '<div class="mrow' + (it.revealed ? ' open' : '') + '">' +
        '<img src="/happiness/shared/art/asset-' + it.id + '.svg" alt="">' +
        '<span class="nm">' + esc(it.name) + '</span>' +
        '<span class="v">' + (it.revealed ? '剩 ' + it.left + '%' : '？') + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  var views = {
    lobby: function (me) {
      return '<h2>你已經進場了</h2>' +
        '<p>目前 ' + S.playerCount + ' 個人在場。等主持人開始，這個畫面會自己跳。</p>' +
        '<p class="mono" style="color:var(--ink-3);font-size:16px">手機不要鎖螢幕，等一下會用到。</p>' +
        '<button class="btn ghost fullbtn" id="rename">改名字</button>';
    },

    // 接關。幸福指數用打的（卡片上的數字），第幾次來用點的。
    reconnect: function (me) {
      if (me.outer !== null) {
        return wait('已接上：' + me.outer + ' 分', '這是你第 ' + me.visits + ' 次來');
      }
      if (draft.newcomer) {
        return '<h2>沒關係，直接評估現在的自己</h2>' +
          '<p>0 到 100，憑直覺。上一關沒來、忘記帶卡片、第一次來——都走這條路，一樣算數。</p>' +
          '<div class="slider"><div class="val" id="sv">50</div>' +
          '<input type="range" min="0" max="100" value="50" id="sl">' +
          '<div class="ends"><span>0</span><span>100</span></div></div>' +
          '<p style="margin-top:20px">這是你第幾次來？</p>' +
          '<div class="visits">' +
            '<button class="btn primary" data-v="1">第一次</button>' +
            '<button class="btn" data-v="2">第二次</button>' +
          '</div>' +
          '<p class="privacy">選好次數就送出了。</p>';
      }
      return '<h2>打開上一次的卡片</h2>' +
        '<p>輸入卡片上的<b>幸福指數</b>。</p>' +
        '<input id="oc" type="tel" inputmode="numeric" maxlength="3" placeholder="58" class="numin">' +
        '<p style="margin-top:20px">這是你第幾次來？</p>' +
        '<div class="visits">' +
          '<button class="btn" data-v="1">第一次</button>' +
          '<button class="btn primary" data-v="2">第二次</button>' +
        '</div>' +
        '<button class="btn ghost fullbtn" id="nocard">我第一次來 / 忘記帶卡片</button>' +
        '<p class="privacy">選好次數就送出了。忘記帶卡片完全沒關係，按上面那個按鈕就好 —— 今天的遊戲不吃上一關的資料。</p>';
    },

    keep_intro: function (me) {
      return '<h2>人生只能保住三樣</h2>' +
        '<ul style="color:var(--ink-2);font-size:18px;padding-left:20px">' +
          '<li>大螢幕上那些，三十年後你只保得住 <b>' + S.keepCount + ' 樣</b></li>' +
          '<li>不用錢、不用搶，<b>每個人都拿得到自己要的那三樣</b></li>' +
          '<li>選好之前都可以改</li>' +
        '</ul>' + wait('等主持人開始');
    },

    keep: function (me) {
      // 送出過了、而且不在改的狀態 → 只給他看自己選的
      if (me.keepDone && !draft.editing) {
        return '<h2>你保住的三樣</h2>' +
          myBoard(me.survive, true) +
          '<button class="btn ghost fullbtn" id="redo">改一下</button>' +
          '<p class="privacy">翻頁之後就不能改了。</p>';
      }
      var left = S.keepCount - draft.keep.length;
      return '<h2>選出你要保住的三樣</h2>' +
        '<p>三十年後，只有這三樣還在你手上。</p>' +
        '<div class="lotgrid">' + S.assets.map(function (a) {
          var on = draft.keep.indexOf(a.id) >= 0;
          var off = !on && left <= 0;
          return '<div class="lotchk' + (on ? ' on' : '') + (off ? ' off' : '') + '" data-keep="' + a.id + '">' +
            '<span class="box"></span>' +
            '<img class="chkart" src="/happiness/shared/art/asset-' + a.id + '.svg" alt="">' +
            '<span>' + esc(a.name) + '</span></div>';
        }).join('') +
          '<div class="lotchk locked" id="lockedtile"><span class="box">' + esc(S.locked.name) + '</span>' +
            '<span>' + esc(S.locked.label) + '</span></div>' +
        '</div>' +
        '<p class="privacy" id="lockmsg"></p>' +
        '<button class="btn primary fullbtn" id="savekeep"' + (left === 0 ? '' : ' disabled') + '>' +
          (left > 0 ? '還要選 ' + left + ' 樣' : '就這三樣') + '</button>';
    },

    keep_result: function (me) {
      return '<h2>你保住的三樣</h2>' + myBoard(me.survive, true) + wait('看大螢幕');
    },

    q20: function (me) {
      if (me.q20 !== null) return wait('已送出：' + S.q20.options[me.q20], '看大螢幕');
      return '<h2>' + esc(S.q20.question) + '</h2>' +
        myBoard(me.survive, false) +
        '<p style="margin-top:18px">憑直覺，沒有正確答案。</p>' +
        '<div class="lotgrid">' + S.q20.options.map(function (o, i) {
          return '<button class="btn fullbtn" style="margin-top:0" data-q="' + i + '">' + esc(o) + '</button>';
        }).join('') + '</div>';
    },
    q20_result: function () { return wait('看大螢幕'); },
    ff_intro: function (me) {
      return '<h2>時間快轉三十年</h2>' +
        '<p>你剛剛保住的那三樣，現在要驗貨。</p>' +
        myBoard(me.survive, true) +
        wait('等主持人開第一項');
    },

    depreciate: function (me) {
      var r = S.reveal;
      if (r.idx < 0) return wait('看大螢幕', '等主持人開第一項');
      var it = r.item;
      var mine = me.keep.indexOf(it.id) >= 0;
      return '<div class="depcard card-face">' +
          '<div class="idx">' + (r.idx + 1) + ' / ' + r.total + '</div>' +
          '<div class="nm">' + esc(it.name) + '</div>' +
          '<div class="rate">−' + Math.round(it.rate * 100) + '%</div>' +
          '<div class="why">' + esc(it.why) + '</div>' +
        '</div>' +
        (mine
          ? '<div class="hit">你 −' + me.lastLoss + ' 分</div>'
          : '<div class="safe">這一項你沒有保</div>') +
        myBoard(me.survive, false) +
        '<p class="mono" style="text-align:center;margin-top:18px;color:var(--ink-3)">' +
          '開場 ' + me.outerStart + ' → 現在 ' + me.outer + '</p>';
    },

    survive: function (me) {
      return '<h2>三十年後，你手上剩下</h2>' +
        myBoard(me.survive, true) +
        '<div class="slider" style="margin-top:22px"><div class="val">' + (me.outer == null ? '—' : me.outer) + '</div></div>' +
        '<p class="mono" style="text-align:center;color:var(--ink-3)">' +
          '開場 ' + me.outerStart + ' → 現在 ' + me.outer + '（−' + me.totalLoss + '）</p>' +
        wait('看大螢幕');
    },

    verse_half: function () {
      return '<div class="verse-p"><span class="ref">' + esc(S.verse.ref) + ' · 上半句</span>' +
        '<blockquote style="color:var(--vol)">「' + esc(S.verse.first) + '」</blockquote></div>' +
        wait('聽主持人說');
    },

    mystery: function (me) {
      return '<div class="qmark">？</div>' +
        '<div class="eternal"><div class="nm">' + esc(S.mystery.name) + '</div>' +
          '<div class="rate">−0%</div></div>' +
        '<p style="text-align:center;margin-top:18px">' + esc(S.mystery.why) + '</p>' +
        '<p style="text-align:center;color:var(--ink-3);font-size:17px">剛剛那張表上，你選不到這一樣。</p>' +
        wait('看大螢幕');
    },

    free: function (me) {
      return '<h2>今天，它不用錢</h2>' +
        '<div class="verse-p"><span class="ref">' + esc(S.verse.ref) + ' · 下半句</span>' +
          '<blockquote style="color:var(--root-c)">「' + esc(S.verse.second) + '」</blockquote></div>' +
        '<button class="btn ' + (me.want ? 'primary' : '') + ' wantbtn" id="want">' +
          (me.want ? '✓ 我要' : '我 要') + '</button>' +
        '<p class="privacy">' + (me.want
          ? '記下來了。再按一次可以收回，沒有人會問你。'
          : '不按也完全沒關係。今天沒準備好，後面還有五關。') + '</p>';
    },

    naming: function (me) {
      return '<h2>它有名字了</h2>' +
        '<div class="eternal" style="margin-top:26px"><div class="nm" style="font-size:44px">幸福根基</div>' +
          '<div class="rate">' + me.inner + '</div></div>' +
        '<p style="margin-top:22px">上一關大家都在掉分的時候，有一條線是往上的。<b>就是它。</b></p>' +
        '<p>這條線不會被任何事件扣掉。它從你來的第一天開始長。</p>' +
        wait('看大螢幕');
    },

    message: function () { return wait('聽主持人分享'); },

    verse: function (me) {
      return '<div class="verse-p"><span class="ref">' + esc(S.verse.ref) + '</span>' +
        '<blockquote>「' + esc(S.verse.text) + '」</blockquote></div>' +
        (me.receivedVerse
          ? '<div class="grew"><img src="/happiness/shared/art/verse.svg" alt="">' +
            '<p class="ok">已領受<br><b>幸福根基 +10</b></p></div>'
          : '<button class="btn primary fullbtn" id="verse">領受</button>');
    },

    prayer: function (me) {
      var mine = readBurden();
      return '<h2>祝福禱告</h2>' +
        '<p>今天有哪一項的折舊，讓你心裡動了一下？寫下來，等一下一起禱告。</p>' +
        '<textarea id="bd" maxlength="120" placeholder="一句話就好">' + esc(mine) + '</textarea>' +
        '<button class="btn primary fullbtn" id="savebd">' + (mine ? '更新' : '寫好了') + '</button>' +
        (me.hasBurden || mine
          ? '<div class="grew"><img src="/happiness/shared/art/prayer.svg" alt="">' +
            '<p class="ok">已存下<br><b>幸福根基 +5</b></p></div>'
          : '') +
        '<p class="privacy">🔒 這句話只存在你這支手機裡，主持人的畫面只看得到「已填寫」。它會印在你今天的卡片上。</p>';
    },

    card: function (me) {
      // 等 +5 記上去了再畫 —— 卡片上要印的是禱告之後的數字，不是之前的
      if (!me.cardDone) return '<h2>儲存模擬回憶</h2>' + wait('生成中');
      return '<h2>儲存模擬回憶</h2>' +
        '<p>長按圖片存進相簿。這張卡是下一關的入場券。</p>' +
        '<img class="weekcard" id="cardimg" alt="第二關週卡">' +
        '<a class="btn primary fullbtn" id="dl" style="display:block;text-align:center;text-decoration:none" download="幸福模擬器-W2-真相大白.png">下載這張卡</a>' +
        '<p class="privacy">現在就存。不要等回家——回家就忘了。</p>';
    },

    end: function (me) {
      return '<h2>下週見</h2>' +
        '<p>下次見。記得帶著你的卡片——開場會請你輸入上面的幸福指數。</p>' +
        (cardURL ? '<img class="weekcard" src="' + cardURL + '" alt="第二關週卡">' : '') +
        '<p class="privacy">忘記存也沒關係。下一關直接重新評估現在的自己，一樣算數。</p>';
    },
  };

  // ── 綁定事件 ─────────────────────────────────────────────────────────
  function sendReconnect(visits, value) {
    act('reconnect', { value: value, visits: visits, newcomer: draft.newcomer });
  }

  function bind(me) {
    // 接關
    var sl = document.getElementById('sl');
    if (sl) {
      var sv = document.getElementById('sv');
      sl.oninput = function () { sv.textContent = sl.value; };
    }
    var nocard = document.getElementById('nocard');
    if (nocard) nocard.onclick = function () { draft.newcomer = true; sig = ''; render(); };

    document.querySelectorAll('[data-v]').forEach(function (b) {
      b.onclick = function () {
        var visits = Number(b.dataset.v);
        var oc = document.getElementById('oc');
        var value = sl ? Number(sl.value) : Number(oc && oc.value);
        if (!sl && !(value >= 0 && value <= 100)) { if (oc) oc.focus(); return; }
        sendReconnect(visits, value);
      };
    });

    // 保住三樣
    document.querySelectorAll('[data-keep]').forEach(function (d) {
      d.onclick = function () {
        var id = Number(d.dataset.keep);
        var i = draft.keep.indexOf(id);
        if (i >= 0) draft.keep.splice(i, 1);
        else if (draft.keep.length >= S.keepCount) return;   // 三樣就是三樣
        else draft.keep.push(id);
        sig = '';
        render();
      };
    });
    var lockedTile = document.getElementById('lockedtile');
    if (lockedTile) lockedTile.onclick = function () {
      var m = document.getElementById('lockmsg');
      if (m) m.textContent = S.locked.hint;
    };
    var sk = document.getElementById('savekeep');
    if (sk) sk.onclick = function () {
      if (draft.keep.length !== S.keepCount) return;
      draft.editing = false;
      act('keep', { ids: draft.keep });
    };
    var redo = document.getElementById('redo');
    if (redo) redo.onclick = function () {
      // 已經送出過了，把伺服器那份拉回來當草稿，重開選單
      draft.keep = me.keep.slice();
      draft.editing = true;
      sig = '';
      render();
    };

    document.querySelectorAll('[data-q]').forEach(function (b) {
      b.onclick = function () { act('q20', { value: Number(b.dataset.q) }); };
    });

    var w = document.getElementById('want');
    if (w) w.onclick = function () { act('want'); };

    var v = document.getElementById('verse');
    if (v) v.onclick = function () { act('verse'); };

    var sb = document.getElementById('savebd');
    if (sb) sb.onclick = function () {
      var text = document.getElementById('bd').value;
      writeBurden(text);
      // 只送「有寫」這件事上去。那句話留在這支手機裡，一個字都不會離開。
      act('burden', { has: !!text.trim() });
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
          week: 2,
          name: me.name,
          outer: me.outer, outerPrev: me.outerStart,
          inner: me.inner, innerLabel: '幸福根基',
          verseRef: S.verse.ref, verseText: S.verse.text, burden: readBurden(),
          listLabel: 'I KEPT',
          bought: me.survive.map(function (it) {
            return it.name + (it.revealed ? ' 剩' + it.left + '%' : '');
          }),
        });
        cardURL = cv.toDataURL('image/png');
        img.src = cardURL;
        var dl = document.getElementById('dl');
        if (dl) dl.href = cardURL;
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
        screen.innerHTML = '<h2>幸福模擬器</h2><p>第二關 · 真相大白</p>' +
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
    document.getElementById('innerlbl').textContent = S.named ? '幸福根基' : '？？？';
    document.getElementById('innerv').textContent = me.inner;
    document.getElementById('innerbar').style.width = me.inner + '%';

    var next = [
      S.phase.id, S.reveal.idx, S.named, S.mysteryOpen, S.keepOpen,
      me.outer, me.inner, me.visits, me.keepDone, me.keep.join(','),
      me.q20, me.want, me.receivedVerse, me.cardDone, me.hasBurden,
      draft.newcomer, draft.editing, draft.keep.join(','),
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
    screen.innerHTML = '<h2>幸福模擬器</h2><p>第二關 · 真相大白</p>' +
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
