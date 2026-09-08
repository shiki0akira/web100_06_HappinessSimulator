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
  var YEARS = 30;
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
  var draft = { newcomer: false, bag: [], editing: false };

  // ── 畫面 ─────────────────────────────────────────────────────────────
  var wait = function (msg, sub) {
    return '<div class="wait"><div class="dot">. . .</div><p style="font-size:21px;color:var(--ink-2)">' +
      esc(msg) + '</p>' + (sub ? '<p style="font-size:17px">' + esc(sub) + '</p>' : '') + '</div>';
  };

  // 他的袋子。三十年還沒過就不給數字 —— 手機上先看到答案就沒戲了。
  function bagBoard(items, big) {
    if (!items.length) return '';
    return '<div class="mine' + (big ? ' big' : '') + '">' + items.map(function (it) {
      var art = it.gift
        ? '<span class="gicon">' + (S.giftOpen ? '✦' : esc(S.gift.mask)) + '</span>'
        : '<img src="/happiness/shared/art/asset-' + it.id + '.svg" alt="">';
      // 還沒拆的那一份不寫名字，也不寫數字 —— 它就是今晚的伏筆
      var name = (it.gift && !S.giftOpen) ? '買三送一的那一樣' : it.name;
      var val = it.aged ? '剩 ' + it.left + '%' : (it.gift ? '尚未拆封' : '');
      return '<div class="mrow' + (it.aged ? ' open' : '') + (it.gift ? ' gift' : '') + '">' +
        art +
        '<span class="nm">' + esc(name) + '</span>' +
        '<span class="v">' + esc(val) + '</span>' +
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

    // 幸福人生商店：挑三樣，買三送一。
    shop: function (me) {
      if (me.bagDone && !draft.editing) {
        return '<h2>你的袋子</h2>' +
          bagBoard(me.bag, true) +
          '<button class="btn ghost fullbtn" id="redo">改一下</button>' +
          '<p class="privacy">翻頁之後就不能改了。</p>';
      }
      var left = S.pick - draft.bag.length;
      return '<h2>' + esc(S.shop.name) + '</h2>' +
        '<p>' + esc(S.shop.rule) + '</p>' +
        '<div class="deal">🎁 ' + esc(S.shop.deal) + '　<small>挑滿三樣，第四樣送你</small></div>' +
        '<div class="lotgrid">' + S.assets.map(function (a) {
          var on = draft.bag.indexOf(a.id) >= 0;
          var off = !on && left <= 0;
          return '<div class="lotchk' + (on ? ' on' : '') + (off ? ' off' : '') + '" data-pick="' + a.id + '">' +
            '<span class="box"></span>' +
            '<img class="chkart" src="/happiness/shared/art/asset-' + a.id + '.svg" alt="">' +
            '<span>' + esc(a.name) + '</span></div>';
        }).join('') +
          '<div class="lotchk gift' + (left <= 0 ? ' on' : '') + '" id="gifttile"><span class="box">' + esc(S.gift.mask) + '</span>' +
            '<span>' + (left <= 0 ? '這一樣是送你的' : '買三送一的那一樣') +
            '<span class="sub">' + (left <= 0 ? '最後才會知道是什麼' : '挑滿三樣就進你的袋子') + '</span></span></div>' +
        '</div>' +
        '<button class="btn primary fullbtn" id="savebag"' + (left === 0 ? '' : ' disabled') + '>' +
          (left > 0 ? '還要挑 ' + left + ' 樣' : '就這三樣') + '</button>';
    },

    shop_result: function (me) {
      return '<h2>你的袋子</h2>' + bagBoard(me.bag, true) + wait('看大螢幕');
    },

    poll: function (me) {
      if (me.poll !== null) return wait('已投票：' + S.poll.options[me.poll], '看大螢幕');
      return '<div class="claim">' + esc(S.poll.claim) + '</div>' +
        '<p style="margin-top:16px">' + esc(S.poll.ask) + '</p>' +
        '<div class="lotgrid">' + S.poll.options.map(function (o, i) {
          return '<button class="btn fullbtn" style="margin-top:0" data-p="' + i + '">' + esc(o) + '</button>';
        }).join('') + '</div>';
    },
    poll_result: function () { return wait('看大螢幕', '聽主持人分享'); },

    verse_first: function () {
      return '<div class="verse-p"><span class="ref">' + esc(S.verse.ref) + ' · 上半句</span>' +
        '<blockquote style="color:var(--vol)">「' + esc(S.verse.first) + '」</blockquote></div>' +
        wait('聽主持人說');
    },

    timemachine: function (me) {
      return '<h2>人生時光機</h2>' +
        '<div class="yr" id="yr">' + new Date().getFullYear() + '</div>' +
        '<p style="text-align:center">抓好，我們要往前三十年。</p>' +
        bagBoard(me.bag, false);
    },

    after30: function (me) {
      var waiting = S.shelf.flipped === 0;
      return '<h2>三十年後</h2>' +
        '<p>' + (waiting ? '看大螢幕。主持人會一張一張翻開。' : '你袋子裡的東西，翻到哪一張就亮哪一張。') + '</p>' +
        bagBoard(me.bag, true) +
        (me.loss > 0 ? '<div class="hit">你 −' + me.loss + ' 分</div>' : '') +
        '<p class="mono" style="text-align:center;margin-top:14px;color:var(--ink-3)">' +
          '開場 ' + me.outerStart + ' → 現在 ' + me.outer + '</p>';
    },

    verse_second: function () {
      return '<div class="verse-p"><span class="ref">' + esc(S.verse.ref) + ' · 下半句</span>' +
        '<blockquote style="color:var(--root-c)">「' + esc(S.verse.second) + '」</blockquote></div>' +
        wait('聽主持人說');
    },

    gift: function (me) {
      return '<h2>買三送一的那一樣</h2>' +
        '<div class="eternal"><div class="nm">' + esc(S.gift.name) + '</div>' +
          '<div class="rate">折舊率 0%</div></div>' +
        '<p style="text-align:center;margin-top:14px">' + esc(S.gift.line) + '</p>' +
        '<button class="btn ' + (me.opened ? 'primary' : '') + ' wantbtn" id="open">' +
          (me.opened ? '✓ 已打開' : '我 打 開 它') + '</button>' +
        '<p class="privacy">' + (me.opened
          ? '記下來了。再按一次可以收回，沒有人會問你。'
          : '不按也完全沒關係。今天沒準備好，後面還有五關。') + '</p>';
    },

    naming: function (me) {
      return '<h2>它有名字了</h2>' +
        '<div class="eternal" style="margin-top:22px"><div class="nm" style="font-size:44px">幸福根基</div>' +
          '<div class="rate">' + me.inner + '</div></div>' +
        '<p style="margin-top:20px">上一關大家都在掉分的時候，有一條線是往上的。<b>就是它。</b></p>' +
        '<p>這條線不會被任何事件扣掉。它從你來的第一天開始長。</p>';
    },

    verse: function (me) {
      return '<div class="verse-p"><span class="ref">' + esc(S.verse.ref) + '</span>' +
        '<blockquote>「' + esc(S.verse.text) + '」</blockquote></div>' +
        (me.receivedVerse
          ? '<div class="grew"><img src="/happiness/shared/art/verse.svg" alt="">' +
            '<p class="ok">已領受<br><b>幸福根基 +10</b></p></div>'
          : '<button class="btn primary fullbtn" id="verse">領受</button>');
    },

    teach: function () { return wait('聽主持人說'); },

    prayer: function (me) {
      var mine = readBurden();
      return '<h2>祝福禱告</h2>' +
        '<p>今天有哪一樣的折舊，讓你心裡動了一下？寫下來，等一下一起禱告。</p>' +
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
        act('reconnect', { value: value, visits: visits, newcomer: draft.newcomer });
      };
    });

    // 商店：挑三樣
    document.querySelectorAll('[data-pick]').forEach(function (d) {
      d.onclick = function () {
        var id = Number(d.dataset.pick);
        var i = draft.bag.indexOf(id);
        if (i >= 0) draft.bag.splice(i, 1);
        else if (draft.bag.length >= S.pick) return;   // 三樣就是三樣
        else draft.bag.push(id);
        sig = '';
        render();
      };
    });
    var sb = document.getElementById('savebag');
    if (sb) sb.onclick = function () {
      if (draft.bag.length !== S.pick) return;
      draft.editing = false;
      act('bag', { ids: draft.bag });
    };
    var redo = document.getElementById('redo');
    if (redo) redo.onclick = function () {
      // 已經送出過了，把伺服器那份拉回來當草稿，重開選單
      draft.bag = me.bagIds.slice();
      draft.editing = true;
      sig = '';
      render();
    };

    document.querySelectorAll('[data-p]').forEach(function (b) {
      b.onclick = function () { act('poll', { value: Number(b.dataset.p) }); };
    });

    var op = document.getElementById('open');
    if (op) op.onclick = function () { act('open'); };

    var v = document.getElementById('verse');
    if (v) v.onclick = function () { act('verse'); };

    var save = document.getElementById('savebd');
    if (save) save.onclick = function () {
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
          listLabel: 'MY BAG',
          bought: me.bag.map(function (it) {
            return it.name + (it.aged ? ' 剩' + it.left + '%' : '');
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

  // 人生時光機：手機上的年份跟著大螢幕一起跑
  var warpTimer = null;
  function runWarp() {
    var el = document.getElementById('yr');
    if (!el) return;
    var from = new Date().getFullYear(), to = from + YEARS, t0 = Date.now(), MS = 3200;
    clearInterval(warpTimer);
    warpTimer = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / MS);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k >= 1) clearInterval(warpTimer);
    }, 60);
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
      S.phase.id, S.shelf.flipped, S.named, S.giftOpen, S.shopOpen,
      me.outer, me.inner, me.visits, me.bagDone, me.bagIds.join(','),
      me.poll, me.opened, me.receivedVerse, me.cardDone, me.hasBurden,
      draft.newcomer, draft.editing, draft.bag.join(','),
    ].join('|');
    if (next !== sig) {
      sig = next;
      screen.innerHTML = (views[S.phase.id] || function () { return wait('看大螢幕'); })(me);
      bind(me);
      if (S.phase.id === 'timemachine') runWarp(); else clearInterval(warpTimer);
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
