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

  // 每個模組畫幾像素。跟著 --u 走，canvas 就能 1:1 顯示 ——
  // 交給 CSS 去縮放 canvas 會把模組邊緣糊掉，掃描器就讀不到了。
  function qrScale(base) {
    var u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1;
    return Math.max(3, Math.round(base * u));
  }
  function post(cmd, extra) { if (conn) conn.host(cmd, extra); }
  function joinUrl() { return location.origin + JOIN_PATH + '?room=' + ROOM; }
  function pct(r) { return '−' + Math.round(r * 100) + '%'; }

  // 側欄的兩條槽。主持人要一眼看出哪一條是什麼，所以把名字寫在旁邊 ——
  // 名字後面那個數字就不用再寫一次了。
  function gauge(label, value, pct, color, extra) {
    return '<div class="gauge">' +
        '<span>' + label + '</span>' +
        '<b style="color:' + color + '">' + value + '</b>' +
        (extra || '') +
      '</div>' +
      '<span class="bar"><i style="width:' + pct + '%;background:' + color + '"></i></span>';
  }

  // ── 側欄玩家狀態 ──────────────────────────────────────────────────────
  function renderPlayers() {
    var el = document.getElementById('plist');
    if (!S.players.length) {
      el.innerHTML = '<p class="muted" style="font-size:calc(13px * var(--u))">還沒有人進場。</p>';
      return;
    }
    el.innerHTML = S.players.map(function (p) {
      var outer = p.outer == null ? 0 : p.outer;
      var drop = (p.outer != null && p.outerStart != null) ? p.outerStart - p.outer : 0;
      var chips = [];
      if (p.newcomer) chips.push('<span class="chip">新朋友</span>');
      if (p.holdingsDone) chips.push('<span class="chip">已勾選 ' + p.owned.length + ' 樣</span>');
      if (p.owned.indexOf(10) >= 0) chips.push('<span class="chip on">標到「？」</span>');
      if (p.want) chips.push('<span class="chip want">我要</span>');
      if (p.hasBurden) chips.push('<span class="chip">已填寫</span>');
      if (p.receivedVerse) chips.push('<span class="chip on">已領受</span>');
      return '' +
        '<div class="prow">' +
          '<div class="nm">' + esc(p.name) +
            (drop > 0 ? '<span class="drop">−' + drop + '</span>' : '') +
          '</div>' +
          // 上面是幸福指數（今晚會一直往下掉），下面是幸福根基（今晚才有名字）
          gauge('幸福指數', p.outer == null ? '—' : p.outer, outer, 'var(--vol)',
            '<span class="adj">' +
              '<button data-adj="' + p.pid + '" data-d="-5">−</button>' +
              '<button data-adj="' + p.pid + '" data-d="5">＋</button>' +
            '</span>') +
          gauge(S.named ? '幸福根基' : '？？？', p.inner || 0, p.inner || 0, 'var(--root-c)') +
          (chips.length ? '<div class="meta" style="margin-top:4px;flex-wrap:wrap">' + chips.join('') + '</div>' : '') +
        '</div>';
    }).join('');

    el.querySelectorAll('[data-adj]').forEach(function (b) {
      b.onclick = function () { post('adjust', { pid: b.dataset.adj, delta: Number(b.dataset.d) }); };
    });
  }

  // ── 元件 ─────────────────────────────────────────────────────────────
  function optionBars() {
    var c = S.stats.q20Counts;
    var max = Math.max.apply(null, c.concat([1]));
    return '<div class="opts">' + S.q20.options.map(function (o, i) {
      return '<div class="opt">' +
        '<span class="lbl">' + esc(o) + '</span>' +
        '<span class="track"><i style="width:' + (c[i] / max * 100) + '%"></i></span>' +
        '<span class="n">' + c[i] + ' 人</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  // 已經開過的項目排成一列，讓全場看得到還剩幾樣
  function progressStrip() {
    var r = S.reveal;
    return '<div class="deplist">' + Array.apply(null, { length: r.total }).map(function (_, i) {
      return '<span class="' + (i <= r.idx ? 'on' : '') + '">' + (i + 1) + '</span>';
    }).join('') + '<span class="' + (S.phaseIdx >= 8 ? 'on' : '') + '">？</span></div>';
  }

  function avgLine() {
    var s = S.stats;
    if (s.outerAvg == null) return '';
    var d = (s.startAvg == null) ? null : s.outerAvg - s.startAvg;
    return '<div class="deprow" style="margin-top:calc(26px * var(--u))">' +
      '<div><span class="kicker">全場平均</span><div class="big" style="font-size:calc(64px * var(--u))">' + s.outerAvg + '</div></div>' +
      (d == null ? '' : '<div><span class="kicker">相對開場</span><div class="big" style="font-size:calc(64px * var(--u));color:var(--vol)">' + (d > 0 ? '+' : '') + d + '</div></div>') +
    '</div>';
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
        '<p class="lede">輸入卡片上的<b>幸福指數</b>，然後選這是你第幾次來。</p>' +
        '<div class="big" style="margin-top:24px">' + s.reconnected + ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + s.count + ' 已接上</span></div>' +
        (s.newcomers ? '<p class="mono" style="margin-top:10px;color:var(--root-c)">其中 ' + s.newcomers + ' 位第一次來或忘記帶卡片</p>' : '') +
        '<div class="note">第一次來、忘記帶卡片、上次沒來——手機上有一個按鈕，按現在的感覺填就好。<b>兩種都算數。</b></div>';
    },

    holdings: function () {
      var s = S.stats;
      return '<h2>你手上有什麼</h2>' +
        '<p class="lede">勾選你標到的東西，再把沒花掉的點數拉出來。</p>' +
        '<div class="big" style="margin-top:24px">' + s.holdingsDone + ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + s.count + ' 已填</span></div>' +
        '<div class="note">第一次來的人不用有上一次——直接按你的直覺，把 100 點分配掉。</div>';
    },

    q20: function () {
      return '<h2>' + esc(S.q20.question) + '</h2>' +
        '<p class="lede">四個選項，憑直覺。沒有正確答案。</p>' +
        '<div class="big" style="margin-top:24px">' + S.stats.answeredQ20 + ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + S.stats.count + ' 已作答</span></div>';
    },

    q20_result: function () {
      return '<h2>全場是這樣想的</h2>' +
        optionBars();
    },

    ff_intro: function () {
      return '<h2>時間快轉三十年</h2>' +
        '<p class="lede">你們花光籌碼買下的東西，今天要驗貨。一項一項來。</p>' +
        progressStrip();
    },

    depreciate: function () {
      var r = S.reveal;
      if (r.idx < 0) {
        return '<h2>三十年後</h2>' +
          '<p class="lede">按底下的「揭曉下一項」開始。</p>' + progressStrip();
      }
      var it = r.item;
      return '<div class="depidx">' + (r.idx + 1) + ' / ' + r.total + '</div>' +
        '<div class="depname">' + esc(it.name) + '</div>' +
        '<div class="deprow">' +
          '<div class="deprate">' + pct(it.rate) + '</div>' +
          '<div class="depwhy">' + esc(it.why) + '</div>' +
        '</div>' +
        avgLine() +
        progressStrip();
    },

    verse_half: function () {
      return '<div class="verse half"><span class="ref">' + esc(S.verse.ref) + '</span>' +
        '<blockquote>「' + esc(S.verse.first) + '」</blockquote></div>';
    },

    mystery: function () {
      return '' +
        '<div class="qmark">？</div>' +
        '<div class="eternal"><div class="nm">' + esc(S.mystery.name) + '</div>' +
          '<div class="rate">折舊率 0%</div>' +
          '<p class="lede" style="margin:14px auto 0;text-align:center">' + esc(S.mystery.why) + '</p></div>' +
        '<p class="lede" style="text-align:center;margin:22px auto 0">上一關的拍賣清單上，沒有這一樣。<br>' +
        '你想買也買不到 —— 而三十年後，它是唯一還在的。</p>';
    },

    free: function () {
      var w = S.stats.wants;
      return '' +
        '<div class="freeline">這一樣，你出多少錢都買不到。<br><span style="color:var(--root-c)">今天，它不用錢。誰要都可以拿。</span></div>' +
        '<div class="verse half second" style="margin-top:calc(26px * var(--u))"><span class="ref">' + esc(S.verse.ref) + ' · 下半句</span>' +
          '<blockquote>「' + esc(S.verse.second) + '」</blockquote></div>' +
        '<div class="wantlist">' + (w.length
          ? w.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('')
          : '<span class="muted" style="background:none;border-color:var(--edge-soft);color:var(--ink-3);box-shadow:none">還沒有人按</span>') + '</div>' +
        '<p class="mono muted" style="margin-top:12px">' + w.length + ' / ' + S.stats.count + ' 按了「我要」</p>' +
        '<div class="note">不按也完全沒關係。不扣分、不點名、不追問。</div>';
    },

    naming: function () {
      return '<h2>那條線有了名字</h2>' +
        '<div class="eternal" style="text-align:left"><div class="nm" style="font-size:calc(72px * var(--u))">幸福根基</div></div>' +
        '<p class="lede" style="font-size:calc(22px * var(--u))">上一次大家都在掉分的時候，有一條線是往上的。<b>就是它。</b></p>' +
        '<div class="note"><b>這條線不會被任何事件扣掉。</b>　而且它不是比賽——它從你來的第一天開始長。</div>';
    },

    message: function () {
      return '<h2>我也買錯過</h2>';
    },

    verse: function () {
      return '<div class="verse"><span class="ref">' + esc(S.verse.ref) + '</span>' +
        '<blockquote>「' + esc(S.verse.text) + '」</blockquote></div>' +
        '<p class="mono muted" style="margin-top:20px">已領受 ' + S.stats.versesReceived + ' / ' + S.stats.count + '</p>' +
        '<div style="margin-top:calc(26px * var(--u))"><span class="kicker">十五分鐘前，你們是這樣想的</span>' + optionBars() + '</div>';
    },

    burden: function () {
      var shared = S.stats.sharedBurdens;
      return '<h2>今天有哪一項的折舊，<br>讓你心裡動了一下？</h2>' +
        '<p class="lede">一句話就好，可以略過。</p>' +
        '<div class="big" style="margin-top:20px">' + S.stats.burdens + ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + S.stats.count + ' 已填寫</span></div>' +
        '<div class="note"><b>這句話只存在你自己的手機裡</b>　這個畫面只看得到「已填寫」，看不到內容。除非你自己按下「我願意分享」。</div>' +
        (shared.length
          ? '<div class="hitcards">' + shared.map(function (b) {
              return '<div class="hitcard" style="border-left-color:var(--root-c)">' +
                '<p style="font-size:calc(19px * var(--u));font-weight:700">「' + esc(b.text) + '」</p>' +
                '<div class="nm">' + esc(b.name) + ' · 願意分享</div></div>';
            }).join('') + '</div>'
          : '');
    },

    card: function () {
      return '<h2>把卡片存進相簿</h2>' +
        '<p class="lede">長按圖片存進相簿。這是你的第二張卡。</p>' +
        '<div class="big" style="margin-top:20px">' + S.stats.cardsDone + ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + S.stats.count + ' 已生成</span></div>';
    },

    end: function () {
      var s = S.stats;
      return '<h2>第二關結束</h2>' +
        '<div class="cols3">' +
          '<div class="col3"><h3>全場平均</h3><div class="who">' + (s.outerAvg == null ? '—' : s.outerAvg) + '</div>' +
            '<p class="mono" style="margin:8px 0 0;color:var(--vol)">' + (s.startAvg == null ? '' : '開場是 ' + s.startAvg) + '</p></div>' +
          '<div class="col3"><h3>幸福根基</h3><div class="who" style="color:var(--root-c)">' + s.innerAvg + '</div>' +
            '<p class="muted" style="margin:8px 0 0;font-size:calc(14px * var(--u))">兩條線第一次往反方向走。</p></div>' +
          '<div class="col3"><h3>按了「我要」</h3><div class="who" style="font-size:calc(20px * var(--u))">' +
            (s.wants.length ? esc(s.wants.join('、')) : '（今天沒有人，這完全沒關係）') +
            '</div></div>' +
        '</div>' +
        '<div class="note">經文說「我來了」。<b>那個「我」是誰——下一關。</b></div>';
    },
  };

  // ── 主渲染 ───────────────────────────────────────────────────────────
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

    // 折舊控制列只在那一頁出現
    var dep = S.phase.id === 'depreciate';
    document.getElementById('depctl').style.display = dep ? 'inline-flex' : 'none';
    // 頁名在翻頁選單上就有了，右邊不用再寫一次
    document.getElementById('hint').textContent =
      S.phase.id === 'lobby' ? '玩家掃碼進場後按「下一頁」開始' : '';

    renderPlayers();
    stage.innerHTML = (views[S.phase.id] || function () { return ''; })();

    // 每次回到入場頁都要重畫：stage.innerHTML 一被改寫，canvas 就是全新的空白元素
    var qr = document.getElementById('qr');
    if (qr && ROOM) {
      try { QR.render(qr, joinUrl(), qrScale(7), '#161A18', '#ffffff'); } catch (err) {}
    }

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
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); toggleNotes(); return; }
    if (e.key === 'Escape') { toggleNotes(false); return; }
    // 折舊那一頁，空白鍵是「揭曉下一項」——一手就能控整場
    if (S && S.phase.id === 'depreciate' && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault(); post('nextItem'); return;
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
