// 主持人大螢幕 · 第七關「釋放與自由」
//
// 十四頁。模擬器的最後一關 —— 最後是下週預告（第八週 · 幸福的教會），最後結算放在那一頁。
// 需要一步一步走的那幾頁（自由是什麼、O/X 公布）共用一組按鈕，字由伺服器給（S.step）。
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
  // 按了「我願意」的人，幸福根基馬上是 100。
  function renderPlayers() {
    var el = document.getElementById('plist');
    if (!S.players.length) {
      el.innerHTML = '<p class="muted" style="font-size:calc(13px * var(--u))">還沒有人進場。</p>';
      return;
    }
    var onOx = S.phase.id === 'ox' && !S.oxNow.revealed;
    var onFree = S.phase.id === 'free' && S.freeNow.step === 0;
    el.innerHTML = S.players.map(function (p) {
      var chips = [];
      if (onFree) chips.push('<span class="chip' + (p.acted ? ' on' : '') + '">' + (p.acted ? '已送出' : '還沒') + '</span>');
      if (onOx) chips.push('<span class="chip' + (p.acted ? ' on' : '') + '">' + (p.acted ? '已選' : '還沒') + '</span>');
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

  // 一片幸福根基的線（小小的，排好幾欄）。rows: [{ k, name, v }]；name 沒給就不掛名字
  function rootList(rows, top) {
    return '<div class="rlist' + (top ? ' fromtop' : '') + '">' + rows.map(function (r) {
      return '<div class="rl' + (r.k ? ' grow' : '') + '"' + (r.k ? ' data-k="' + esc(r.k) + '"' : '') + '>' +
        (r.name != null ? '<span class="nm">' + esc(r.name) + '</span>' : '') +
        '<span class="tr"><i data-v="' + r.v + '" style="width:' + r.v + '%"></i></span>' +
        '<b>' + r.v + '</b></div>';
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

    // 你覺得自由是什麼？ 0 作答 → 1 長條（**只有人數，不掛名字**）
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
      return '<h2>' + esc(info.title) + '</h2>' +
        '<div class="bars free">' + f.rows.map(function (r) {
          return '<div class="bar2' + (r.n ? '' : ' zero') + '">' +
            '<span class="bl">' + esc(r.t) + '</span>' +
            '<span class="bt"><i style="width:' + Math.round(r.n / f.max * 100) + '%"></i></span>' +
            '<span class="bn">' + r.n + ' 人</span>' +
          '</div>';
        }).join('') + '</div>' +
        (f.others.length ? '<div class="others">' + f.others.map(function (t) { return '<span>' + esc(t) + '</span>'; }).join('') + '</div>' : '');
    },

    // O/X：一題一題。公布之後**名字站到 O 或 X 那一邊**。
    ox: function () {
      var o = S.oxNow, info = S.oxInfo;
      var side = function (mark, cls, names) {
        return '<div class="oxside ' + cls + (o.revealed ? '' : ' waiting') + '"><div class="mark">' + mark + '</div>' +
          (o.revealed
            ? '<div class="cnt">' + names.length + ' 人</div><div class="who">' +
                names.map(function (n, i) { return '<span style="animation-delay:' + (i * 0.06) + 's">' + esc(n) + '</span>'; }).join('') + '</div>'
            : '') + '</div>';
      };
      return '<h2>' + esc(info.title) + '</h2>' +
        '<div class="oxq"><span class="as">第 ' + (o.round + 1) + ' / ' + o.total + ' 題</span>' +
          '<div class="line">' + esc(o.q) + '</div></div>' +
        '<div class="oxgrid">' + side('O', 'o', o.o) + side('X', 'x', o.x) + '</div>' +
        (o.revealed ? '' : counter(o.acted, '人已選'));
    },

    // 統計：每一題誰選 O、誰選 X（掛名字，照 O 的人數排）。**沒有步驟按鈕**，按下一頁就走。
    oxTally: function () {
      var t = S.oxTally, info = S.oxInfo;
      var who = function (names) {
        return names.length ? names.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('') : '<em>—</em>';
      };
      return '<h2>' + esc(info.tallyTitle) + '</h2>' +
        '<div class="oxtab">' +
          '<div class="oxr hd"><span></span><span class="o">O</span><span class="x">X</span></div>' +
          t.rows.map(function (r) {
            return '<div class="oxr"><span class="q">' + esc(r.q) + '</span>' +
              '<span class="names o">' + who(r.oNames) + '</span>' +
              '<span class="names x">' + who(r.xNames) + '</span></div>';
          }).join('') +
        '</div>';
    },

    story: function () {
      return StageParts.testimony({ title: S.story.title });
    },

    // 信而受洗，必得釋放 · 相信耶穌，醫治與平安。**手機上沒有按鈕。**
    faith: function () {
      return '<div class="faith">' + S.faith.map(function (t) { return '<div>' + esc(t) + '</div>'; }).join('') + '</div>';
    },

    trueFree: function () {
      var t = S.trueFree;
      // 左欄：第 3 頁全場勾最多的三項（沒人答就用固定的三項）
      var left = S.freeNow.top.length ? S.freeNow.top : t.left;
      return '<h2>' + esc(t.title) + '</h2>' +
        '<div class="goodgrid">' +
          '<div class="goodcol left"><h3>' + esc(t.leftLabel) + '</h3><ul>' +
            left.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
          '<div class="goodcol right"><h3>' + esc(t.rightLabel) + '</h3><ul>' +
            t.right.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '</div>';
    },

    // 領受經文：**跟前六關同一個畫面**（共用元件）。
    verse: function () {
      return StageParts.verse({ ref: S.verse.ref, text: S.verse.text, done: S.stats.versesReceived, total: S.stats.count });
    },

    // 這不是一個分數，是一個身分：每個人現在的幸福根基（**掛名字**，照進場順序）。
    identity: function () {
      return '<h2>' + esc(S.identity.title) + '</h2>' +
        rootList(S.players.map(function (p) { return { name: p.name, v: p.inner || 0 }; }));
    },

    // 約翰福音 1:12：**只有經文**，配第五關那張手上的心。
    invite: function () {
      return '<div class="heaven">' +
        '<img class="handheart" src="' + ART + esc(S.invite.art) + '.svg" alt="">' +
        '<div class="verse bigverse"><span class="ref">' + esc(S.invite.verse.ref) + '</span>' +
          '<blockquote>「' + esc(S.invite.verse.text) + '」</blockquote></div>' +
      '</div>';
    },

    // 你願意嗎：每個人的幸福根基（**掛名字**，從上往下排）。手機上按了「我願意」，那一條就慢慢補滿。
    // **全場都按了**（等最後一條長完）才換成天上的教會那張圖。主持人**不替任何人補**。
    willing: function () {
      var w = S.willingNow, info = S.willingInfo;
      if (celebrating) {
        return '<div class="heaven">' +
          '<img class="church" src="' + ART + 'heaven-church.svg" alt="">' +
          '<div class="hl" style="margin-top:min(calc(12px * var(--u)),1.5vh)">' + esc(info.allTitle) + '</div>' +
          '<div class="vref">' + esc(info.allSub) + '</div>' +
        '</div>';
      }
      return '<h2 class="asktitle">' + esc(info.title) + '</h2>' +
        rootList(w.lines.map(function (l) { return { k: l.k, name: l.name, v: l.v }; }), true);
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
        extra: '「這不是一個分數，是一個身分」、你想對天父說的話',
        // 第七張卡：下一週不用模擬器，不叫它入場券
        lede: '長按手機上的圖片存進相簿。這是第七張卡。',
      });
    },

    // 下週預告：最後結算（全場兩條線的平均，和開場比）＋ 第八週 · 幸福的教會。
    end: function () {
      return StageParts.nextWeek({
        kicker: S.next.kicker,
        avg: S.stats.outerAvg, avgFrom: S.stats.startAvg,
        inner: S.stats.innerAvg || null, innerFrom: S.stats.innerStartAvg,
        innerLabel: '幸福根基', fromLabel: '開場',
        week: S.next.week, lines: S.next.lines, nextLabel: S.next.nextLabel,
      });
    },
  };

  // ── 全場都按了「我願意」→ 等最後一條長完（3 秒）再換成歡呼的那張圖 ──────────
  // 翻進來的時候已經全場都按了，就直接給圖。
  var celebrating = false, celebSeenPartial = false, celebTimer = null;
  function celebWatch() {
    if (S.phase.id !== 'willing') { celebrating = false; celebSeenPartial = false; clearTimeout(celebTimer); celebTimer = null; return; }
    if (!S.willingNow.all) { celebrating = false; celebSeenPartial = true; clearTimeout(celebTimer); celebTimer = null; return; }
    if (celebrating || celebTimer) return;
    if (!celebSeenPartial) { celebrating = true; return; }
    celebTimer = setTimeout(function () { celebTimer = null; celebrating = true; paint(); }, 3000);
  }

  // ── 線慢慢補滿 ────────────────────────────────────────────────────────
  // 整頁重畫的時候，每一條（data-k）先放回上一次的寬度，再慢慢長到新的值 ——
  // 手機上按了「我願意」，大螢幕上**某一條**（不知道是誰）就慢慢補滿。
  var lastW = {};
  function growLines() {
    var bars = stage.querySelectorAll('.rl[data-k] .tr i');
    if (!bars.length) { lastW = {}; return; }
    var next = {};
    bars.forEach(function (i) {
      var k = i.parentNode.parentNode.dataset.k, v = Number(i.dataset.v);
      next[k] = v;
      if (lastW[k] != null && lastW[k] !== v) {
        var b = i.parentNode.parentNode.querySelector('b');
        i.style.transition = 'none';
        i.style.width = lastW[k] + '%';
        if (b) b.textContent = lastW[k];
        void i.offsetWidth;
        i.style.transition = '';
        i.classList.add('growing');
        i.style.width = v + '%';
        // 數字跟著跑（setInterval：分頁在背景時 requestAnimationFrame 不會跑）
        var from = lastW[k], t0 = Date.now(), DUR = 2600;
        var tick = setInterval(function () {
          var t = Math.min(1, (Date.now() - t0) / DUR), e = 1 - Math.pow(1 - t, 3);
          if (b) b.textContent = Math.round(from + (v - from) * e);
          if (t >= 1) clearInterval(tick);
        }, 40);
      }
    });
    lastW = next;
  }

  function paint() {
    celebWatch();
    stage.className = 'stage phase-' + S.phase.id + (S.phase.id === 'invite' || celebrating ? ' cinepage' : '');
    var html = (views[S.phase.id] || function () { return ''; })();
    stage.innerHTML = html;

    var qr = document.getElementById('qr');
    if (qr && ROOM) {
      try { QR.render(qr, joinUrl(), qrScale(7), '#161A18', '#ffffff'); } catch (err) {}
    }
    growLines();
    fitSolo();
    fitBoxes();
  }

  // 一整行不斷行的字：畫完再量，量到塞得下為止
  function fitSolo() {
    var list = stage.querySelectorAll('.faith div, .heaven .hl');
    var avail = stage.clientWidth - parseFloat(getComputedStyle(stage).paddingLeft) * 2;
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      h.style.fontSize = '';
      var size = parseFloat(getComputedStyle(h).fontSize), guard = 0;
      while (h.scrollWidth > avail && size > 18 && guard++ < 80) { size -= 2; h.style.fontSize = size + 'px'; }
    }
  }

  // 人多的時候：O/X 名字縮、幸福根基那一片排好幾欄再縮。**整頁不捲動。**
  function fitBoxes() {
    var sides = stage.querySelectorAll('.oxside');
    if (sides.length) {
      var oz = 1, tooTall = function () {
        return [].some.call(sides, function (sd) { return sd.scrollHeight > sd.clientHeight + 1; });
      };
      sides.forEach(function (sd) { var w = sd.querySelector('.who'); if (w) w.style.setProperty('--oz', 1); });
      while (tooTall() && oz > 0.4) {
        oz -= 0.05;
        sides.forEach(function (sd) { var w = sd.querySelector('.who'); if (w) w.style.setProperty('--oz', oz.toFixed(2)); });
      }
    }
    // 統計表：名字多的時候名字一起縮
    var tb = stage.querySelector('.oxtab');
    if (tb) {
      // 只縮名字，題目的字不縮（電視上題目要看得清楚）
      var nz = 1;
      tb.style.setProperty('--nz', nz);
      while (stage.scrollHeight > stage.clientHeight + 1 && nz > 0.6) { nz -= 0.05; tb.style.setProperty('--nz', nz.toFixed(2)); }
      // 名字縮到底還塞不下（人很多），整張表再一起縮
      var tz = 1;
      tb.style.setProperty('--tz', tz);
      while (stage.scrollHeight > stage.clientHeight + 1 && tz > 0.5) { tz -= 0.05; tb.style.setProperty('--tz', tz.toFixed(2)); }
    }
    var rl = stage.querySelector('.rlist');
    if (rl) {
      var n = rl.children.length;
      rl.style.setProperty('--rc', n > 16 ? 3 : n > 6 ? 2 : 1);
      var k = 1;
      rl.style.setProperty('--rz', k);
      while (stage.scrollHeight > stage.clientHeight + 1 && k > 0.45) { k -= 0.05; rl.style.setProperty('--rz', k.toFixed(2)); }
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
      var sn = document.getElementById('snext');
      sn.textContent = S.step.label;
      sn.disabled = !S.step.next;
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
