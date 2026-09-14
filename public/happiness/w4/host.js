// 主持人大螢幕 · 第四關「幸福連線」
(function () {
  'use strict';
  var WEEK = 4;
  // 大螢幕上印給人手動打字的網址。越短越好打 —— 手機鍵盤打 ? 和 = 很痛苦。
  var JOIN_PATH = '/4';
  var NOTES_PATH = '/h4';   // 主持人備忘錄，掃不到的時候也打得出來
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
    var onCalls = S.phase.id === 'calls';
    var onDial = S.phase.id === 'hotline';

    el.innerHTML = S.players.map(function (p) {
      var outer = p.outer == null ? 0 : p.outer;
      // **不掛「新朋友」標籤。** 它就貼在名字旁邊，全場都看得到 ——
      // 第一次來的人會覺得自己被標記了。要知道誰第一次來，看主持人備忘錄。
      var chips = [];
      if (onCalls && !S.callsNow.revealed) chips.push('<span class="chip' + (p.picked ? ' on' : '') + '">' + (p.picked ? '已選' : '還沒選') + '</span>');
      if (onDial) chips.push('<span class="chip' + (p.called ? ' on' : '') + '">' + (p.called ? '已接通' : '還沒撥') + '</span>');
      if (p.hasNeed) chips.push('<span class="chip">已寫下</span>');
      if (p.receivedVerse) chips.push('<span class="chip on">已領受</span>');

      // 他做過的那幾件（兩題去重）。主持人接話全靠這一行 ——
      // **但只念數字，不要對著這一行點名。** 有幾格是很私人的（家人、自己撐）。
      var meta = p.callNames.length
        ? '<div class="meta keep">' + p.callNames.map(esc).join(' · ') + '</div>'
        : '';
      // 接通之後這裡出現 +10（這一關幸福指數唯一動的一次）。
      var delta = p.gain
        ? '<span class="' + (p.gain > 0 ? 'up' : 'down') + '">' +
            (p.gain > 0 ? '+' : '') + p.gain + '</span>'
        : '';
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

  // ── 七件事 ───────────────────────────────────────────────────────────
  // 揭曉之後**七格長得一模一樣** —— 螢幕不替任何人的選擇打分數，
  // 而且這一頁一分都不動。差別只在那件事後來怎麼了，
  // 而每一句都先承認它給了什麼，再說它沒給什麼。
  //
  // **複選**：一個人可以同時出現在好幾格裡。真的出事的時候本來就是這樣。
  function callBoard() {
    var c = S.callsNow;
    return '<div class="callhd">' +
        '<h2>深夜兩點，你會怎麼做</h2>' +
        '<span class="rn">' + (c.idx + 1) + ' <small>/ ' + c.total + '</small></span>' +
      '</div>' +
      // **一整段一樣大的字。** 拆成大標＋小副標會讀成兩件事，
      // 但它本來就是一口氣講完的一個場景。
      '<div class="callwhen">' + esc(c.text) + '</div>' +
      '<div class="callgrid">' + c.lines.map(function (l) {
        return '<div class="cl' + (c.revealed ? ' done' : '') + (l.other ? ' other' : '') + '">' +
          // 條件那行小字不上牆 —— 格子只留名字，條件由主持人口頭帶。
          '<div class="clhd"><img class="clart" src="/happiness/shared/art/line-' + esc(l.art) + '.svg" alt="">' +
            '<b>' + esc(l.name) + '</b></div>' +
          '<div class="who">' + (l.who.length ? l.who.map(esc).join('・') : '　') + '</div>' +
          (c.revealed ? '<div class="reply">' + esc(l.reply) + '</div>' : '') +
        '</div>';
      }).join('') +
        // 七格排兩欄就是四列八格，第八格放「幾人已選」——
        // 擺在格子底下會多吃掉一整行的高度，這一頁就掉出畫面了。
        //
        // **公布之後第八格是空的。** 原本放「每一件都陪了你。沒有一件把那件事拿走。」，
        // 但那是下一頁（統計圖）的收口 —— 這裡先講出來，下一頁就沒有戲了，
        // 而且七句回應自己已經在講這件事，牆上不用再替它下結論。
        '<div class="callend">' + (c.revealed ? '' : counter(S.stats.callPicked, '人已選')) + '</div>' +
      '</div>';
  }

  // ── 統計圖 ───────────────────────────────────────────────────────────
  // 兩題加起來，全場都去了哪裡。**算人數，不算次數** ——
  // 主持人要念的是「今天晚上有五個人自己撐過去」，那是人。
  // 「其他」排最後，而且印的是他們自己寫的字 —— 那一格是這一頁的壓軸。
  function tallyBoard() {
    var t = S.tallyNow;
    return '<div class="callhd"><h2>' + esc(S.tally.title) + '</h2>' +
        '<span class="rn"><small>' + esc(S.tally.sub) + '</small></span></div>' +
      '<div class="bars">' + t.rows.map(function (r) {
        var pct = Math.round(r.n / t.max * 100);
        var tail = r.other && r.texts.length
          ? r.texts.map(function (x) {
              return '<span class="ot">' + esc(x.text) + '<i>' + esc(x.name) + '</i></span>';
            }).join('')
          : (r.who.length ? '<span class="nm">' + r.who.map(esc).join('・') + '</span>' : '');
        return '<div class="barrow' + (r.other ? ' other' : '') + (r.n ? '' : ' zero') + '">' +
          '<span class="blbl">' + esc(r.name) + '</span>' +
          '<span class="btrack"><i style="width:' + pct + '%"></i></span>' +
          '<span class="bn">' + r.n + ' 人</span>' +
          '<span class="bwho">' + tail + '</span>' +
        '</div>';
      }).join('') + '</div>';
      // 底下不下結論。長條自己會講，要收口由主持人講。
  }

  // ── 第三通電話 ───────────────────────────────────────────────────────
  // **一按就接。** 不要鈴聲、不要轉接中、不要語音信箱。
  function dialBoard() {
    var h = S.hotlineNow;
    if (h.connected) {
      return '<div class="dialwrap">' +
        '<div class="dialcard on">' +
          '<img src="/happiness/shared/art/hotline.svg" alt="">' +
          '<div class="connected">' + esc(S.hotline.connected) + '</div>' +
        '</div>' +
        '<div class="halfverse">「' + esc(S.hotline.half) + '」</div>' +
      '</div>';
    }
    return '<div class="dialwrap">' +
      '<div class="dialcard">' +
        '<img src="/happiness/shared/art/hotline.svg" alt="">' +
        '<div class="dialno">????</div>' +
        '<div class="dialconds">' + S.hotline.conds.map(function (x) {
          return '<span>' + esc(x) + '</span>';
        }).join('') + '</div>' +
        '<div class="dialknows">' + esc(S.hotline.knows) + '</div>' +
      '</div>' +
      counter(h.dialed, '人已撥出') +
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

    // 七關共用的一頁，內容在 shared/stage-parts.js
    reconnect: function () {
      return StageParts.reconnect({
        done: S.stats.reconnected, total: S.stats.count,
      });
    },

    // 比喻不是我們發明的，是教會第 2 頁寫死的。整關就是一支電話。
    intro: function () {
      return '<div class="teaser">' +
        '<span class="kicker">' + esc(S.intro.kicker) + '</span>' +
        '<h2 class="big-title">' + esc(S.intro.title) + '</h2>' +
        '<div class="teaseart"><img src="/happiness/shared/art/hotline.svg" alt=""></div>' +
        '<p class="teaseline">' + esc(S.intro.line) + '</p>' +
      '</div>';
    },

    calls: function () { return callBoard(); },

    tally: function () { return tallyBoard(); },

    // 這一關最會出事的一頁。
    // **以賽亞書那一段不印在牆上** —— 整段引上去，這一頁就變成一塊要讀的長文，
    // 全場會低頭讀完，主持人就沒有戲了。那是他講的故事，台詞在備忘錄裡。
    // 牆上只留兩樣：標題，和那個問句。
    idol: function () {
      return '<h2>' + esc(S.idol.title) + '</h2>' +
        '<div class="idolask">' + esc(S.idol.ask) + '</div>' +
        '<div class="costhd">' + esc(S.idol.costTitle) + '</div>' +
        '<div class="costs">' + S.idol.costs.map(function (c) {
          return '<div class="cost"><b>' + esc(c.k) + '</b><span>' + esc(c.v) + '</span></div>';
        }).join('') + '</div>' +
        '<div class="costline">' + esc(S.idol.costLine) + '</div>';
    },

    // **畫面上只有這一句問句。** 答案在下一頁 —— 先印出來他們就不會自己想了。
    ask: function () {
      return '<div class="solo"><h2>' + esc(S.ask.title) + '</h2></div>';
    },

    hotline: function () {
      return '<h2>' + esc(S.hotline.title) + '</h2>' + dialBoard();
    },

    testimony: function () {
      return StageParts.testimony();
    },

    verse: function () {
      return StageParts.verse({
        ref: S.verse.ref, text: S.verse.text,
        done: S.stats.versesReceived, total: S.stats.count,
      });
    },

    // 這一關的祝福禱告有指定題目。**完全不上牆** —— 這裡只有「幾人已寫下」。
    need: function () {
      return StageParts.prayer({
        lede: '「' + S.need.ask + '＿＿」。寫真的那一件 —— 只有你自己看得到，等一下我們一起禱告會用到它。',
        done: S.stats.needs, total: S.stats.count,
      });
    },

    how: function () {
      return '<h2>' + esc(S.how.title) + '</h2>' +
        '<div class="howlist">' + S.how.items.map(function (it, i) {
          return '<div class="how"><span class="n">' + (i + 1) + '</span>' +
            // 小字不上牆。每一點的翻譯由主持人講（備忘錄裡有）。
            '<b>' + esc(it.k) + '</b></div>';
        }).join('') + '</div>';
    },

    // 主持人起頭 → **30 秒安靜** → 收尾。三行，中間那一塊是空的。
    // **不要在這裡放制式禱告文** —— 一放上去這一頁就從「你自己講」變成「跟著念」，
    // 而這一頁全部的重量就在那個空白裡。
    pray: function () {
      return '<h2>' + esc(S.pray.title) + '</h2>' +
        '<div class="prayscript">' +
          '<div class="l1">' + esc(S.pray.open) + '</div>' +
          '<div class="l2">' + esc(S.pray.middle) + '</div>' +
          '<div class="l3">' + esc(S.pray.close) + '</div>' +
        '</div>';
    },

    // 天父的回信。**信是回的，籤是抽的** —— 前面剛講完算命，
    // 這一頁改成一封信就不會被聽成抽籤了。
    // **沒有「拆開它」這一步** —— 翻到這一頁信就已經是打開的，上面是整節經文。
    letter: function () {
      return '<h2>' + esc(S.grace.title) + '</h2>' +
        '<div class="letteropen">' +
          '<img class="env" src="/happiness/shared/art/letter-open.svg" alt="">' +
          '<div class="sheet">' +
            '<blockquote>「' + esc(S.grace.text) + '」</blockquote>' +
            '<span class="ref">' + esc(S.verse.ref) + '</span>' +
          '</div>' +
        '</div>';
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
        week: '當上帝來敲門',
        lines: [
          '今天外面什麼都沒變 —— 是接通那一通，讓幸福指數多了 10。底下那一條也長了。',
          '今天這一通是你打的。下一關 —— 換他來敲你的門。',
          '那張恩典卡收好，下一關第一件事就是把它拿出來。',
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
    }  }

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
      if (el) el.style.display = on ? 'inline-flex' : 'none';
    };
    show('callctl', S.phase.id === 'calls');
    show('dialctl', S.phase.id === 'hotline');

    if (S.phase.id === 'calls') {
      // 一顆按鈕按到底：還沒撥就是「撥出去」，撥過了才變「下一通」。
      var c = S.callsNow;
      var last = c.idx >= c.total - 1;
      document.getElementById('cprev').disabled = c.idx <= 0;
      var fn = document.getElementById('cstep');
      fn.textContent = !c.revealed
        ? '公布結果（' + (c.idx + 1) + '/' + c.total + '）'
        : (last ? '都公布了，按下一頁' : '下一題 →（' + (c.idx + 2) + '/' + c.total + '）');
      fn.disabled = c.revealed && last;
    }
    if (S.phase.id === 'hotline') {
      var h = S.hotlineNow;
      var cn = document.getElementById('cnow');
      cn.textContent = h.connected
        ? '已接通'
        : '全場接通（' + h.dialed + '/' + h.total + ' 已撥）';
      cn.disabled = h.connected;
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
    // 鍵盤只留翻頁。
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
