// 主持人大螢幕 · 第二關「真相大白」
(function () {
  'use strict';
  var WEEK = 2;
  var JOIN_PATH = '/j';   // Worker 會把它導到這一關的玩家頁
  var S = null;
  var stage = document.getElementById('stage');

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var conn = null;
  var ROOM = '';
  function post(cmd, extra) { if (conn) conn.host(cmd, extra); }
  function joinUrl() { return location.origin + JOIN_PATH + '?w=2&room=' + ROOM; }
  function pct(r) { return '−' + Math.round(r * 100) + '%'; }

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
            '<span class="val">' + (p.outer == null ? '—' : p.outer) + '</span>' +
          '</div>' +
          // 上面是幸福指數（今晚會一直往下掉），下面是幸福根基（今晚才有名字）
          '<div class="bars">' +
            '<span class="bar" title="幸福指數"><i style="width:' + outer + '%;background:var(--vol)"></i></span>' +
            '<span class="bar" title="' + (S.named ? '幸福根基' : '？？？') + '"><i style="width:' + (p.inner || 0) + '%;background:var(--root-c)"></i></span>' +
          '</div>' +
          '<div class="meta">' + (S.named ? '根基' : '？？？') + ' <b style="color:var(--root-c)">' + (p.inner || 0) + '</b>' +
            '<span class="adj">' +
              '<button data-adj="' + p.pid + '" data-d="-5">−</button>' +
              '<button data-adj="' + p.pid + '" data-d="5">＋</button>' +
            '</span>' +
          '</div>' +
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
      return '<span class="kicker">Join</span><h2>掃碼進場</h2>' +
        '<div class="qrbox">' +
          '<canvas id="qr"></canvas>' +
          '<div>' +
          '<p class="muted mono" style="font-size:calc(11px * var(--u));margin:0">房號</p>' +
          '<div class="roomcode">' + esc(ROOM || '····') + '</div>' +
          '<p class="muted" style="margin:14px 0 6px">掃碼，或到這個網址輸入房號：</p>' +
          '<div class="url">' + esc(location.host + JOIN_PATH) + '</div></div>' +
        '</div>' +
        '<div class="names">' + (S.players.length
          ? S.players.map(function (p) { return '<span>' + esc(p.name) + '</span>'; }).join('')
          : '<span class="muted">等人進來…</span>') + '</div>' +
        '<div class="note"><b>順口一問</b>　「上禮拜抽到金融風暴那位——這禮拜還好嗎？」系統不會提醒你，這要你自己記得。</div>';
    },

    reconnect: function () {
      var s = S.stats;
      return '<span class="kicker">Reconnect</span><h2>打開上禮拜的卡片</h2>' +
        '<p class="lede">「打開你上禮拜的卡片，輸入上面的<b>幸福指數</b>。然後告訴我這是你第幾次來。」</p>' +
        '<div class="big" style="margin-top:24px">' + s.reconnected + ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + s.count + ' 已接上</span></div>' +
        (s.newcomers ? '<p class="mono" style="margin-top:10px;color:var(--root-c)">其中 ' + s.newcomers + ' 位是新朋友或忘記帶卡片</p>' : '') +
        '<div class="note"><b>兩種都合法，不用解釋、不用道歉</b>　忘記帶卡片、上週沒來、第一次來，就按現在的感覺填一個。手機上那個按鈕他自己找得到。</div>';
    },

    holdings: function () {
      var s = S.stats;
      return '<span class="kicker">Reconnect</span><h2>上禮拜你買了什麼</h2>' +
        '<p class="lede">勾選上禮拜標到的東西，再把沒花掉的點數拉出來。等一下的折舊要算它。</p>' +
        '<div class="big" style="margin-top:24px">' + s.holdingsDone + ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + s.count + ' 已填</span></div>' +
        '<div class="note"><b>新朋友走同一頁</b>　他沒有上禮拜，就請他按直覺把 100 點分配掉——這樣他也玩得到接下來的折舊。</div>';
    },

    q20: function () {
      return '<span class="kicker">Interaction 1</span><h2>' + esc(S.q20.question) + '</h2>' +
        '<p class="lede">四個選項，憑直覺。這一題的答案要留著——這關結束前會重播一次。</p>' +
        '<div class="big" style="margin-top:24px">' + S.stats.answeredQ20 + ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + S.stats.count + ' 已作答</span></div>';
    },

    q20_result: function () {
      return '<span class="kicker">Interaction 1</span><h2>全場是這樣想的</h2>' +
        optionBars() +
        '<div class="note"><b>記住「一定在」有幾成</b>　十五分鐘後你要把這個數字再講一次。</div>';
    },

    ff_intro: function () {
      return '<span class="kicker">Main game</span><h2>時間快轉三十年</h2>' +
        '<p class="lede">上禮拜你們花光籌碼買下的東西，今天要驗貨。一項一項來。</p>' +
        progressStrip() +
        '<div class="note"><b>逐項揭曉，不要一次開完</b>　一次開完是一張圖表，逐項開是一場戲。用底下的「揭曉下一項」自己控節奏。</div>';
    },

    depreciate: function () {
      var r = S.reveal;
      if (r.idx < 0) {
        return '<span class="kicker">Interaction 2</span><h2>三十年後</h2>' +
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
        progressStrip() +
        (r.idx === Math.floor(r.total / 2)
          ? '<div class="note warn"><b>停一下，問這一句</b>　「現在有人想改上禮拜的下注嗎？」——然後告訴他們：<b>不能改。這就是時間。</b></div>'
          : '') +
        (r.done ? '<div class="note"><b>十項開完了</b>　翻下一頁念經文上半句。「？」還沒開。</div>' : '');
    },

    verse_half: function () {
      var s = S.stats;
      return '<div class="verse half"><span class="ref">' + esc(S.verse.ref) + ' · 上半句</span>' +
        '<blockquote>「' + esc(S.verse.first) + '」</blockquote></div>' +
        '<p class="lede" style="margin-top:26px">把三個動詞指回他們剛剛看到的東西：你的工作被<b>偷</b>走了、你的身體被<b>殺</b>了一大半、你的關係沒有消失但<b>壞</b>了形狀。</p>' +
        (s.hardestHit ? '<p class="mono" style="margin-top:14px;color:var(--vol);font-size:calc(20px * var(--u))">掉最多的是 ' + esc(s.hardestHit.name) + '，−' + s.hardestHit.drop + ' 分</p>' : '') +
        '<div class="note warn"><b>不要說「撒但拿走了你的健康」</b>　在場只要有一個人的孩子出過事、有一個人剛拿到報告，這句話會毀掉整關。' +
        '約 10:1、10:8 說得很清楚，那個賊是<b>不從門進來、假冒牧人的</b>。安全的講法是：<b>「賊不是搶走你的東西。賊是先說服你，這些東西就是你的命。」</b>牠偷的是承諾，不是財產。</div>';
    },

    mystery: function () {
      var owners = S.stats.mysteryOwners;
      return '<span class="kicker">The reveal</span>' +
        '<div class="qmark">？</div>' +
        '<div class="eternal"><div class="nm">' + esc(S.mystery.name) + '</div>' +
          '<div class="rate">折舊率 0%</div>' +
          '<p class="lede" style="margin:14px auto 0;text-align:center">' + esc(S.mystery.why) + '</p></div>' +
        (owners.length
          ? '<div class="wantlist" style="justify-content:center">' + owners.map(function (o) { return '<span>' + esc(o.name) + ' 上禮拜標到了</span>'; }).join('') + '</div>' +
            '<div class="note"><b>問他這一句</b>　「你上禮拜為什麼買它？」他大概率會說「就好奇」「隨便押的」。<b>那句話本身就很好。</b></div>'
          : '<div class="note"><b>今天沒有人標到 —— 這句話更有力</b>　「今天沒有人買它。而三十年後，它是唯一還在的。」</div>') +
        '<div class="note warn"><b>畫面先停在問號上久一點再翻</b>　這是整關的最高點，不要趕。</div>';
    },

    free: function () {
      var w = S.stats.wants;
      return '<span class="kicker">Grace</span>' +
        '<div class="freeline">你上禮拜出價四十點才搶到它。<br><span style="color:var(--root-c)">今天，它不用錢。誰要都可以拿。</span></div>' +
        '<div class="verse half second" style="margin-top:calc(26px * var(--u))"><span class="ref">' + esc(S.verse.ref) + ' · 下半句</span>' +
          '<blockquote>「' + esc(S.verse.second) + '」</blockquote></div>' +
        '<div class="wantlist">' + (w.length
          ? w.map(function (n) { return '<span>' + esc(n) + '</span>'; }).join('')
          : '<span class="muted" style="background:none;border-color:var(--edge-soft);color:var(--ink-3);box-shadow:none">還沒有人按</span>') + '</div>' +
        '<p class="mono muted" style="margin-top:12px">' + w.length + ' / ' + S.stats.count + ' 按了「我要」</p>' +
        '<div class="note warn"><b>不要催</b>　不按的人不扣分、不點名、不追問。有人今天還沒準備好，那完全沒關係——後面還有五關。<b>任何形式的施壓都會毀掉這個時刻。</b></div>' +
        '<div class="note"><b>這一關先只做一個標記就好</b>　不要在這裡多說幾句，留給第三關。</div>';
    },

    naming: function () {
      return '<span class="kicker">Mechanic</span><h2>那條線有了名字</h2>' +
        '<div class="eternal" style="text-align:left"><div class="nm" style="font-size:calc(72px * var(--u))">幸福根基</div></div>' +
        '<p class="lede" style="font-size:calc(22px * var(--u))">「上禮拜大家都在掉分的時候，有一條線是往上的。今天它有名字了。」</p>' +
        '<div class="note"><b>這不是解鎖，是正名</b>　那條線從第一關就在長。所以講的是「它有名字了」，不是「你們解鎖了新東西」。</div>' +
        '<div class="note"><b>規則兩句話講完就好</b>　「這條線不會被任何事件扣掉。」「而且它不是比賽——它從你來的第一天開始長。」剩下的五週他們自己會發現怎麼讓它長。</div>';
    },

    message: function () {
      return '<span class="kicker">Host</span><h2>你的信息與見證</h2>' +
        '<p class="lede">前面十五分鐘已經把地基打好了。你不需要再說服任何人「地上的東西會壞」——他們剛剛親眼看著自己的數字掉下來。</p>' +
        '<div class="note"><b>建議的切入</b>　不要從「所以人生是虛空的」開始。從<b>「我也買錯過」</b>開始：講一個你曾經把很多點數押在某樣東西上、後來發現它折舊了的經驗。</div>' +
        '<div class="note warn"><b>不要把「虛空」講成「你的人生沒有意義」</b>　要講成「你一直在找的那個東西，不在這些裡面」。前者讓人防衛，後者讓人想聽下去。</div>';
    },

    verse: function () {
      return '<div class="verse"><span class="ref">' + esc(S.verse.ref) + '</span>' +
        '<blockquote>「' + esc(S.verse.text) + '」</blockquote></div>' +
        '<p class="mono muted" style="margin-top:20px">已領受 ' + S.stats.versesReceived + ' / ' + S.stats.count + '</p>' +
        '<div class="note"><b>這一格讓每個人的幸福根基 +10</b>　包含剛剛掉最多分的那個人。<b>這個對比要看得見。</b></div>' +
        '<div style="margin-top:calc(26px * var(--u))"><span class="kicker">十五分鐘前，你們是這樣想的</span>' + optionBars() + '</div>';
    },

    burden: function () {
      var shared = S.stats.sharedBurdens;
      return '<span class="kicker">Interaction 4</span><h2>禱告</h2>' +
        '<p class="lede">「今天有哪一項的折舊，讓你心裡動了一下？」一句話，只有本人看得到。可以略過。</p>' +
        '<div class="big" style="margin-top:20px">' + S.stats.burdens + ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + S.stats.count + ' 已填寫</span></div>' +
        '<div class="note"><b>預設完全不公開</b>　主畫面只顯示「已填寫」。除非本人按下「我願意分享」。</div>' +
        (shared.length
          ? '<div class="hitcards">' + shared.map(function (b) {
              return '<div class="hitcard" style="border-left-color:var(--root-c)">' +
                '<p style="font-size:calc(19px * var(--u));font-weight:700">「' + esc(b.text) + '」</p>' +
                '<div class="nm">' + esc(b.name) + ' · 願意分享</div></div>';
            }).join('') + '</div>'
          : '');
    },

    card: function () {
      return '<span class="kicker">Take-home</span><h2>把卡片存進相簿</h2>' +
        '<p class="lede">第二張卡。散會前每個人手機裡都要有——直接問一句「存好的舉手」。</p>' +
        '<div class="big" style="margin-top:20px">' + S.stats.cardsDone + ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + S.stats.count + ' 已生成</span></div>' +
        '<div class="note"><b>禱告完，幸福根基再 +5</b>　卡片一生成就加。全勤的人今晚結束時停在 30。</div>';
    },

    end: function () {
      var s = S.stats;
      return '<span class="kicker">Carry forward</span><h2>第二關結束</h2>' +
        '<div class="cols3">' +
          '<div class="col3"><h3>誰按了「我要」</h3><div class="who" style="font-size:calc(20px * var(--u))">' +
            (s.wants.length ? esc(s.wants.join('、')) : '（沒有人，這完全沒關係）') +
            '</div><div class="say">第三關認識耶穌時，這些人已經舉過一次手了</div></div>' +
          '<div class="col3"><h3>掉最多的人</h3><div class="who">' + (s.hardestHit ? esc(s.hardestHit.name) : '—') + '</div>' +
            (s.hardestHit ? '<p class="mono" style="margin:8px 0 0;color:var(--vol)">−' + s.hardestHit.drop + ' 分</p>' : '') +
            '<div class="say">下禮拜開場先看他一眼</div></div>' +
          '<div class="col3"><h3>全場平均</h3><div class="who">' + (s.outerAvg == null ? '—' : s.outerAvg) + '</div>' +
            '<p class="mono" style="margin:8px 0 0;color:var(--root-c)">根基 ' + s.innerAvg + '</p>' +
            '<div class="say">兩條線第一次往反方向走</div></div>' +
        '</div>' +
        '<div class="note"><b>收尾那句鉤子</b>　「經文說『我來了』。那個『我』是誰——下禮拜。」</div>';
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

    var e = S.stats.energy;
    document.getElementById('energybar').style.width = e + '%';
    document.getElementById('energyval').textContent = S.stats.outerAvg == null ? '—' : e + '%';
    document.getElementById('hint').textContent = S.phase.title;

    renderPlayers();
    stage.innerHTML = (views[S.phase.id] || function () { return ''; })();

    // 每次回到入場頁都要重畫：stage.innerHTML 一被改寫，canvas 就是全新的空白元素
    var qr = document.getElementById('qr');
    if (qr && ROOM) {
      try { QR.render(qr, joinUrl(), 8, '#161A18', '#ffffff'); } catch (err) {}
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

  document.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
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
