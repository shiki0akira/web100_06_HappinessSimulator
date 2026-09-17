// 主持人大螢幕 · 第七關「釋放與自由」
//
// 十三頁。最後一關 —— 沒有下週預告，最後一頁是天上的教會。
// 需要一步一步走的那幾頁（公布、下一段、補滿 100）共用一組按鈕，字由伺服器給（S.step）。
(function () {
  'use strict';
  var WEEK = 7;
  var JOIN_PATH = '/7';
  var NOTES_PATH = '/h7';
  var S = null;
  var stage = document.getElementById('stage');

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var conn = null;
  var ROOM = '';
  var ART = '/happiness/shared/art/';

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
  // **不掛鎖鏈數、不掛誰選了什麼** —— 只有「已決定」這種等人的標籤。
  function renderPlayers() {
    var el = document.getElementById('plist');
    if (!S.players.length) {
      el.innerHTML = '<p class="muted" style="font-size:calc(13px * var(--u))">還沒有人進場。</p>';
      return;
    }
    var id = S.phase.id;
    var onBound = id === 'bound' && !S.boundNow.revealed;
    var onRefuse = id === 'refuse' && !S.refuseNow.revealed;
    el.innerHTML = S.players.map(function (p) {
      var chips = [];
      if (id === 'free' && S.freeNow.step === 0) chips.push('<span class="chip' + (p.freeSent ? ' on' : '') + '">' + (p.freeSent ? '已送出' : '還沒') + '</span>');
      if (onBound || onRefuse) chips.push('<span class="chip' + (p.acted ? ' on' : '') + '">' + (p.acted ? '已決定' : '還沒') + '</span>');
      if (p.prayed) chips.push('<span class="chip">已寫下</span>');
      return '' +
        '<div class="prow">' +
          '<div class="nm">' + esc(p.name) + chips.join('') + '</div>' +
          gauge('幸福指數', p.outer == null ? '—' : p.outer, p.outer || 0, 'var(--vol)') +
          gauge('幸福根基', p.inner ? p.inner : '—', p.inner || 0, 'var(--root-c)') +
        '</div>';
    }).join('');
  }

  function counter(n, unit) {
    var all = S.stats.count > 0 && n >= S.stats.count;
    return '<div class="qcount' + (all ? ' all' : '') + '">' + n + ' / ' + S.stats.count + ' ' + unit +
      (all ? '　<b>大家都好了</b>' : '') + '</div>';
  }

  // 一排人：每個人一個小人，身上幾條鏈。**照進場順序，不排序。**
  function crowd(chains, dim) {
    return '<div class="crowd' + (dim ? ' dim' : '') + '">' + S.players.map(function (p) {
      var n = chains == null ? p.chains : chains;
      return '<div class="pp"><img src="' + ART + 'bound-' + Math.max(0, Math.min(5, n)) + '.svg" alt=""><b>' + esc(p.name) + '</b></div>';
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
      return StageParts.reconnect({ done: S.stats.reconnected, total: S.stats.count });
    },

    // 你覺得自由是什麼？ 0 作答 → 1 長條 → 2 浮出「還有一種自由：我可以說不。」
    free: function () {
      var f = S.freeNow, info = S.freeInfo;
      if (f.step === 0) {
        return '<h2>' + esc(info.title) + '</h2>' +
          '<div class="sub2">' + esc(info.sub) + '</div>' +
          '<div class="freeopts">' + info.options.map(function (o) {
            return '<div>' + esc(o.t) + '</div>';
          }).join('') + '<div class="other">' + esc(info.otherLabel) + '⋯⋯</div></div>' +
          counter(f.sent, '人已送出');
      }
      // **只有人數，不掛名字**
      return '<h2>' + esc(info.title) + '</h2>' +
        '<div class="bars free">' + f.rows.map(function (r) {
          return '<div class="bar2' + (r.n ? '' : ' zero') + '">' +
            '<span class="bl">' + esc(r.t) + '</span>' +
            '<span class="bt"><i style="width:' + Math.round(r.n / f.max * 100) + '%"></i></span>' +
            '<span class="bn">' + r.n + ' 人</span>' +
          '</div>';
        }).join('') + '</div>' +
        (f.others.length ? '<div class="others">' + f.others.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' : '') +
        (f.step >= 2 ? '<div class="saybig">' + esc(info.reveal) + '</div>' : '');
    },

    // 身不由己。公布之後**只有數字，不掛名字**。
    bound: function () {
      var b = S.boundNow, info = S.boundInfo;
      return '<h2>' + esc(info.title) + '</h2>' +
        '<div class="sub2">' + esc(info.sub) + '</div>' +
        '<div class="ev">' +
          '<div class="as">第 ' + (b.round + 1) + ' / ' + b.total + ' 回合 · ' + esc(b.bond) + '</div>' +
          '<div class="line">' + esc(b.text) + '</div>' +
          '<div class="two">' +
            '<div class="ease"><span class="k">' + esc(info.easeLabel) + '</span><span class="t">' + esc(b.ease) + '</span>' +
              (b.revealed ? '<span class="n">' + b.easeN + ' <small>人</small></span>' : '') + '</div>' +
            '<div class="no"><span class="k">' + esc(info.noLabel) + '</span><span class="t">' + esc(b.no) + '</span>' +
              (b.revealed ? '<span class="n">' + b.noN + ' <small>人</small></span>' : '') + '</div>' +
          '</div>' +
        '</div>' +
        (b.revealed
          ? '<div class="qcount">這一回合，全場身上又多了 ' + S.stats.count + ' 條鎖鏈</div>'
          : counter(b.acted, '人已決定'));
    },

    // 罪的奴僕，身不由己。0 帳單＋一排被綁住的人 → 1 淡掉，浮出「生活沒有意義，失去方向」
    bill: function () {
      var st = S.billStep;
      return '<h2>' + esc(S.bill.title) + '</h2>' +
        '<div class="billline">' + esc(S.bill.billLead) + (S.billTotal ? '　全場幸福指數 −' + S.billTotal : '') + '</div>' +
        '<div class="billwrap">' +
          crowd(null, st >= 1) +
          (st >= 1 ? '<div class="overline">' + esc(S.bill.line) + '</div>' : '') +
        '</div>';
    },

    story: function () {
      return StageParts.testimony({ title: S.story.title });
    },

    // 約翰福音 8:36。0 經文＋一人一截鎖鏈，領受就變成鳥飛走 → 1 信而受洗、醫治與平安
    verse: function () {
      if (S.verseStep >= 1) {
        return '<div class="faith">' + S.verse.faith.map(function (t) { return '<div>' + esc(t) + '</div>'; }).join('') + '</div>';
      }
      // 一截一截：**不照人排、不顯示誰還沒按** —— 斷掉的都排在前面
      var total = S.stats.count, broke = S.stats.broken, links = '';
      for (var i = 0; i < total; i++) {
        links += i < broke
          ? '<img class="bird" src="' + ART + 'bird.svg" alt="" data-i="' + i + '">'
          : '<img src="' + ART + 'chain-link.svg" alt="">';
      }
      return '<h2>領受經文</h2>' +
        '<div class="verse"><span class="ref">' + esc(S.verse.ref) + '</span>' +
          '<blockquote>「' + esc(S.verse.text) + '」</blockquote></div>' +
        '<div class="chainrow">' + links + '</div>' +
        '<div class="qcount' + (total && broke >= total ? ' all' : '') + '" style="text-align:center">' +
          broke + ' / ' + total + ' 已領受</div>';
    },

    // 拒絕的自由。**不計分**，大螢幕只出「說了幾次不」。
    refuse: function () {
      var r = S.refuseNow, info = S.refuseInfo;
      return '<h2>' + esc(info.title) + '</h2>' +
        '<div class="sub2">' + esc(info.sub) + '</div>' +
        '<div class="ev">' +
          '<div class="as">第 ' + (r.round + 1) + ' / ' + r.total + ' 回合 · ' + esc(r.bond) + '</div>' +
          '<div class="line">' + esc(r.text) + '</div>' +
          '<div class="two">' +
            '<div class="ease"><span class="k">' + esc(S.boundInfo.easeLabel) + '</span><span class="t">' + esc(r.ease) + '</span></div>' +
            '<div class="no"><span class="k">' + esc(S.boundInfo.noLabel) + '</span><span class="t">' + esc(r.no) + '</span>' +
              (r.revealed ? '<span class="n" style="color:var(--root-c)">' + r.noN + ' <small>次不</small></span>' : '') + '</div>' +
          '</div>' +
        '</div>' +
        (r.revealed
          ? '<div class="qcount all">今晚全場說了 ' + r.saidNo + ' 次不</div>'
          : counter(r.acted, '人已決定'));
    },

    trueFree: function () {
      var t = S.trueFree, top = S.freeNow.top.length ? S.freeNow.top : S.freeInfo.options.slice(0, 3).map(function (o) { return o.t; });
      return '<h2>' + esc(t.title) + '</h2>' +
        '<div class="goodgrid">' +
          '<div class="goodcol left"><h3>' + esc(t.leftLabel) + '</h3><ul>' +
            top.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
          '<div class="goodcol right"><h3>' + esc(t.rightLabel) + '</h3><ul>' +
            t.right.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '</div>' +
        '<div class="nofoot">今晚全場說了 <b>' + S.saidNo + '</b> 次不</div>';
    },

    // 補滿 100。**全場同一秒。** 按下去之前是各自的數字，之後一起長到 100。
    full: function () {
      var rows = S.players.map(function (p) {
        var from = p.innerBeforeFill == null ? (p.inner || 0) : p.innerBeforeFill;
        var now = S.filled ? 100 : (p.inner || 0);
        return '<div class="fr">' +
          '<div class="nm">' + esc(p.name) + '</div>' +
          '<div class="ln o"><span>幸福指數</span><span class="tr"><i style="width:' + (p.outer || 0) + '%"></i></span><b>' + (p.outer == null ? '—' : p.outer) + '</b></div>' +
          '<div class="ln n"><span>幸福根基</span><span class="tr"><i class="grow" data-to="' + now + '" style="width:' + (S.filled && fullAnimate ? from : now) + '%"></i></span>' +
            '<b class="gnum" data-from="' + from + '" data-to="' + now + '">' + (S.filled && fullAnimate ? from : now) + '</b></div>' +
        '</div>';
      }).join('');
      return '<h2>' + esc(S.filled ? S.full.title : '兩條線') + '</h2>' +
        '<div class="fullgrid">' + rows + '</div>' +
        (S.filled ? '<div class="fullnote"><span class="o">▍' + esc(S.full.outerNote) + '</span><span class="n">▍' + esc(S.full.innerNote) + '</span></div>' : '');
    },

    bless: function () {
      return StageParts.prayer({
        title: S.bless.title,
        lede: '「' + S.bless.ask + '＿＿」。只有你自己看得到。',
        done: S.stats.blessed, total: S.stats.count,
      });
    },

    card: function () {
      return StageParts.keepsake({
        done: S.stats.cardsDone, total: S.stats.count,
        extra: '「我可以說不」、你想對它說不的那一件事',
        // 最後一關：沒有下一關了
        lede: '長按手機上的圖片存進相簿。這是第七張卡。',
      });
    },

    // 天上的教會。三段：最後一格 → 那不是最後一格 → 天上的教會。
    // ⚠️ 第一段**幾秒就翻過去**，不准變成恐嚇。第三段是一群人，**不掛名字**。
    heaven: function () {
      var st = S.heavenStep, h = S.heaven;
      if (st === 0) {
        var n = Math.max(3, Math.min(5, S.players.length || 3)), rests = '';
        for (var i = 0; i < n; i++) rests += '<img src="' + ART + 'rest.svg" alt="">';
        return '<div class="heaven">' +
          '<div class="timeline"><i></i></div>' +
          '<div class="rests">' + rests + '</div>' +
          '<div class="hl">' + esc(h.steps[0]) + '</div>' +
        '</div>';
      }
      if (st === 1) {
        return '<div class="heaven">' +
          '<img class="tomb" src="' + ART + 'tomb-open.svg" alt="">' +
          '<div class="hl">' + esc(h.steps[1]) + '</div>' +
        '</div>';
      }
      return '<div class="heaven">' +
        '<img class="church" src="' + ART + 'heaven-church.svg" alt="">' +
        '<div class="hl" style="margin-top:min(calc(12px * var(--u)),1.5vh)">' + esc(h.steps[2]) + '</div>' +
        '<div class="vref">「' + esc(S.verse.text) + '」' + esc(S.verse.ref) + '</div>' +
        avgRow() +
        '<div class="fin">' + esc(h.end) + '</div>' +
      '</div>';
    },
  };

  // 今晚全場平均（跟前六關下週預告那一排一樣）：一條被推來推去，一條只往上
  function avgRow() {
    var st = S.stats;
    var one = function (label, v, from, cls) {
      var d = (v == null || from == null) ? null : v - from;
      return '<div class="avg ' + cls + '"><span class="l">' + label + '</span><b>' + (v == null ? '—' : v) + '</b>' +
        (d == null ? '' : '<span class="d">開場 ' + from + '　' + (d > 0 ? '+' : d === 0 ? '±' : '') + d + '</span>') + '</div>';
    };
    return '<div class="avgrow"><span class="k">今晚全場平均</span>' +
      one('幸福指數', st.outerAvg, st.startAvg, 'o') +
      one('幸福根基', st.innerAvg || null, st.innerStartAvg, 'n') + '</div>';
  }

  // ── 補滿 100 的動畫 ─────────────────────────────────────────────────
  // **在這一頁親眼看到它從沒補變成補滿**才播：全場的幸福根基同一秒一起往上長。
  // 重新整理或跳頁進來的時候已經補滿了，就直接畫 100。
  var fullAnimate = false, fullSeenEmpty = false, fullPlayed = false;
  function fullWatch() {
    if (S.phase.id !== 'full') { fullSeenEmpty = false; fullAnimate = false; fullPlayed = false; return; }
    if (!S.filled) { fullSeenEmpty = true; fullAnimate = false; fullPlayed = false; return; }
    fullAnimate = fullSeenEmpty && !fullPlayed;
  }
  function fullRun() {
    if (!fullAnimate) return;
    fullPlayed = true;
    fullSeenEmpty = false;
    var bars = stage.querySelectorAll('.fr .ln.n i.grow');
    var nums = stage.querySelectorAll('.fr .ln.n b.gnum');
    void stage.offsetWidth;
    // 不用 requestAnimationFrame：分頁在背景時它不會跑，數字會卡在補滿之前
    setTimeout(function () {
      bars.forEach(function (b) { b.style.width = b.dataset.to + '%'; });
      var t0 = Date.now(), DUR = 2600;
      var tick = setInterval(function () {
        var t = Math.min(1, (Date.now() - t0) / DUR), e = 1 - Math.pow(1 - t, 3);
        nums.forEach(function (n) {
          var f = Number(n.dataset.from), to = Number(n.dataset.to);
          n.textContent = Math.round(f + (to - f) * e);
        });
        if (t >= 1) clearInterval(tick);
      }, 40);
    }, 60);
    fullAnimate = false;
  }

  function paint() {
    fullWatch();
    stage.className = 'stage phase-' + S.phase.id +
      (S.phase.id === 'heaven' ? ' cinepage' + (S.heavenStep < 2 ? ' dark' : '') : '');
    var html = (views[S.phase.id] || function () { return ''; })();
    // 經文那一頁：已經飛走的鳥不要每次重畫都再飛一次
    var flown = stage.querySelectorAll('.chainrow img.bird').length;
    stage.innerHTML = html;
    if (S.phase.id === 'verse') {
      stage.querySelectorAll('.chainrow img.bird').forEach(function (b, i) {
        if (i < flown) { b.style.animation = 'none'; b.style.opacity = '0'; }
      });
    }

    var qr = document.getElementById('qr');
    if (qr && ROOM) {
      try { QR.render(qr, joinUrl(), qrScale(7), '#161A18', '#ffffff'); } catch (err) {}
    }
    fullRun();
    fitSolo();
    fitBoxes();
  }

  // 一整行不斷行的字：畫完再量，量到塞得下為止
  function fitSolo() {
    var list = stage.querySelectorAll('.saybig, .overline, .faith div, .heaven .hl, .ev .line');
    var avail = stage.clientWidth - parseFloat(getComputedStyle(stage).paddingLeft) * 2;
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      if (h.classList.contains('line')) continue;   // 事件那一句可以斷行
      h.style.fontSize = '';
      var size = parseFloat(getComputedStyle(h).fontSize), guard = 0;
      while (h.scrollWidth > avail && size > 18 && guard++ < 80) { size -= 2; h.style.fontSize = size + 'px'; }
    }
  }

  // 人多的時候：一排人縮小、兩條線排兩欄三欄。**整頁不捲動。**
  function fitBoxes() {
    var cr = stage.querySelector('.crowd');
    if (cr) {
      var z = 1;
      cr.style.setProperty('--cz', z);
      while (stage.scrollHeight > stage.clientHeight + 1 && z > 0.4) { z -= 0.05; cr.style.setProperty('--cz', z.toFixed(2)); }
    }
    var fg = stage.querySelector('.fullgrid');
    if (fg) {
      var n = S.players.length;
      var cols = n > 18 ? 3 : n > 6 ? 2 : 1;
      fg.style.setProperty('--fc', cols);
      var k = 1;
      fg.style.setProperty('--fz', k);
      while (stage.scrollHeight > stage.clientHeight + 1 && k > 0.45) { k -= 0.05; fg.style.setProperty('--fz', k.toFixed(2)); }
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

    var ctl = document.getElementById('stepctl');
    ctl.style.display = S.step ? 'inline-flex' : 'none';
    if (S.step) {
      document.getElementById('sback').disabled = !S.step.back;
      document.getElementById('sback').style.display = S.phase.id === 'full' ? 'none' : '';
      var sn = document.getElementById('snext');
      sn.textContent = S.step.label;
      sn.disabled = !S.step.next;
      document.getElementById('srestart').style.display = S.step.restart ? '' : 'none';
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
      if (cmd === 'boundRestart' && !confirm('五回合整個重跑？每個人的分數、鎖鏈、帳單都會還原。')) return;
      post(cmd);
    };
  });

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
