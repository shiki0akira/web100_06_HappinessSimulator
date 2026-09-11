// 玩家手機 · 第二關「真相大白」
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
  var draft = { bag: [], editing: false, byVisits: false };

  // ── 畫面 ─────────────────────────────────────────────────────────────
  var wait = function (msg, sub) {
    return '<div class="wait"><div class="dot">. . .</div><p style="font-size:21px;color:var(--ink-2)">' +
      esc(msg) + '</p>' + (sub ? '<p style="font-size:17px">' + esc(sub) + '</p>' : '') + '</div>';
  };

  // 他的袋子。三十年還沒過就不給數字 —— 手機上先看到答案就沒戲了。
  function bagBoard(items, big) {
    if (!items.length) return '';
    return '<div class="mine' + (big ? ' big' : '') + '">' + items.map(function (it) {
      var art = '<img src="/happiness/shared/art/asset-' +
        (it.gift ? (S.giftOpen ? 'gift-open' : 'gift') : it.id) + '.svg" alt="">';
      // 還沒拆的那一份不寫名字，也不寫數字 —— 它就是今晚的伏筆
      var name = (it.gift && !S.giftOpen) ? '買三送一的那一樣' : it.name;
      var val = it.aged ? '折舊 ' + it.down + '%' : (it.gift ? '尚未拆封' : '');
      return '<div class="mrow' + (it.aged ? ' open' : '') + (it.gift ? ' gift' : '') + '">' +
        art +
        '<span class="nm">' + esc(name) + '</span>' +
        '<span class="v">' + esc(val) + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  // 兩頁經文都印整節，只有要念的那一半有顏色。
  function verseHalf(i) {
    var h = S.verse.halves;
    return '<div class="verse-p half' + (i ? ' second' : '') + '">' +
      '<span class="ref">' + esc(S.verse.ref) + (i ? ' · 下半句' : ' · 上半句') + '</span>' +
      '<blockquote>「' +
        '<span class="' + (i === 0 ? 'on' : 'off') + '">' + esc(h[0]) + '</span>' +
        '<span class="' + (i === 1 ? 'on' : 'off') + '">' + esc(h[1]) + '</span>' +
      '」</blockquote></div>';
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
        '<p><span class="sub">第一次來的話自由填 —— 按你現在的感覺給自己一個分數就好。</span></p>' +
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
          '<div class="lotchk gift' + (left <= 0 ? ' on' : '') + '" id="gifttile">' +
            '<img class="chkart" src="/happiness/shared/art/asset-gift.svg" alt="">' +
            '<span>' + (left <= 0 ? '這一樣是送你的' : '買三送一的那一樣') +
            '<span class="sub">' + (left <= 0 ? '最後才會知道是什麼' : '挑滿三樣就進你的袋子') + '</span></span></div>' +
        '</div>' +
        '<button class="btn primary fullbtn" id="savebag"' + (left === 0 ? '' : ' disabled') + '>' +
          (left > 0 ? '還要挑 ' + left + ' 樣' : '選好了') + '</button>';
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

    after30_sum: function (me) {
      return '<h2>三十年後，你手上剩下</h2>' +
        bagBoard(me.bag, true) +
        (me.loss > 0 ? '<div class="hit">你 −' + me.loss + ' 分</div>' : '') +
        '<p class="mono" style="text-align:center;margin-top:14px;color:var(--ink-3)">' +
          '開場 ' + me.outerStart + ' → 現在 ' + me.outer + '</p>' +
        wait('看大螢幕');
    },

    verse_first: function () { return verseHalf(0) + wait('聽主持人說'); },

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

    verse_second: function () { return verseHalf(1) + wait('聽主持人說'); },

    gift: function (me) {
      if (!S.giftOpen) {
        return '<h2>' + esc(S.gift.title) + '</h2>' +
          '<div class="eternal"><img class="chest" src="/happiness/shared/art/asset-gift.svg" alt=""></div>' +
          wait('看大螢幕', '主持人要打開它了');
      }
      return '<h2>' + esc(S.gift.title) + '</h2>' +
        '<div class="eternal"><img class="chest" src="/happiness/shared/art/asset-gift-open.svg" alt="">' +
          '<div class="nm">' + esc(S.gift.name) + '</div>' +
          '<div class="rate">折舊率 0%</div></div>' +
        '<p style="text-align:center;margin-top:14px">' + esc(S.gift.bless) + '</p>' +
        (me.gift ? '<div class="hit up">幸福指數 +' + me.gift + '　幸福根基 +' + S.giftInner + '</div>' : '');
    },

    // 手機上不放字 —— 那三句話是主持人講的
    naming: function (me) {
      return '<h2>它有名字了</h2>' +
        '<div class="eternal" style="margin-top:22px"><div class="nm" style="font-size:44px">幸福根基</div>' +
          '<div class="rate">' + (me.inner ? me.inner : '—') + '</div></div>';
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
        '<button class="btn primary fullbtn" id="savebd">' + (me.prayed ? '更新' : '寫好了') + '</button>' +
        (me.prayed
          ? '<div class="grew"><img src="/happiness/shared/art/prayer.svg" alt="">' +
            '<p class="ok">已存下<br><b>幸福根基 +5</b></p></div>'
          : '') +
        '<p class="privacy">🔒 這句話只存在你這支手機裡，主持人的畫面只看得到「已填寫」。它會印在你今天的卡片上。</p>';
    },

    card: function (me) {
      // 等 +5 記上去了再畫 —— 卡片上要印的是禱告之後的數字，不是之前的
      if (!me.cardDone) return '<h2>儲存模擬回憶</h2>' + wait('生成中');
      return '<h2>儲存模擬回憶</h2>' +
        '<p>這張卡是下一關的入場券。</p>' +
        '<img class="weekcard" id="cardimg" alt="第二關週卡">' +
        '<a class="btn primary fullbtn" id="zoom" target="_blank" rel="noopener" style="display:block;text-align:center;text-decoration:none">放大這張卡</a>';
    },

    end: function (me) {
      return '<h2>下週見</h2>' +
        '<p>下次見。記得帶著你的卡片——開場會請你輸入上面的幸福指數。</p>' +
        (cardURL ? '<img class="weekcard" src="' + cardURL + '" alt="第二關週卡">' : '') +
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
    // 接關：兩格都填完才送得出去
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

    var zm = document.getElementById('zoom');
    if (zm && cardBlob) zm.href = cardBlob;

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
            return it.name + (it.aged ? ' 折舊' + it.down + '%' : '');
          }),
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
    document.getElementById('innerv').textContent = me.inner ? me.inner : '—';
    document.getElementById('innerbar').style.width = me.inner + '%';

    var next = [
      S.phase.id, S.shelf.flipped, S.named, S.giftOpen, S.shopOpen,
      me.outer, me.inner, me.visits, me.bagDone, me.bagIds.join(','),
      me.poll, me.receivedVerse, me.cardDone, me.hasBurden, me.prayed,
      draft.editing, draft.byVisits, draft.bag.join(','),
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
