// 主持人大螢幕 · 第二關「真相大白」
(function () {
  'use strict';
  var WEEK = 2;
  // 大螢幕上印給人手動打字的網址。越短越好打 —— 手機鍵盤打 ? 和 = 很痛苦。
  var JOIN_PATH = '/2';
  var NOTES_PATH = '/h2';   // 主持人備忘錄，掃不到的時候也打得出來
  var S = null;
  var stage = document.getElementById('stage');

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var conn = null;
  var ROOM = '';
  var YEARS = 30;

  // 每個模組畫幾像素。跟著 --u 走，canvas 就能 1:1 顯示 ——
  // 交給 CSS 去縮放 canvas 會把模組邊緣糊掉，掃描器就讀不到了。
  // 視窗矮的時候 QR 也要跟著小一號，不然入場頁會擠出捲軸
  function qrScale(base) {
    var u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1;
    var h = Math.min(1, (window.innerHeight || 720) / 700);
    return Math.max(3, Math.round(base * u * h));
  }
  function post(cmd, extra) { if (conn) conn.host(cmd, extra); }
  function joinUrl() { return location.origin + JOIN_PATH + '?room=' + ROOM; }

  // 側欄的兩條槽。名稱、槽、數字擠在同一行 —— 八個人以上也要能不捲動就看完，
  // 每個人多一行就是少一個人。
  function gauge(label, value, pct, color) {
    return '<div class="g">' +
        '<span class="lbl">' + label + '</span>' +
        '<span class="bar"><i style="width:' + Math.min(pct, 100) + '%;background:' + color + '"></i></span>' +
        '<b style="color:' + color + '">' + value + '</b>' +
      '</div>';
  }

  // ── 側欄玩家狀態 ──────────────────────────────────────────────────────
  function renderPlayers() {
    var el = document.getElementById('plist');
    if (!S.players.length) {
      el.innerHTML = '<p class="muted" style="font-size:calc(13px * var(--u))">還沒有人進場。</p>';
      return;
    }
    // 挑東西的時候側欄只顯示「挑好了沒」，不顯示他挑了什麼 ——
    // 全場都看得到別人挑哪些，就會有人改成跟別人一樣。翻到結算頁才攤開。
    var choosing = S.phase.id === 'shop';
    var showBag = !choosing && S.phaseIdx >= 3;
    el.innerHTML = S.players.map(function (p) {
      var outer = p.outer == null ? 0 : p.outer;
      var chips = [];
      if (p.newcomer) chips.push('<span class="chip">新朋友</span>');
      if (choosing) chips.push('<span class="chip' + (p.bagDone ? ' on' : '') + '">' + (p.bagDone ? '挑好了' : '還沒挑') + '</span>');
      if (p.opened) chips.push('<span class="chip want">已打開</span>');
      if (p.hasBurden) chips.push('<span class="chip">已填寫</span>');
      if (p.receivedVerse) chips.push('<span class="chip on">已領受</span>');
      // 第三行：他挑的那三樣。主持人接話全靠這一行 ——「你挑了工作」。
      // 買三送一的那一格不列 —— 每個人都有，寫出來只是佔位子。
      var picked = p.bag.filter(function (it) { return !it.gift; });
      var meta = (showBag && picked.length)
        ? '<div class="meta keep">' + picked.map(function (it) { return esc(it.name); }).join('・') + '</div>'
        : '';
      return '' +
        '<div class="prow">' +
          '<div class="nm">' + esc(p.name) +
            (p.loss > 0 ? '<span class="drop">−' + p.loss + '</span>' : '') +
            chips.join('') +
          '</div>' +
          // 上面是幸福指數（三十年後會掉），下面是幸福根基（今晚才有名字）
          gauge('幸福指數', p.outer == null ? '—' : p.outer, outer, 'var(--vol)') +
          gauge(S.named ? '幸福根基' : '？？？', p.inner ? p.inner : '—', p.inner || 0, 'var(--root-c)') +
          meta +
        '</div>';
    }).join('');
  }

  // ── 元件 ─────────────────────────────────────────────────────────────
  // 作答中的計數。分布不在這裡長 —— 先看到別人的答案會互相定錨，
  // 而且主持人少了「翻頁」這個把注意力收回來的動作。
  function answering(n, unit) {
    var all = S.stats.count > 0 && n >= S.stats.count;
    return '<div class="big" style="margin-top:16px">' + n +
        ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + S.stats.count + ' ' + (unit || '人已作答') + '</span></div>' +
      (all ? '<div class="note" style="border-left-color:var(--root-c);color:var(--ink)">' +
        '<b>大家都好了</b>　按「下一頁」。</div>' : '');
  }

  function assetArt(id) {
    return '<img class="tileart" src="/happiness/shared/art/asset-' + id + '.svg" alt="">';
  }
  // 買三送一那一格的寶箱。蓋著的時候關著，拆開之後打開。
  function chestArt(open) {
    return assetArt(open ? 'gift-open' : 'gift');
  }

  // 幸福人生商店的貨架。十一樣 ＋ 買三送一的那一格 = 十二格，四欄三列。
  function shopBoard() {
    return '<div class="board">' + S.assets.map(function (a) {
      return '<div class="tile">' + assetArt(a.id) +
        '<span class="txt"><span class="nm">' + esc(a.name) + '</span></span>' +
      '</div>';
    }).join('') + giftTile(false) + '</div>';
  }

  // 三十年後的同一家店：十二張牌攤在同一頁，主持人一張一張翻。
  // **正面是剛剛誰挑了它，翻過去才是折舊率和為什麼。** 點卡片就翻。
  function flipBoard() {
    return '<div class="board flip">' + S.shelf.rows.map(function (r) {
      if (!r.open) {
        return '<div class="tile face" data-flip="' + r.id + '">' +
          assetArt(r.id) +
          '<span class="txt"><span class="nm">' + esc(r.name) + '</span>' +
            (r.pickedBy.length
              ? '<span class="by">' + r.pickedBy.map(esc).join('・') + '</span>'
              : '<span class="by none">沒有人挑</span>') +
          '</span>' +
        '</div>';
      }
      return '<div class="tile aged">' +
        assetArt(r.id) +
        '<span class="txt"><span class="nm">' + esc(r.name) +
          '<b class="left">−' + r.down + '%</b></span>' +
          '<span class="why">' + esc(r.why) + '</span>' +
        '</span>' +
      '</div>';
    }).join('') + giftTile(true) + '</div>';
  }

  // 買三送一的那一格。挑滿三樣它就是你的了 —— 但要到最後才知道是什麼。
  // 這一格不在三十年後那一頁翻，它留到下下一頁才拆。
  function giftTile(aged) {
    if (S.giftOpen) {
      return '<div class="tile gift open">' +
        chestArt(true) +
        '<span class="txt"><span class="nm">' + esc(S.gift.name) +
          '<b class="left">−0%</b></span></span>' +
      '</div>';
    }
    return '<div class="tile gift">' +
      chestArt(false) +
      '<span class="txt"><span class="nm">' + esc(S.shop.deal) + '</span>' +
        '<span class="sub">' + (aged ? '還沒拆' : '挑滿三樣就送你') + '</span></span>' +
    '</div>';
  }

  // 全場最多人挑的。長條由多到少，前三名有名次牌。
  function rankBars() {
    var rows = S.stats.counts.filter(function (x) { return x.n > 0; }).slice(0, 3);
    if (!rows.length) return '<p class="lede">還沒有人挑。</p>';
    var max = rows[0].n;
    return '<div class="opts">' + rows.map(function (x, i) {
      return '<div class="opt">' +
        '<span class="rank' + (i < 3 ? ' top' : '') + '">' + (i + 1) + '</span>' +
        '<span class="lbl">' + esc(x.name) + '</span>' +
        '<span class="track"><i style="width:' + (x.n / max * 100) + '%"></i></span>' +
        '<span class="n">' + x.n + ' 人</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function pollBars() {
    var c = S.stats.pollCounts;
    var max = Math.max.apply(null, c.concat([1]));
    return '<div class="opts">' + S.poll.options.map(function (o, i) {
      return '<div class="opt">' +
        '<span class="lbl">' + esc(o) + '</span>' +
        '<span class="track"><i style="width:' + (c[i] / max * 100) + '%"></i></span>' +
        '<span class="n">' + c[i] + ' 人</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  // 每個人的袋子。結算頁只有名字，三十年後那一頁多印各剩幾成。
  function bagList(aged) {
    if (!S.players.length) return '';
    return '<span class="kicker" style="margin-top:18px">' + (aged ? '三十年後，每個人的袋子' : '每個人挑了什麼') + '</span>' +
      '<div class="keeplist' + (S.players.length > 7 ? ' dense' : '') + '">' + S.players.map(function (p) {
        return '<div class="keeprow">' +
          '<span class="nm">' + esc(p.name) + '</span>' +
          '<span class="got">' + (p.bag.length
            ? p.bag.map(function (it) {
                return '<span class="lot' + (it.gift ? ' gift' : '') + '">' + esc(it.name) +
                  (aged && it.aged ? ' <b>−' + it.down + '%</b>' : '') + '</span>';
              }).join('')
            : '<span class="none">還沒挑</span>') + '</span>' +
          (aged && p.loss > 0 ? '<span class="drop">−' + p.loss + '</span>' : '') +
        '</div>';
      }).join('') + '</div>';
  }

  // 兩頁經文都印整節，只有要念的那一半有顏色，另一半淡下去。
  function verseHalf(i) {
    var h = S.verse.halves;
    return '<div class="verse half' + (i ? ' second' : '') + '">' +
      '<span class="ref">' + esc(S.verse.ref) + (i ? ' · 下半句' : ' · 上半句') + '</span>' +
      '<blockquote>「' +
        '<span class="' + (i === 0 ? 'on' : 'off') + '">' + esc(h[0]) + '</span>' +
        '<span class="' + (i === 1 ? 'on' : 'off') + '">' + esc(h[1]) + '</span>' +
      '」</blockquote></div>';
  }

  function avgLine() {
    var s = S.stats;
    if (s.outerAvg == null) return '';
    var d = (s.startAvg == null) ? null : s.outerAvg - s.startAvg;
    return '<span class="stat"><span>全場平均</span>' + s.outerAvg + '</span>' +
      (d == null ? '' : '<span class="stat drop"><span>相對開場</span>' + (d > 0 ? '+' : '') + d + '</span>');
  }

  // ── 各階段畫面 ────────────────────────────────────────────────────────
  var views = {
    lobby: function () {
      return '<h2>掃碼進場</h2>' +
        '<div class="qrbox">' +
          '<canvas id="qr"></canvas>' +
          '<div>' +
          '<p class="muted mono" style="font-size:calc(13px * var(--u));margin:0">房號</p>' +
          '<div class="roomcode">' + esc(ROOM || '····') + '</div>' +
          '<p class="muted" style="margin:14px 0 6px">掃碼，或到這個網址輸入房號：</p>' +
          '<div class="url">' + esc(location.host + JOIN_PATH) + '</div></div>' +
        '</div>' +
        '<div class="names">' + (S.players.length
          ? S.players.map(function (p) { return '<span>' + esc(p.name) + '</span>'; }).join('')
          : '<span class="muted">等人進來…</span>') + '</div>';
    },

    reconnect: function () {
      var s = S.stats;
      return '<h2>打開上一次的卡片</h2>' +
        '<p class="lede">輸入卡片上的<b>幸福指數</b>，然後填這是你第幾次來。</p>' +
        answering(s.reconnected, '已接上') +
        (s.newcomers ? '<p class="mono" style="margin-top:8px;color:var(--root-c)">其中 ' + s.newcomers + ' 位第一次來或忘記帶卡片</p>' : '') +
        '<div class="note"><b>第一次來的人，幸福指數自由填。</b>　忘記帶卡片、上次沒來也一樣 —— 按你現在的感覺給自己一個分數就好，次數填 1。</div>';
    },

    shop: function () {
      return '<h2>' + esc(S.shop.name) + '</h2>' +
        '<p class="lede">' + esc(S.shop.rule) + '　<b style="color:var(--gold)">' + esc(S.shop.deal) + '</b></p>' +
        answering(S.stats.bagsDone, '人挑好了') +
        shopBoard();
    },

    shop_result: function () {
      return '<h2>全場最多人挑的</h2>' +
        '<p class="lede" style="color:var(--root-c);font-weight:700">你為什麼挑這三樣？</p>' +
        rankBars() +
        bagList(false);
    },

    poll: function () {
      return '<div class="claim">' + esc(S.poll.claim) + '</div>' +
        '<p class="lede" style="font-size:calc(24px * var(--u));margin-top:16px">' + esc(S.poll.ask) + '</p>' +
        answering(S.stats.answeredPoll, '人已投票');
    },

    poll_result: function () {
      return '<div class="claim small">' + esc(S.poll.claim) + '</div>' +
        pollBars();
    },

    verse_first: function () {
      return verseHalf(0);
    },

    timemachine: function () {
      return '<div class="warp">' +
        '<div class="rails"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
        '<div class="yr" id="yr">' + new Date().getFullYear() + '</div>' +
        '<div class="warplbl">人生時光機</div>' +
      '</div>';
    },

    after30: function () {
      return '<div class="afterhd"><h2>三十年後的' + esc(S.shop.name) + '</h2>' + avgLine() +
          '<span class="flipcount">' + S.shelf.flipped + ' / ' + S.shelf.total + ' 已翻開</span></div>' +
        flipBoard();
    },

    after30_sum: function () {
      return '<div class="afterhd"><h2>三十年後，你掉了多少</h2>' + avgLine() + '</div>' +
        bagList(true);
    },

    verse_second: function () {
      return verseHalf(1);
    },

    gift: function () {
      // 先只有一個蓋著的寶箱。主持人點它（或按空白鍵）才打開。
      if (!S.giftOpen) {
        return '<h2 class="giftitle">' + esc(S.gift.title) + '</h2>' +
          '<div class="chestbox"><img class="chest shut" id="chest" src="/happiness/shared/art/asset-gift.svg" alt=""></div>';
      }
      var w = S.stats.opened;
      return '<div class="giftline">' + esc(S.gift.line) + '</div>' +
        '<div class="eternal"><img class="chest" src="/happiness/shared/art/asset-gift-open.svg" alt="">' +
          '<div class="nm">' + esc(S.gift.name) + '</div>' +
          '<div class="rate">折舊率 0%</div></div>' +
        '<p class="bless">' + esc(S.gift.bless) + '</p>' +
        '<div class="wantlist">' + (w.length
          ? w.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('')
          : '<span class="muted" style="background:none;border-color:var(--edge-soft);color:var(--ink-3);box-shadow:none">還沒有人打開</span>') + '</div>';
    },

    naming: function () {
      return '<h2>那條線有了名字</h2>' +
        '<div class="eternal" style="text-align:left;margin:calc(14px * var(--u)) 0"><div class="nm" style="font-size:min(calc(72px * var(--u)),9vh)">幸福根基</div></div>' +
        '<p class="lede" style="font-size:calc(22px * var(--u))">上一次大家都在掉分的時候，有一條線是往上的。<b>就是它。</b></p>' +
        '<div class="note"><b>這條線不會被任何事件扣掉。</b>　而且它不是比賽——它從你來的第一天開始長。</div>';
    },

    // 七關共用的那幾頁，內容在 shared/stage-parts.js
    verse: function () {
      return StageParts.verse({
        ref: S.verse.ref, text: S.verse.text,
        done: S.stats.versesReceived, total: S.stats.count,
      });
    },

    teach: function () {
      var col = function (cls, o) {
        return '<div class="col3 ' + cls + '"><h3>' + esc(o.name) + '</h3>' +
          o.lines.map(function (l) {
            return '<p style="margin:10px 0 0;font-size:calc(18px * var(--u));line-height:1.8;color:var(--ink-2)">' + esc(l) + '</p>';
          }).join('') + '</div>';
      };
      return '<h2>' + esc(S.teach.title) + '</h2>' +
        '<div class="cols3" style="grid-template-columns:1fr 1fr">' +
          col('thief', S.teach.thief) + col('jesus', S.teach.jesus) +
        '</div>';
    },

    prayer: function () {
      return StageParts.prayer({
        lede: '今天有哪一樣的折舊，讓你心裡動了一下？寫下來。只有你自己看得到。',
        done: S.stats.burdens, total: S.stats.count,
      });
    },

    card: function () {
      return StageParts.keepsake({
        done: S.stats.cardsDone, total: S.stats.count,
        extra: '你今晚挑的三樣',
      });
    },

    end: function () {
      return StageParts.nextWeek({
        avg: S.stats.outerAvg,
        week: '萬世巨星',
        lines: [
          '經文說「我來了」。那個「我」是誰——下一關。',
          '卡片留著，下次開場請你輸入上面的幸福指數。',
        ],
      });
    },
  };

  // ── 人生時光機的年份 ──────────────────────────────────────────────────
  // 從今年跑到三十年後，跑完停住。翻走再回來會重跑一次。
  var warpTimer = null;
  function runWarp() {
    var el = document.getElementById('yr');
    if (!el) return;
    var from = new Date().getFullYear();
    var to = from + YEARS;
    var t0 = Date.now(), MS = 3200;
    clearInterval(warpTimer);
    warpTimer = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / MS);
      // 先快後慢，最後一年停得住
      var e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e);
      if (k >= 1) clearInterval(warpTimer);
    }, 60);
  }

  // ── 主渲染 ───────────────────────────────────────────────────────────
  var lastPhase = '';
  function render() {
    if (!S) return;
    document.getElementById('ptag').textContent = S.phase.tag;
    document.getElementById('pcount').textContent = S.stats.count + ' 人在場';

    var jump = document.getElementById('jump');
    if (jump.options.length !== S.phases.length) {
      jump.innerHTML = S.phases.map(function (p, i) {
        return '<option value="' + i + '">' + (i + 1) + '. ' + p.title + '</option>';
      }).join('');
      jump.onchange = function () { post('goto', { idx: Number(jump.value) }); };
    }
    jump.value = String(S.phaseIdx);

    document.getElementById('hint').textContent =
      S.phase.id === 'lobby' ? '玩家掃碼進場後按「下一頁」開始' : '';

    renderPlayers();
    stage.className = 'stage phase-' + S.phase.id;
    stage.innerHTML = (views[S.phase.id] || function () { return ''; })();

    stage.querySelectorAll('[data-flip]').forEach(function (t) {
      t.onclick = function () { post('flip', { id: Number(t.dataset.flip) }); };
    });
    var chest = document.getElementById('chest');
    if (chest) chest.onclick = function () { post('openGift'); };

    // 每次回到入場頁都要重畫：stage.innerHTML 一被改寫，canvas 就是全新的空白元素
    var qr = document.getElementById('qr');
    if (qr && ROOM) {
      try { QR.render(qr, joinUrl(), qrScale(7), '#161A18', '#ffffff'); } catch (err) {}
    }

    // 進到時光機那一頁才跑年份，其他頁把它關掉
    if (S.phase.id === 'timemachine') {
      if (lastPhase !== 'timemachine') runWarp();
      else { var y = document.getElementById('yr'); if (y) y.textContent = new Date().getFullYear() + YEARS; }
    } else {
      clearInterval(warpTimer);
    }
    lastPhase = S.phase.id;
  }

  // ── 啟動 ─────────────────────────────────────────────────────────────
  // 回系列頁。現場有人在的時候先問一句 —— 從系列頁按「開場」會拿到新房號，
  // 誤點一下全場就掉了。準備階段沒人在，不會擋路。
  var home = document.getElementById('home');
  if (home) home.onclick = function (e) {
    if (S && S.stats.count > 0 &&
        !confirm('現在有 ' + S.stats.count + ' 個人在這個房間裡。\n\n離開這一頁沒關係，房號在網址上，用瀏覽器「上一頁」就回得來。\n但如果從系列頁重新按「開場」，會開到一個新房號，這些人就掉了。\n\n還是要離開嗎？')) {
      e.preventDefault();
    }
  };

  document.querySelectorAll('[data-cmd]').forEach(function (b) {
    b.onclick = function () {
      var cmd = b.dataset.cmd;
      if (cmd === 'reset' && !confirm('把這個房間整個重置？所有人的分數和接關資料都會清掉。')) return;
      post(cmd);
    };
  });

  // 主持人備忘錄的 QR：按 N 叫出來，主持人用自己的手機掃。
  // 平常收著 —— 這個網址能翻頁，不要一直掛在牆上讓全場看到。
  function toggleNotes(show) {
    var box = document.getElementById('notesqr');
    var on = show == null ? !box.classList.contains('on') : show;
    box.classList.toggle('on', on);
    if (!on || !ROOM) return;
    var short = NOTES_PATH + '?room=' + ROOM;
    document.getElementById('notesurl').textContent = location.host + short;
    try { QR.render(document.getElementById('notesqrc'), location.origin + short, qrScale(6), '#161A18', '#ffffff'); }
    catch (err) {}
  }
  document.getElementById('notesqr').onclick = function () { toggleNotes(false); };
  document.getElementById('notesbtn').onclick = function () { toggleNotes(true); };

  document.addEventListener('keydown', function (e) {
    if (e.repeat) return;   // 按住不放不要一次跳好幾頁
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); toggleNotes(); return; }
    if (e.key === 'Escape') { toggleNotes(false); return; }
    // 三十年後那一頁，空白鍵是「翻下一張」—— 翻完再用右方向鍵翻頁
    if (S && S.phase.id === 'after30' && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      if (S.shelf.flipped < S.shelf.total) { post('flipNext'); return; }
    }
    // 寶箱那一頁，空白鍵是「打開它」
    if (S && S.phase.id === 'gift' && !S.giftOpen && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault(); post('openGift'); return;
    }
    if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); post('next'); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); post('prev'); }
  });

  function start(code, fresh) {
    ROOM = code;
    conn = Room.connect({
      role: 'host', week: WEEK, room: code, fresh: fresh,
      onState: function (d) { S = d; render(); },
    });
  }

  var existing = Room.readCode();
  if (existing) {
    start(existing, false);
  } else {
    // 房號放在網址上，主持人重整頁面不會換房
    fetch('/api/new-room').then(function (r) { return r.json(); }).then(function (d) {
      var u = new URL(location.href);
      u.searchParams.set('room', d.room);
      location.replace(u.toString());
    }).catch(function () {
      document.getElementById('stage').innerHTML =
        '<h2>拿不到房號</h2><p class="lede">重新整理看看，或檢查網路。</p>';
    });
  }
})();
