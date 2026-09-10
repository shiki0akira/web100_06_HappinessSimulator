// 主持人大螢幕 · 第三關「萬世巨星」
(function () {
  'use strict';
  var WEEK = 3;
  // 大螢幕上印給人手動打字的網址。越短越好打 —— 手機鍵盤打 ? 和 = 很痛苦。
  var JOIN_PATH = '/3';
  var NOTES_PATH = '/h3';   // 主持人備忘錄，掃不到的時候也打得出來
  var S = null;
  var stage = document.getElementById('stage');

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var conn = null;
  var ROOM = '';
  var CLIMB_MS = 4000;      // 三條梯子往上爬幾秒。第二關的時光機是 3200。

  // 每個模組畫幾像素。跟著 --u 走，canvas 就能 1:1 顯示。
  function qrScale(base) {
    var u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1;
    var h = Math.min(1, (window.innerHeight || 720) / 700);
    return Math.max(3, Math.round(base * u * h));
  }
  function post(cmd, extra) { if (conn) conn.host(cmd, extra); }
  function joinUrl() { return location.origin + JOIN_PATH + '?room=' + ROOM; }

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
    var onQuiz = S.phase.id === 'quiz';
    var onRoads = S.phase.id === 'roads';
    var ladderName = {};
    S.ladders.forEach(function (l) { ladderName[l.id] = l.name; });

    el.innerHTML = S.players.map(function (p) {
      var outer = p.outer == null ? 0 : p.outer;
      var chips = [];
      if (p.newcomer) chips.push('<span class="chip">新朋友</span>');
      // 猜句子那一頁只顯示「答了沒」，不顯示他選了什麼 ——
      // 先攤開會有人改成跟別人一樣。
      if (onQuiz) chips.push('<span class="chip' + (p.answered ? ' on' : '') + '">' + (p.answered ? '已作答' : '還沒答') + '</span>');
      if (onRoads && !S.climbed) chips.push('<span class="chip' + (p.road ? ' on' : '') + '">' + (p.road ? '已選路' : '還沒選') + '</span>');
      if (p.hasBurden) chips.push('<span class="chip">已填寫</span>');
      if (p.receivedVerse) chips.push('<span class="chip on">已領受</span>');

      // 第三行：爬完之後印他走的那一條路。主持人接話全靠這一行。
      var meta = (S.climbed && p.road)
        ? '<div class="meta keep">' + esc(ladderName[p.road] || '') + '</div>' : '';
      // 爬完那一下的漲跌一起印出來：先 +N 再 −M，看得到那個波動
      var delta = '';
      if (S.climbed && p.climbGain) {
        delta = '<span class="up">+' + p.climbGain + '</span><span class="drop">−' + p.climbFall + '</span>';
      }
      return '' +
        '<div class="prow">' +
          '<div class="nm">' + esc(p.name) + delta + chips.join('') + '</div>' +
          gauge('幸福指數', p.outer == null ? '—' : p.outer, outer, 'var(--vol)') +
          gauge('幸福根基', p.inner ? p.inner : '—', p.inner || 0, 'var(--root-c)') +
          meta +
        '</div>';
    }).join('');
  }

  // ── 元件 ─────────────────────────────────────────────────────────────
  function answering(n, unit) {
    var all = S.stats.count > 0 && n >= S.stats.count;
    return '<div class="big" style="margin-top:16px">' + n +
        ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + S.stats.count + ' ' + (unit || '人已作答') + '</span></div>' +
      (all ? '<div class="note" style="border-left-color:var(--root-c);color:var(--ink)">' +
        '<b>大家都好了</b>　按空白鍵。</div>' : '');
  }

  // ── 猜句子 ───────────────────────────────────────────────────────────
  // 一題一題開，開完馬上揭答案。**答錯不要有紅色、不要有音效** ——
  // 這一頁的功能是好玩，不是考倒他們。
  function quizCard() {
    var q = S.quiz;
    var max = Math.max.apply(null, q.counts.concat([1]));
    return '<div class="qhead"><span class="qn">Q' + (q.idx + 1) + ' <small>/ ' + q.total + '</small></span>' +
        (q.revealed ? '<span class="qsrc">' + esc(q.src) + '</span>' : '') + '</div>' +
      '<div class="quote">「' + esc(q.text) + '」</div>' +
      '<div class="opts quiz">' + q.options.map(function (o, i) {
        var cls = 'opt';
        if (q.revealed) cls += (i === q.answer ? ' right' : ' pale');
        return '<div class="' + cls + '">' +
          '<span class="lbl">' + esc(o) + '</span>' +
          '<span class="track"><i style="width:' + (q.revealed ? (q.counts[i] / max * 100) : 0) + '%"></i></span>' +
          '<span class="n">' + (q.revealed ? q.counts[i] + ' 人' : '') + '</span>' +
        '</div>';
      }).join('') + '</div>' +
      (q.revealed
        ? (q.note ? '<div class="note" style="border-left-color:var(--gold)">' + esc(q.note) + '</div>' : '')
        : answering(S.stats.answered, '人已作答'));
  }

  // 揭曉：八題排開，他說的那四句亮起來。
  // onlyJesus：第二段只留他說的那四句 —— 其他四句已經笑完了，該退場了。
  function boardList(onlyJesus) {
    var rows = onlyJesus ? S.board.filter(function (b) { return b.jesus; }) : S.board;
    return '<div class="quotelist' + (rows.length > 6 ? ' dense' : '') + '">' + rows.map(function (b) {
      return '<div class="qrow' + (b.jesus ? ' jesus' : '') + '">' +
        '<span class="t">「' + esc(b.text) + '」</span>' +
        '<span class="by">' + esc(b.by) + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function traceGrid() {
    return '<div class="traces">' + S.traces.map(function (t) {
      return '<div class="trace"><b>' + esc(t.k) + '</b><span>' + esc(t.v) + '</span></div>';
    }).join('') + '</div>' +
      '<p class="traceline">' + esc(S.reveal.traceLine) + '</p>';
  }

  // ── 罪 ───────────────────────────────────────────────────────────────
  function sinBars() {
    var c = S.stats.sinCounts;
    var max = Math.max.apply(null, c.concat([1]));
    return '<div class="opts sin' + (S.sins.length > 6 ? ' dense' : '') + '">' + S.sins.map(function (o, i) {
      return '<div class="opt">' +
        '<span class="lbl">' + esc(o) + '</span>' +
        '<span class="track"><i style="width:' + (c[i] / max * 100) + '%"></i></span>' +
        '<span class="n">' + c[i] + ' 人</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  // ── 三條梯子 ─────────────────────────────────────────────────────────
  // 上面那一格爬的時候是空的，不標字 —— 跟第一關的 ??? 是同一招。
  // 爬完三條停在同一個高度，離那一格還有一大段空白。
  function ladderBoard(showGoal) {
    var lit = climbStep;   // 0–4，動畫跑到第幾階
    // 還沒爬的時候，上面那一格就是「開始爬」的按鈕 —— 大螢幕上不多一顆控制鈕。
    var ready = !S.climbed;
    return '<div class="climb">' +
      '<div class="goal' + (showGoal ? ' on' : '') + (ready ? ' ready' : '') + '"' +
        (ready ? ' id="climbbtn" title="點一下開始爬"' : '') + '>' +
        (showGoal ? '<b>' + esc(S.goal.name) + '</b>' : '<span class="q">' + esc(S.goal.mask) + '</span>') +
      '</div>' +
      '<div class="gapline">' + (S.climbed && lit >= 4 ? esc(S.roads.short) : '') + '</div>' +
      '<div class="ladders">' + S.ladders.map(function (l) {
        var rungs = '';
        for (var i = l.steps.length - 1; i >= 0; i--) {
          var on = S.climbed && lit > i;
          // 最後一階踩空：爬到頂之後那一階要看得出來是空的
          var slip = on && i === l.steps.length - 1 && lit >= 5;
          rungs += '<div class="rung' + (on ? ' lit' : '') + (slip ? ' slip' : '') + '">' +
            '<span class="s">' + (i + 1) + '</span>' +
            '<span class="t">' + esc(l.steps[i]) + '</span></div>';
        }
        return '<div class="ladder">' +
          '<div class="rungs">' + rungs + '</div>' +
          '<div class="sign"><b>' + esc(l.name) + '</b><span>' + esc(l.sub) + '</span></div>' +
          '<div class="who">' + (l.who.length
            ? l.who.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('')
            : '<span class="none">沒有人選</span>') + '</div>' +
        '</div>';
      }).join('') + '</div>' +
    '</div>';
  }

  function verseHalf(i) {
    var h = S.verse.halves;
    return '<div class="verse half' + (i ? ' second' : '') + '">' +
      '<blockquote>「' +
        '<span class="' + (i >= 0 ? 'on' : 'off') + '">' + esc(h[0]) + '</span>' +
        '<span class="' + (i >= 1 ? 'on' : 'off') + '">' + esc(h[1]) + '</span>' +
      '」<span class="ref">' + esc(S.verse.ref) + '</span></blockquote></div>';
  }

  function avgLine() {
    var s = S.stats;
    if (s.outerAvg == null) return '';
    var d = (s.startAvg == null) ? null : s.outerAvg - s.startAvg;
    return '<span class="stat"><span>全場平均</span>' + s.outerAvg + '</span>' +
      (d == null ? '' : '<span class="stat' + (d < 0 ? ' drop' : ' up') + '"><span>相對開場</span>' + (d > 0 ? '+' : '') + d + '</span>');
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
        '<p class="lede">把卡片上的<b>幸福指數</b>和<b>幸福根基</b>打進去。</p>' +
        answering(s.reconnected, '已接上') +
        (s.newcomers ? '<p class="mono" style="margin-top:8px;color:var(--root-c)">其中 ' + s.newcomers + ' 位第一次來或忘記帶卡片</p>' : '') +
        '<div class="note"><b>第一次來的人，幸福根基自動給 15。</b>　這條線不是比賽 —— 它從你來的第一天開始長。</div>';
    },

    quiz: function () {
      return '<h2>這句話是誰說的</h2>' + quizCard();
    },

    // 分兩段。**一次全放會爆版**（720p 的高度放不下八句話 ＋ 四個痕跡），
    // 而且分兩段本來就比較好講：先看八題，再看他留在你生活裡的東西。
    reveal: function () {
      if (S.revealStep < 1) {
        return '<h2>' + esc(S.reveal.title) + '</h2>' +
          '<p class="lede">' + esc(S.reveal.lead) + '</p>' +
          boardList(false);
      }
      return '<h2>' + esc(S.reveal.title) + '</h2>' +
        boardList(true) +
        traceGrid();
    },

    sins: function () {
      return '<span class="kicker">' + esc(S.sinAsk.kicker) + '</span>' +
        '<h2>' + esc(S.sinAsk.title) + '</h2>' +
        '<p class="lede">' + esc(S.sinAsk.lead) + '</p>' +
        answering(S.stats.sinsDone, '人已作答');
    },

    sin_teach: function () {
      return '<h2>' + esc(S.sinTeach.title) + '</h2>' +
        '<div class="misskey">' + esc(S.sinTeach.key) + '</div>' +
        sinBars();
    },

    judge: function () {
      return '<div class="judge"><h2>' + esc(S.judge.title) + '</h2>' +
        '<p>' + esc(S.judge.line) + '</p></div>';
    },

    roads: function () {
      return '<div class="afterhd"><h2>' + esc(S.roads.title) + '</h2>' +
          (S.climbed ? avgLine() : '<span class="flipcount">' + S.stats.roadsPicked + ' / ' + S.stats.count + ' 已選路</span>') + '</div>' +
        ladderBoard(false);
    },

    way: function () {
      var st = S.wayStep;
      return '<h2>' + esc(S.way.title) + '</h2>' +
        verseHalf(st >= 2 ? 1 : 0) +
        (st >= 1
          ? '<div class="cols3 way">' + S.way.cols.map(function (c) {
              return '<div class="col3"><h3>' + esc(c.name) + '</h3>' +
                '<p>' + esc(c.line) + '</p></div>';
            }).join('') + '</div>'
          : '<div class="stair"><span>' + esc(S.goal.name) + '</span></div>');
    },

    paid: function () {
      return '<h2>' + esc(S.paidInfo.title) + '</h2>' +
        '<div class="cross">✝</div>' +
        '<p class="paidline">' + esc(S.paidInfo.line) + '</p>' +
        '<div class="plus">全場　幸福指數 +' + S.paidPlus + '</div>';
    },

    verse: function () {
      return StageParts.verse({
        ref: S.verse.ref, text: S.verse.text,
        done: S.stats.versesReceived, total: S.stats.count,
      });
    },

    baptism: function () {
      return '<h2>' + esc(S.baptism.title) + '</h2>' +
        '<div class="baplist">' + S.baptism.lines.map(function (l) {
          return '<p>' + esc(l) + '</p>';
        }).join('') + '</div>' +
        '<div class="close">' + esc(S.baptism.close) + '</div>';
    },

    prayer: function () {
      return StageParts.prayer({
        lede: '在今天以前你以為他是誰，現在你覺得他是誰。兩句都只有你自己看得到。',
        done: S.stats.burdens, total: S.stats.count,
      });
    },

    card: function () {
      return StageParts.keepsake({
        done: S.stats.cardsDone, total: S.stats.count,
        extra: '你自己寫的那一句',
      });
    },

    end: function () {
      return StageParts.nextWeek({
        avg: S.stats.outerAvg,
        avgFrom: S.stats.startAvg,
        inner: S.stats.innerAvg || null,
        innerFrom: S.stats.innerStartAvg,
        innerLabel: '幸福根基',
        fromLabel: '上週',
        week: '幸福連線',
        lines: [
          '他說「到父那裡去」。那條線怎麼接上——下一關。',
          '卡片留著，下次開場請你輸入上面的兩個數字。',
        ],
      });
    },
  };

  // ── 爬梯子的動畫 ──────────────────────────────────────────────────────
  // 一階一階往上，四秒。爬到第四階之後再掉一格 —— 那就是「不夠」。
  // 做法照第二關的人生時光機：大螢幕和手機同步，跑完停住，主持人再翻頁。
  var climbStep = 0;
  var climbTimer = null;
  function runClimb(instant) {
    clearInterval(climbTimer);
    if (instant) { climbStep = 5; return; }
    climbStep = 0;
    var t0 = Date.now();
    climbTimer = setInterval(function () {
      var k = Math.min(1, (Date.now() - t0) / CLIMB_MS);
      // 前 80% 爬四階，最後 20% 踩空
      var next = k < 0.85 ? Math.min(4, Math.floor(k / 0.85 * 4) + 1) : 5;
      if (next !== climbStep) { climbStep = next; paint(); }
      if (k >= 1) clearInterval(climbTimer);
    }, 80);
  }

  // ── 主渲染 ───────────────────────────────────────────────────────────
  var lastPhase = '', lastClimbed = false;
  function paint() {
    stage.className = 'stage phase-' + S.phase.id;
    stage.innerHTML = (views[S.phase.id] || function () { return ''; })();

    var start = document.getElementById('climbbtn');
    if (start) start.onclick = function () { post('climb'); };

    var qr = document.getElementById('qr');
    if (qr && ROOM) {
      try { QR.render(qr, joinUrl(), qrScale(7), '#161A18', '#ffffff'); } catch (err) {}
    }
  }

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
      S.phase.id === 'lobby' ? '玩家掃碼進場後按「下一頁」開始'
      : S.phase.id === 'quiz' ? '空白鍵：揭答案 / 下一題'
      : S.phase.id === 'reveal' ? (S.revealStep < 1 ? '空白鍵：你早就在用他了' : '')
      : S.phase.id === 'roads' ? (S.climbed ? '' : '空白鍵：開始爬')
      : S.phase.id === 'way' ? '空白鍵：一段一段點出來'
      : '';

    renderPlayers();

    // 爬梯子的動畫：climbed 從 false 變 true 的那一刻才跑。
    // 翻走再翻回來不重跑（不然分數看起來像又動了一次）。
    if (S.phase.id === 'roads' && S.climbed && !lastClimbed) runClimb(false);
    else if (S.phase.id === 'roads' && S.climbed && lastPhase !== 'roads') runClimb(true);
    else if (S.phase.id === 'roads' && !S.climbed) { clearInterval(climbTimer); climbStep = 0; }

    paint();
    lastPhase = S.phase.id;
    lastClimbed = S.climbed;
  }

  // ── 啟動 ─────────────────────────────────────────────────────────────
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

  // 主持人備忘錄的 QR：按 N 叫出來，平常收著。
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
    if (e.repeat) return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); toggleNotes(); return; }
    if (e.key === 'Escape') { toggleNotes(false); return; }
    var space = e.key === ' ' || e.key === 'Enter';
    // 猜句子：空白鍵一顆按到底 —— 還沒揭就揭答案，揭過了就換下一題
    if (S && S.phase.id === 'quiz' && space) {
      e.preventDefault();
      if (!(S.quiz.revealed && S.quiz.idx >= S.quiz.total - 1)) { post('quizStep'); return; }
    }
    // 揭曉：第二段是「你早就在用他了」
    if (S && S.phase.id === 'reveal' && S.revealStep < 1 && space) {
      e.preventDefault(); post('revealStep'); return;
    }
    // 三條路：空白鍵是「開始爬」
    if (S && S.phase.id === 'roads' && !S.climbed && space) {
      e.preventDefault(); post('climb'); return;
    }
    // 救恩之路：一段一段點出來，三段點完才換頁
    if (S && S.phase.id === 'way' && S.wayStep < 2 && space) {
      e.preventDefault(); post('wayStep'); return;
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
