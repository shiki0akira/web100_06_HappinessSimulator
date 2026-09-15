// 主持人大螢幕 · 第五關「當上帝來敲門」
(function () {
  'use strict';
  var WEEK = 5;
  // 大螢幕上印給人手動打字的網址。越短越好打 —— 手機鍵盤打 ? 和 = 很痛苦。
  var JOIN_PATH = '/5';
  var NOTES_PATH = '/h5';   // 主持人備忘錄，掃不到的時候也打得出來
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

  // +3／−2／±0。減號用全形那一條，電視上才看得出來。
  function fmt(d) { return d > 0 ? '+' + d : d < 0 ? '−' + Math.abs(d) : '±0'; }
  function tone(d) { return d > 0 ? 'up' : d < 0 ? 'down' : 'zero'; }


  // ── 敲門聲 ───────────────────────────────────────────────────────────
  // 大螢幕自己出聲（電視喇叭），手機不出聲 —— 十幾支手機一起敲會變成一團噪音。
  // **輕、慢、固定間隔。** 不准越敲越快、越敲越大聲。
  var audio = null;
  function unlock() {
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) { audio = null; }
  }
  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);

  function thud(at) {
    var len = Math.floor(audio.sampleRate * 0.14);
    var buf = audio.createBuffer(1, len, audio.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    var src = audio.createBufferSource();
    src.buffer = buf;
    var lp = audio.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    var g = audio.createGain();
    g.gain.value = 0.9;
    src.connect(lp); lp.connect(g); g.connect(audio.destination);
    src.start(at);
  }
  // 叩、叩。
  function knock() {
    if (!audio || audio.state !== 'running') return;
    var t = audio.currentTime + 0.02;
    thud(t);
    thud(t + 0.28);
  }

  var lastKnock = '';
  var eggTimer = null;
  function sound() {
    // 人生模擬器：每換一個人來敲門，敲一次（兩下）
    var k = S.phase.id === 'knocks' && !S.knockNow.revealed ? 'k' + S.knockNow.idx : '';
    if (k && k !== lastKnock) knock();
    lastKnock = k;
    // 彩蛋：全場開門之前，隔一段固定的時間輕輕敲一次
    var eggOn = S.phase.id === 'egg' && !S.eggNow.done;
    if (eggOn && !eggTimer) { knock(); eggTimer = setInterval(knock, 4200); }
    if (!eggOn && eggTimer) { clearInterval(eggTimer); eggTimer = null; }
  }

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
    var onKnock = S.phase.id === 'knocks' && !S.knockNow.revealed;

    el.innerHTML = S.players.map(function (p) {
      var outer = p.outer == null ? 0 : p.outer;
      // **不掛「新朋友」標籤**，要知道誰第一次來看主持人備忘錄。
      // **彩蛋那一頁不掛「已開門／還沒開」** —— 大螢幕不准顯示是誰還沒開。
      var chips = [];
      if (onKnock) chips.push('<span class="chip' + (p.knocked ? ' on' : '') + '">' + (p.knocked ? '已選' : '還沒選') + '</span>');
      if (S.phase.id === 'who') chips.push('<span class="chip' + (p.godSent ? ' on' : '') + '">' + (p.godSent ? '已送出' : '還沒送') + '</span>');
      if (p.prayed) chips.push('<span class="chip">已寫下</span>');
      if (p.receivedVerse) chips.push('<span class="chip on">已領受</span>');
      return '' +
        '<div class="prow">' +
          '<div class="nm">' + esc(p.name) + chips.join('') + '</div>' +
          gauge('幸福指數', p.outer == null ? '—' : p.outer, outer, 'var(--vol)') +
          gauge('幸福根基', p.inner ? p.inner : '—', p.inner || 0, 'var(--root-c)') +
        '</div>';
    }).join('');
  }

  // ── 元件 ─────────────────────────────────────────────────────────────
  function counter(n, unit) {
    var all = S.stats.count > 0 && n >= S.stats.count;
    return '<div class="qcount' + (all ? ' all' : '') + '">' + n + ' / ' + S.stats.count + ' ' + unit +
      (all ? '　<b>大家都好了</b>' : '') + '</div>';
  }

  function listBoard(title, items) {
    return '<h2>' + esc(title) + '</h2>' +
      '<div class="howlist">' + items.map(function (t, i) {
        return '<div class="how"><span class="n">' + (i + 1) + '</span><b>' + esc(t) + '</b></div>';
      }).join('') + '</div>';
  }

  // ── 人生模擬器 ─────────────────────────────────────────────────────────
  // 上面是貓眼看出去的那個人，下面是三個選項。
  // **大螢幕上只有人數，沒有名字** —— 第 5 天那一次對某些人是真的。
  function knockBoard() {
    var k = S.knockNow;
    return '<div class="callhd">' +
        '<h2>人生模擬器 · 有人來敲門</h2>' +
      '</div>' +
      '<div class="kscene">' +
        '<div class="peep"><img src="/happiness/shared/art/visitor-' + esc(k.art) + '.svg" alt=""></div>' +
        '<div>' +
          '<div class="kcal">第 ' + k.day + ' 天</div>' +
          '<div class="kwho">' + esc(k.who) + '</div>' +
          '<div class="ksays">「' + esc(k.says) + '」</div>' +
        '</div>' +
      '</div>' +
      '<div class="kcols">' + k.cols.map(function (c) {
        return '<div class="kc' + (k.revealed ? ' done' : '') + '">' +
          '<div class="kl"><b>' + esc(c.label) + '</b>' +
            (k.revealed ? '<span class="kn">' + c.n + ' 人</span>' : '') + '</div>' +
          (k.revealed
            ? '<span class="kd ' + tone(c.d) + '">' + fmt(c.d) + '</span>' +
              '<div class="kt">' + esc(c.t) + '</div>'
            : '') +
        '</div>';
      }).join('') + '</div>' +
      (k.revealed ? '' : '<div class="kfoot">' + counter(S.stats.knockPicked, '人已選') + '</div>');
  }

  // ── 這五天，誰開了門 ─────────────────────────────────────────────────
  // 跟第四關的統計圖一樣：誰選了什麼。五列（每一天）× 三格（開門／隔著門問／假裝不在家）。
  // 還沒公布的那一次整列淡掉。**主持人只念數字，不點名追問。**
  function monthBoard() {
    var m = S.monthNow;
    return '<div class="callhd"><h2>' + esc(S.month.title) + '</h2>' +
        '<span class="rn">' + esc(S.month.end) + '</span></div>' +
      '<div class="tally">' +
        '<div class="trow thead"><span></span>' + S.choices.map(function (c) {
          return '<b>' + esc(c) + '</b>';
        }).join('') + '</div>' +
        m.rows.map(function (r) {
          return '<div class="trow' + (r.shown ? '' : ' dim') + '">' +
            '<span class="tday"><img src="/happiness/shared/art/visitor-' + esc(r.art) + '.svg" alt="">' +
              '<span><i>第 ' + r.day + ' 天</i>' + esc(r.who) + '</span></span>' +
            r.cols.map(function (c) {
              return '<span class="tcell' + (c.n ? '' : ' zero') + '"><em>' + c.n + ' 人</em>' +
                '<small>' + c.names.map(esc).join('・') + '</small></span>';
            }).join('') +
          '</div>';
        }).join('') +
      '</div>';
  }

  // ── 彩蛋 ─────────────────────────────────────────────────────────────
  // **不在模擬裡。** 日曆收掉，換成一行大字「現在！」。
  // 全場都開了門才翻過去 —— 大螢幕只顯示「幾人已開門」，不顯示是誰還沒開，不倒數。
  function eggBoard() {
    var e = S.eggNow;
    if (e.done) {
      return '<div class="eggwrap">' +
        '<img class="jesus" src="/happiness/shared/art/door-open.svg" alt="">' +
        '<div class="eggreveal">「' + esc(S.egg.opened) + '」</div>' +
      '</div>';
    }
    return '<div class="eggwrap">' +
      '<div class="eggclock">' + esc(S.egg.now) + '</div>' +
      '<img src="/happiness/shared/art/door-knock.svg" alt="">' +
      '<div class="egglead">' + esc(S.egg.lead) + '</div>' +
      '<div class="eggsays">「' + esc(S.egg.says) + '」</div>' +
      '<div class="eggcount">' + e.opened + ' / ' + e.total + ' 人已開門</div>' +
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

    // 教會投影片第 2 頁。副標不要念出來解釋 —— 它是整關的答案。
    intro: function () {
      return '<div class="teaser">' +
        '<span class="kicker">今天的主題</span>' +
        '<h2 class="big-title">' + esc(S.intro.title) + '</h2>' +
        '<div class="teaseart"><img src="/happiness/shared/art/door-knock.svg" alt=""></div>' +
        '<p class="teaseline">' + esc(S.intro.line) + '</p>' +
      '</div>';
    },

    knocks: function () { return knockBoard(); },

    month: function () { return monthBoard(); },

    egg: function () { return eggBoard(); },

    // 你覺得上帝是什麼。**只顯示幾人已送出**，誰選了什麼下一頁才公布。九格排三欄三列。
    who: function () {
      return '<h2>' + esc(S.who.title) + '</h2>' +
        '<div class="godsub">' + esc(S.who.sub) + '</div>' +
        '<div class="godgrid">' + S.who.options.map(function (o, i) {
          return '<div class="god' + (i === S.who.otherIdx ? ' other' : '') + '">' + esc(o) + '</div>';
        }).join('') + '</div>' +
        '<div class="kfoot">' + counter(S.stats.godPicked, '人已送出') + '</div>';
    },

    // 我們心中的上帝。跟第四關的統計圖一樣：長條、人數、名字。**主持人只念數字。**
    // 「其他」永遠排最後，印的是他們自己寫的字。
    // 手冊的三點不上牆 —— 那是主持人接下去要講的（備忘錄裡有）。
    whoTally: function () {
      var t = S.whoTally;
      return '<h2>' + esc(S.who.tallyTitle) + '</h2>' +
        '<div class="godbars">' + t.rows.map(function (r) {
          var tail = r.other && r.texts.length
            ? r.texts.map(function (x) { return '<span class="ot">' + esc(x.text) + '<i>' + esc(x.name) + '</i></span>'; }).join('')
            : r.names.map(esc).join('・');
          return '<div class="gbar' + (r.n ? '' : ' zero') + (r.other ? ' other' : '') + '">' +
            '<span class="gl">' + esc(r.label) + '</span>' +
            '<span class="gt"><i style="width:' + Math.round(r.n / t.max * 100) + '%"></i></span>' +
            '<span class="gn">' + r.n + ' 人</span>' +
            '<span class="gw">' + tail + '</span>' +
          '</div>';
        }).join('') + '</div>';
    },

    seek: function () { return listBoard(S.seek.title, S.seek.items); },

    verse: function () {
      return StageParts.verse({
        ref: S.verse.ref, text: S.verse.text,
        done: S.stats.versesReceived, total: S.stats.count,
      });
    },

    testimony: function () {
      return StageParts.testimony();
    },

    // 這一關的祝福禱告有指定題目。**完全不上牆** —— 這裡只有「幾人已寫下」。
    bless: function () {
      return StageParts.prayer({
        lede: '「' + S.bless.ask + '＿＿」。寫一個人就好 —— 只有你自己看得到。',
        done: S.stats.blessed, total: S.stats.count,
      });
    },

    card: function () {
      return StageParts.keepsake({
        done: S.stats.cardsDone, total: S.stats.count,
        extra: '你想祝福的那個人',
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
        week: '十字架的勝利',
        lines: [
          '今天幸福指數被這五天推來推去。最後那一次敲門，一分都沒算 —— 但你手上多了一樣東西。',
          '他要來敲這扇門，付了一個代價。下一關 —— 十字架的勝利。',
          '你寫的那個人，這禮拜把祝福帶給他。',
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

    // 每一頁該出現哪幾顆控制鈕。**現場不要靠鍵盤。**
    var show = function (id, on) {
      var el = document.getElementById(id);
      if (el) el.style.display = on ? 'inline-flex' : 'none';
    };
    show('knockctl', S.phase.id === 'knocks');
    show('eggctl', S.phase.id === 'egg');

    if (S.phase.id === 'knocks') {
      // 一顆按鈕按到底：還沒公布就是「公布結果」，公布過了才變「下一次敲門」。
      var k = S.knockNow;
      var last = k.idx >= k.total - 1;
      document.getElementById('kprev').disabled = k.idx <= 0;
      var fn = document.getElementById('kstep');
      fn.textContent = !k.revealed
        ? '公布結果（' + (k.idx + 1) + '/' + k.total + '）'
        : (last ? '都公布了，按下一頁' : '下一次敲門 →（' + (k.idx + 2) + '/' + k.total + '）');
      fn.disabled = k.revealed && last;
    }
    if (S.phase.id === 'egg') {
      var e = S.eggNow;
      var on = document.getElementById('eggnow');
      on.textContent = e.done ? '已經翻過去了' : '全場開門（' + e.opened + '/' + e.total + ' 已開）';
      on.disabled = e.done;
    }
    renderPlayers();
    paint();
    sound();
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
      if (cmd === 'knockRestart' && !confirm('人生模擬器整個重跑？每個人的幸福指數會還原到第一次公布之前。')) return;
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
    // 這一關的每一個動作都有自己的按鈕（控制列和備忘錄上各一份）—— 鍵盤只留翻頁。
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
