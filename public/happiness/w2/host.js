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
  function assetName(id) {
    for (var i = 0; i < S.assets.length; i++) if (S.assets[i].id === id) return S.assets[i].name;
    return '';
  }

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
    // 選三樣的時候側欄只顯示「選好了沒」，不顯示他選了什麼 ——
    // 全場都看得到誰押哪裡，就會有人改跟別人一樣。開始揭曉之後才攤開。
    var choosing = S.phase.id === 'keep_intro' || S.phase.id === 'keep';
    var showKeep = !choosing && S.phaseIdx >= 4;
    el.innerHTML = S.players.map(function (p) {
      var outer = p.outer == null ? 0 : p.outer;
      var drop = (p.outer != null && p.outerStart != null) ? p.outerStart - p.outer : 0;
      var chips = [];
      if (p.newcomer) chips.push('<span class="chip">新朋友</span>');
      if (choosing) chips.push('<span class="chip' + (p.keepDone ? ' on' : '') + '">' + (p.keepDone ? '已選好' : '還沒選') + '</span>');
      if (p.want) chips.push('<span class="chip want">我要</span>');
      if (p.hasBurden) chips.push('<span class="chip">已填寫</span>');
      if (p.receivedVerse) chips.push('<span class="chip on">已領受</span>');
      // 第三行：他保住的那三樣。主持人接話全靠這一行 ——「你押在工作上」。
      var meta = (showKeep && p.keep.length)
        ? '<div class="meta keep">' + p.keep.map(function (id) { return esc(assetName(id)); }).join('・') + '</div>'
        : '';
      return '' +
        '<div class="prow">' +
          '<div class="nm">' + esc(p.name) +
            (drop > 0 ? '<span class="drop">−' + drop + '</span>' : '') +
            chips.join('') +
          '</div>' +
          // 上面是幸福指數（今晚會一直往下掉），下面是幸福根基（今晚才有名字）
          gauge('幸福指數', p.outer == null ? '—' : p.outer, outer, 'var(--vol)') +
          gauge(S.named ? '幸福根基' : '？？？', p.inner || 0, p.inner || 0, 'var(--root-c)') +
          meta +
        '</div>';
    }).join('');
  }

  // ── 元件 ─────────────────────────────────────────────────────────────
  // 作答中的計數。分布不在這裡長 —— 先看到別人的答案會互相定錨，
  // 而且主持人少了「翻頁」這個把注意力收回來的動作。
  function answering(n, unit) {
    var all = S.stats.count > 0 && n >= S.stats.count;
    return '<div class="big" style="margin-top:24px">' + n +
        ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + S.stats.count + ' ' + (unit || '人已作答') + '</span></div>' +
      (all ? '<div class="note" style="border-left-color:var(--root-c);color:var(--ink)">' +
        '<b>大家都作答完了</b>　按「下一頁」看結果。</div>' : '');
  }

  function assetArt(id) {
    return '<img class="tileart" src="/happiness/shared/art/asset-' + id + '.svg" alt="">';
  }

  // 十一樣人生資產＋那一格選不到的。它會掛在牆上十五分鐘，然後才翻開。
  // 這裡不顯示誰選了什麼 —— 全場看得到別人押哪裡，就會有人改跟別人一樣。
  function board() {
    return '<div class="board">' + S.assets.map(function (a) {
      return '<div class="tile">' +
        assetArt(a.id) +
        '<span class="nm">' + esc(a.name) + '</span>' +
      '</div>';
    }).join('') +
      '<div class="tile locked"><span class="q">' + esc(S.locked.name) + '</span>' +
        '<span class="nm">' + esc(S.locked.label) + '</span></div>' +
    '</div>';
  }

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

  // 已經開過的項目排成一列，讓全場看得到還剩幾樣。最後那一格是選不到的那一樣。
  function progressStrip() {
    var r = S.reveal;
    return '<div class="deplist">' + Array.apply(null, { length: r.total }).map(function (_, i) {
      return '<span class="' + (i <= r.idx ? 'on' : '') + '">' + (i + 1) + '</span>';
    }).join('') + '<span class="q' + (S.phase.id === 'mystery' || S.mysteryOpen ? ' on' : '') + '">？</span></div>';
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

  // 每個人選了哪三樣。結算頁那一份還會多印各剩幾成 —— 這一份是給大家找自己用的。
  function keepList(withRates) {
    if (!S.stats.survive.length) return '';
    return '<span class="kicker" style="margin-top:26px">' + (withRates ? '每個人手上剩下什麼' : '每個人選了什麼') + '</span>' +
      '<div class="keeplist">' + S.stats.survive.map(function (row) {
        return '<div class="keeprow">' +
          '<span class="nm">' + esc(row.name) + '</span>' +
          '<span class="got">' + (row.items.length
            ? row.items.map(function (it) {
                return '<span class="lot">' + esc(it.name) +
                  (withRates && it.revealed ? ' <b>剩 ' + it.left + '%</b>' : '') + '</span>';
              }).join('')
            : '<span class="none">還沒選</span>') + '</span>' +
          (withRates && row.drop > 0 ? '<span class="drop">−' + row.drop + '</span>' : '') +
        '</div>';
      }).join('') + '</div>';
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
        '<div class="note">第一次來、忘記帶卡片、上次沒來——手機上有一個按鈕，按現在的感覺填就好。<b>兩種都算數，今天的遊戲不吃上一關的任何東西。</b></div>';
    },

    keep_intro: function () {
      return '<h2>人生只能保住三樣</h2>' +
        '<p class="lede">下面這些，三十年後你只保得住 <b>' + S.keepCount + ' 樣</b>。不用錢、不用搶，每個人都選得到自己要的那三樣。</p>' +
        board();
    },

    keep: function () {
      return '<h2>選出你要保住的三樣</h2>' +
        '<p class="lede">在手機上選。選好之前都可以改，翻頁之後就不能改了。</p>' +
        answering(S.stats.keptDone, '人已選好') +
        board();
    },

    keep_result: function () {
      var top = S.stats.keepCounts.filter(function (x) { return x.n > 0; }).slice(0, 4);
      var max = top.length ? top[0].n : 1;
      return '<h2>全場想保住的</h2>' +
        '<p class="lede" style="color:var(--root-c);font-weight:700">你為什麼選這三樣？</p>' +
        '<div class="opts">' + top.map(function (x) {
          return '<div class="opt">' +
            '<span class="lbl">' + esc(x.name) + '</span>' +
            '<span class="track"><i style="width:' + (x.n / max * 100) + '%"></i></span>' +
            '<span class="n">' + x.n + ' 人</span>' +
          '</div>';
        }).join('') + '</div>' +
        keepList(false);
    },

    q20: function () {
      return '<h2>' + esc(S.q20.question) + '</h2>' +
        '<p class="lede">四個選項，憑直覺。沒有正確答案。</p>' +
        answering(S.stats.answeredQ20);
    },

    q20_result: function () {
      return '<h2>全場是這樣想的</h2>' + optionBars();
    },

    ff_intro: function () {
      return '<h2>時間快轉三十年</h2>' +
        '<p class="lede">你剛剛保住的那三樣，現在要驗貨。一項一項來。</p>' +
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
        '<div class="deptop">' +
          '<div>' +
            '<div class="depname">' + esc(it.name) + '</div>' +
            '<div class="deprow">' +
              '<div class="deprate">' + pct(it.rate) + '</div>' +
              '<div class="depwhy">' + esc(it.why) + '</div>' +
            '</div>' +
          '</div>' +
          assetArt(it.id) +
        '</div>' +
        avgLine() +
        progressStrip();
    },

    survive: function () {
      return '<h2>三十年後，你手上剩下什麼</h2>' +
        avgLine() +
        keepList(true);
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
        '<p class="lede" style="text-align:center;margin:22px auto 0">剛剛那張表上，你選不到這一樣。<br>' +
        '而三十年後，它是唯一還在的。</p>';
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

    // 七關共用的那四頁，內容在 shared/stage-parts.js
    message: function () {
      return StageParts.testimony();
    },

    verse: function () {
      return StageParts.verse({
        ref: S.verse.ref, text: S.verse.text,
        done: S.stats.versesReceived, total: S.stats.count,
      }) +
        '<div style="margin-top:calc(26px * var(--u))"><span class="kicker">十五分鐘前，你們是這樣想的</span>' + optionBars() + '</div>';
    },

    prayer: function () {
      return StageParts.prayer({
        lede: '今天有哪一項的折舊，讓你心裡動了一下？寫下來。只有你自己看得到。',
        done: S.stats.burdens, total: S.stats.count,
      });
    },

    card: function () {
      return StageParts.keepsake({
        done: S.stats.cardsDone, total: S.stats.count,
        extra: '你今晚保住的三樣',
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
    stage.className = 'stage phase-' + S.phase.id;
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
    if (e.repeat) return;   // 按住不放不要一次跳好幾頁
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
