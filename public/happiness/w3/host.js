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
    var onMap = S.phase.id === 'map';
    var onQuiz = S.phase.id === 'quiz';
    var onVote = S.phase.id === 'afterlife';

    el.innerHTML = S.players.map(function (p) {
      var outer = p.outer == null ? 0 : p.outer;
      // **不掛「新朋友」標籤。** 它就貼在名字旁邊，全場都看得到 ——
      // 第一次來的人會覺得自己被標記了。要知道誰第一次來，看主持人備忘錄。
      var chips = [];
      if (onMap && !S.walked) chips.push('<span class="chip' + (p.path[S.mapNow.idx] ? ' on' : '') + '">' + (p.path[S.mapNow.idx] ? '已選' : '還沒選') + '</span>');
      if (onQuiz) chips.push('<span class="chip' + (p.answered ? ' on' : '') + '">' + (p.answered ? '已作答' : '還沒答') + '</span>');
      if (onVote) chips.push('<span class="chip' + (p.vote !== null ? ' on' : '') + '">' + (p.vote !== null ? '已投票' : '還沒投') + '</span>');
      if (p.hasBurden) chips.push('<span class="chip">已填寫</span>');
      if (p.receivedVerse) chips.push('<span class="chip on">已領受</span>');

      // 走完之後印他那一條路。主持人接話全靠這一行。
      var meta = '';
      if (S.walked && p.path.length) {
        meta = '<div class="meta keep">' + p.path.map(function (c, k) {
          return esc(c === 'A' ? S.forks[k].a.short : S.forks[k].b.short);
        }).join(' → ') + '</div>';
      }
      var delta = (S.walked && p.gain) ? '<span class="up">+' + p.gain + '</span>' : '';
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
  function counter(n, unit) {
    var all = S.stats.count > 0 && n >= S.stats.count;
    return '<div class="qcount' + (all ? ' all' : '') + '">' + n + ' / ' + S.stats.count + ' ' + unit +
      (all ? '　<b>大家都好了</b>' : '') + '</div>';
  }

  // ── 人生模擬器 ───────────────────────────────────────────────────────
  // 走過的岔路留在畫面上，那是地圖的形狀；現在這一個是兩個大格子。
  function forkBoard() {
    var m = S.mapNow;
    var trail = m.trail.map(function (t, k) {
      if (!t) return '';
      return '<div class="trailrow">' +
        '<span class="age">' + esc(S.forks[k].age) + '</span>' +
        '<span class="side">' + esc(S.forks[k].a.short) +
          '<i>' + (t.a.length ? t.a.map(esc).join('・') : '—') + '</i></span>' +
        '<span class="side">' + esc(S.forks[k].b.short) +
          '<i>' + (t.b.length ? t.b.map(esc).join('・') : '—') + '</i></span>' +
      '</div>';
    }).join('');

    return (trail ? '<div class="trail">' + trail + '</div>' : '') +
      '<div class="forkbox">' +
        '<div class="forkage">' + esc(m.age) + '　<small>岔路 ' + (m.idx + 1) + ' / ' + m.total + '</small></div>' +
        '<div class="forks">' +
          '<div class="fk"><span class="tag2">A</span><b>' + esc(m.a.text) + '</b></div>' +
          '<div class="fk"><span class="tag2">B</span><b>' + esc(m.b.text) + '</b></div>' +
        '</div>' +
      '</div>' +
      counter(S.stats.forkPicked, '人已選');
  }

  // 結局頁：八條全部攤開。**只看自己那一條是運氣，八條一起看才是「沒有規則」。**
  function endingBoard() {
    return '<div class="endlist' + (S.endings.length > 6 ? ' dense' : '') + '">' + S.endings.map(function (e) {
      return '<div class="endrow' + (e.who.length ? ' mine' : '') + '">' +
        '<span class="steps">' + e.steps.map(function (t) {
          return '<span class="st">' + esc(t) + '</span>';
        }).join('<i>→</i>') + '</span>' +
        '<span class="txt">' + esc(e.text) + '</span>' +
        '<span class="gain">' + (e.gain == null ? '' : '+' + e.gain) + '</span>' +
        '<span class="who">' + (e.who.length ? e.who.map(esc).join('・') : '') + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  // ── 猜句子 ───────────────────────────────────────────────────────────
  function quizHead() {
    var q = S.quiz;
    return '<div class="qtop">' +
        '<h2>這句話是誰說的</h2>' +
        '<span class="qn">Q' + (q.idx + 1) + ' <small>/ ' + q.total + '</small></span>' +
        (q.revealed ? '<span class="qsrc">' + esc(q.src) + '</span>' : '') +
      '</div>' +
      (q.revealed ? '' : counter(S.stats.answered, '人已作答'));
  }

  // **揭完不多印一行說明** —— 補充是你講的，印在牆上就變成一份工作手冊。
  function quizCard() {
    var q = S.quiz;
    var max = Math.max.apply(null, q.counts.concat([1]));
    return '<div class="quote">「' + esc(q.text) + '」</div>' +
      '<div class="opts quiz">' + q.options.map(function (o, i) {
        var cls = 'opt';
        if (q.revealed) cls += (i === q.answer ? ' right' : ' pale');
        return '<div class="' + cls + '">' +
          '<span class="lbl">' + esc(o) + '</span>' +
          '<span class="track"><i style="width:' + (q.revealed ? (q.counts[i] / max * 100) : 0) + '%"></i></span>' +
          '<span class="n">' + (q.revealed ? q.counts[i] + ' 人' : '') + '</span>' +
        '</div>';
      }).join('') + '</div>';
  }

  // onlyJesus：揭曉那一頁只留他說的那四句 —— 其他四句已經笑完了，該退場了。
  function boardList(onlyJesus) {
    var rows = onlyJesus ? S.board.filter(function (b) { return b.jesus; }) : S.board;
    return '<div class="quotelist' + (rows.length > 6 ? ' dense' : '') + '">' + rows.map(function (b) {
      return '<div class="qrow' + (b.jesus ? ' jesus' : '') + '">' +
        '<span class="t">「' + esc(b.text) + '」</span>' +
        '<span class="by">' + esc(b.by) + '</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  // 四格都是陳述句。**這一頁不放主持人的台詞。**
  function traceGrid() {
    var year = new Date().getFullYear();
    return '<div class="traces">' + S.traces.map(function (t) {
      return '<div class="trace"><b>' + esc(String(t.k).replace('{year}', year)) + '</b>' +
        '<span>' + esc(t.v) + '</span></div>';
    }).join('') + '</div>';
  }

  function voteBars() {
    var c = S.stats.voteCounts;
    var max = Math.max.apply(null, c.concat([1]));
    return '<div class="opts">' + S.afterlife.options.map(function (o, i) {
      return '<div class="opt">' +
        '<span class="lbl">' + esc(o) + '</span>' +
        '<span class="track"><i style="width:' + (c[i] / max * 100) + '%"></i></span>' +
        '<span class="n">' + c[i] + ' 人</span>' +
      '</div>';
    }).join('') + '</div>';
  }

  function avgLine() {
    var s = S.stats;
    if (s.outerAvg == null) return '';
    var d = (s.startAvg == null) ? null : s.outerAvg - s.startAvg;
    return '<span class="stat"><span>全場平均</span>' + s.outerAvg + '</span>' +
      (d == null ? '' : '<span class="stat up"><span>相對開場</span>' + (d > 0 ? '+' : '') + d + '</span>');
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

    // **大螢幕上不數第一次來的人，也不解釋他們拿到幾分。**
    // 那兩件事是寫給主持人看的，印在牆上就等於當著全場點名。
    reconnect: function () {
      return '<h2>打開上一次的卡片</h2>' +
        '<p class="lede">把卡片上的<b>幸福指數</b>和<b>幸福根基</b>打進去。</p>' +
        counter(S.stats.reconnected, '已接上');
    },

    map: function () {
      return '<div class="qtop"><h2>' + esc(S.map.title) + '</h2>' +
          '<span class="qn">' + esc(S.map.lead) + '</span></div>' +
        forkBoard();
    },

    endings: function () {
      return '<div class="afterhd"><h2>' + esc(S.map.endTitle) + '</h2>' + avgLine() + '</div>' +
        endingBoard() +
        '<p class="endline">' + esc(S.map.endLine) + '</p>';
    },

    sin: function () {
      return '<h2>' + esc(S.sin.title) + '</h2>' +
        '<div class="misskey">' + esc(S.sin.key) + '</div>' +
        '<div class="sinlines">' + S.sin.lines.map(function (l) {
          return '<p>' + esc(l) + '</p>';
        }).join('') + '</div>';
    },

    // 開場白：燈亮著，**光裡還沒有人**。不揭曉是誰。
    star: function () {
      return '<div class="teaser">' +
        '<span class="kicker">' + esc(S.star.teaseKicker) + '</span>' +
        '<h2 class="big-title">' + esc(S.star.teaseTitle) + '</h2>' +
        '<div class="teaseart"><img src="/happiness/shared/art/superstar-empty.svg" alt=""></div>' +
      '</div>';
    },

    quiz: function () {
      return quizHead() + quizCard();
    },

    answers: function () {
      return '<h2>這句話是誰說的</h2>' +
        '<p class="lede">' + esc(S.star.lead) + '</p>' +
        boardList(false);
    },

    // 他站進同一道光裡。同一個構圖、同一個位置，只多了他。
    reveal: function () {
      return '<h2>' + esc(S.star.title) + '</h2>' +
        '<div class="starwrap">' +
          '<div class="starart"><img src="/happiness/shared/art/superstar.svg" alt=""></div>' +
          '<div class="starcol">' + boardList(true) + '</div>' +
        '</div>' +
        traceGrid();
    },

    afterlife: function () {
      return '<div class="claim">' + esc(S.afterlife.ask) + '</div>' +
        (S.stats.voted >= S.stats.count && S.stats.count > 0
          ? voteBars()
          : counter(S.stats.voted, '人已投票'));
    },

    life: function () {
      return '<h2>' + esc(S.life.title) + '</h2>' +
        '<div class="verse back"><blockquote>「' + esc(S.life.quote) + '」' +
          '<span class="ref">' + esc(S.life.ref) + '</span></blockquote></div>' +
        '<div class="sinlines">' + S.life.lines.map(function (l) {
          return '<p>' + esc(l) + '</p>';
        }).join('') + '</div>';
    },

    verse: function () {
      return StageParts.verse({
        ref: S.verse.ref, text: S.verse.text,
        done: S.stats.versesReceived, total: S.stats.count,
      });
    },

    // 三段點出來。第三段點到的那一刻，全場幸福根基 +5。
    cross: function () {
      return '<h2>' + esc(S.cross.title) + '</h2>' +
        '<div class="steps3">' + S.cross.steps.map(function (st, i) {
          var on = i <= S.crossStep;
          return '<div class="s3' + (on ? ' on' : '') + '">' +
            '<b>' + esc(st.head) + '</b>' +
            (on ? '<span>' + esc(st.line) + '</span>' : '') +
          '</div>';
        }).join('') + '</div>' +
        (S.crossStep >= 2
          ? '<div class="plus">全場　幸福根基 +' + S.graceInner + '</div>'
          : '');
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

  // ── 主渲染 ───────────────────────────────────────────────────────────
  function paint() {
    stage.className = 'stage phase-' + S.phase.id;
    stage.innerHTML = (views[S.phase.id] || function () { return ''; })();

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
      S.phase.id === 'lobby' ? '玩家掃碼進場後按「下一頁」開始' : '';

    // 每一頁該出現哪幾顆控制鈕。**現場不要靠鍵盤** ——
    // 主持人手上還有麥克風和一份講稿，記不住哪一頁的空白鍵是什麼意思。
    var show = function (id, on) {
      var el = document.getElementById(id);
      if (el) el.style.display = on ? (id === 'quizctl' || id === 'mapctl' ? 'inline-flex' : 'inline-block') : 'none';
    };
    show('mapctl', S.phase.id === 'map');
    show('quizctl', S.phase.id === 'quiz');
    show('crossbar', S.phase.id === 'cross');

    if (S.phase.id === 'map') {
      var last = S.mapNow.idx >= S.mapNow.total - 1;
      document.getElementById('fprev').disabled = S.mapNow.idx <= 0;
      var fn = document.getElementById('fnext');
      fn.textContent = last ? '走完了，按下一頁' : '往前走 →（' + (S.mapNow.idx + 2) + '/' + S.mapNow.total + '）';
      fn.disabled = last;
    }
    if (S.phase.id === 'quiz') {
      // 一顆按鈕按到底：還沒揭就是「揭曉答案」，揭過了才變「下一題」。
      document.getElementById('qprev').disabled = S.quiz.idx <= 0;
      var lastQ = S.quiz.idx >= S.quiz.total - 1;
      var step = document.getElementById('qstep');
      step.textContent = !S.quiz.revealed
        ? '揭曉答案（' + (S.quiz.idx + 1) + '/' + S.quiz.total + '）'
        : (lastQ ? '最後一題' : '下一題 →（' + (S.quiz.idx + 2) + '/' + S.quiz.total + '）');
      step.disabled = S.quiz.revealed && lastQ;
    }
    if (S.phase.id === 'cross') {
      var cb = document.getElementById('crossbar');
      cb.textContent = S.crossStep >= 2 ? '三段都出來了' : '下一段（' + ((S.crossStep || 0) + 1) + '/3）';
      cb.disabled = S.crossStep >= 2;
    }

    renderPlayers();
    paint();
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
    // 這一關的每一個動作都有自己的按鈕（控制列和備忘錄上各一份）——
    // 鍵盤只留翻頁，跟第一關一樣。
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
