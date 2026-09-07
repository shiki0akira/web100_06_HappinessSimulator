// 主持人大螢幕
(function () {
  'use strict';
  var WEEK = 1;
  // 大螢幕上印給人手動打字的網址。越短越好打。
  var JOIN_PATH = '/1';
  var NOTES_PATH = '/h1';   // 主持人備忘錄，掃不到的時候也打得出來
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

  // 側欄的兩條槽。主持人要一眼看出哪一條是什麼，所以把名字寫在旁邊 ——
  // 名字後面那個數字就不用再寫一次了。
  function gauge(label, value, pct, color) {
    return '<div class="gauge">' +
        '<span>' + label + '</span>' +
        '<b style="color:' + color + '">' + value + '</b>' +
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
    // 作答中側欄也不能先寫出分數 —— 大螢幕不長分布、旁邊卻已經掛著 79，
    // 一樣是定錨。這一頁只讓主持人看到誰填完了，數字等翻到下一頁才回來。
    var isAnswering = S.phase.id === 'warmup' || S.phase.id === 'selfscore';
    var hideScore = S.phase.id === 'selfscore';
    el.innerHTML = S.players.map(function (p) {
      var outer = (hideScore || p.outer == null) ? 0 : p.outer;
      var chips = [];
      if (isAnswering) {
        var done = S.phase.id === 'warmup' ? p.warmup !== null : p.outer !== null;
        chips.push('<span class="chip' + (done ? ' on' : '') + '">' + (done ? '已作答' : '還沒填') + '</span>');
      }
      if (p.won.length && S.pointsInPlay) chips.push('<span class="chip">標到 ' + p.won.length + ' 樣</span>');
      if (p.cardFlipped) chips.push('<span class="chip' + (p.cardKind === 'hit' ? ' on' : '') + '">' + (p.cardKind === 'hit' ? '重擊' : '已抽') + '</span>');
      if (p.metoo) chips.push('<span class="chip on">我遇過</span>');
      if (p.hasBurden) chips.push('<span class="chip">已填寫</span>');
      if (p.receivedVerse) chips.push('<span class="chip on">已領受</span>');
      // 點數等拍賣會開始才顯示；？？？ 的數字等它真的開始長才出現 ——
      // 憑空冒出來比一直掛 0 有戲
      // 暗標進行中不顯示點數 —— 那是暗標，誰手上還有多少籌碼不該掛在牆上。
      // 開標結束、進到結算頁才又看得到。
      var meta = [];
      if (S.pointsInPlay && S.phase.id !== 'auction') meta.push('剩 <b>' + p.points + '</b> 點');
      return '' +
        '<div class="prow">' +
          '<div class="nm">' + esc(p.name) + '</div>' +
          // 上面是幸福指數，下面那條第一關還沒有名字。它有數字、它會動，
          // 但畫面上只有三個問號 —— 有人問就說「下一關」。
          gauge('幸福指數', (hideScore || p.outer == null) ? '—' : p.outer, outer, 'var(--vol)') +
          gauge('？？？', p.inner || 0, p.inner || 0, 'var(--root-c)') +
          (meta.length ? '<div class="meta">' + meta.join('') + '</div>' : '') +
          (chips.length ? '<div class="meta" style="margin-top:4px;flex-wrap:wrap">' + chips.join('') + '</div>' : '') +
        '</div>';
    }).join('');
  }

  // ── 元件 ─────────────────────────────────────────────────────────────
  // 長條的高度用絕對值算。欄位是 flex 排的，沒有固定高度可以量，
  // 百分比在這裡永遠解不出來 —— 之前每一根都只剩下最低的那一條線。
  var HIST_H = 168;   // 最高那一根幾 px（再乘上 --u）
  function histogram(dist, accent) {
    var max = Math.max.apply(null, dist.concat([1]));
    return '<div class="hist">' + dist.map(function (n, i) {
      return '<div class="col">' +
        '<em>' + (n || '') + '</em>' +
        '<i style="height:calc(' + (Math.round(n / max * HIST_H * 10) / 10) + 'px * var(--u));background:' +
          (accent || 'var(--vol)') + '"></i>' +
        '<b>' + (i * 10) + '</b>' +
      '</div>';
    }).join('') + '</div>';
  }

  // 作答中的計數。分布不在這裡長 —— 先看到別人的答案會互相定錨，
  // 而且主持人少了「翻頁」這個把注意力收回來的動作。
  function answering(n) {
    var all = S.stats.count > 0 && n >= S.stats.count;
    return '<div class="big" style="margin-top:24px">' + n +
        ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + S.stats.count + ' 人已作答</span></div>' +
      (all ? '<div class="note" style="border-left-color:var(--root-c);color:var(--ink)">' +
        '<b>大家都作答完了</b>　按「下一頁」看結果。</div>' : '');
  }

  // 結果頁的逐筆作答。側欄本來就看得到每個人的數字，這裡只是攤在大螢幕上一起看。
  function answerList(pairs) {
    if (!pairs.length) return '';
    return '<span class="kicker" style="margin-top:26px">每個人填的</span>' +
      '<div class="names">' + pairs
        .slice()
        .sort(function (a, b) { return b.v - a.v; })
        .map(function (x) {
          return '<span>' + esc(x.name) + ' <b class="mono" style="color:var(--vol);margin-left:6px">' + x.v + '</b></span>';
        }).join('') + '</div>';
  }

  function answersOf(key) {
    return S.players.filter(function (p) { return p[key] !== null && p[key] !== undefined; })
      .map(function (p) { return { name: p.name, v: p[key] }; });
  }

  // 每一樣標的有自己的插圖，檔名就是它的 id。圖畫在 tools/pixel-art.mjs。
  function lotArt(lot) {
    if (!lot || lot.id == null) return '';   // 試拍品的 id 是 0，別被 falsy 吃掉
    return '<img class="lotart" src="/happiness/w1/art/lot-' + lot.id + '.svg" alt="">';
  }

  // 結算頁的完整清單：每個人買了什麼、剩多少。
  // 三張卡講的是三種策略，這一份是給大家找自己用的。
  function buyList() {
    if (!S.players.length) return '';
    return '<span class="kicker" style="margin-top:26px">每個人買了什麼</span>' +
      '<div class="buylist">' + S.players.map(function (p) {
        return '<div class="buyrow">' +
          '<span class="nm">' + esc(p.name) + '</span>' +
          '<span class="got">' + (p.won.length
            ? p.won.map(function (w) {
                return '<span class="lot">' + esc(w.name) + ' <b>' + w.price + '</b></span>';
              }).join('')
            : '<span class="none">什麼都沒標到</span>') + '</span>' +
          '<span class="rest">剩 ' + p.points + ' 點</span>' +
          (p.auctionBonus ? '<span class="gain">幸福指數 +' + p.auctionBonus + '</span>' : '') +
        '</div>';
      }).join('') + '</div>';
  }

  // 20 格的像素倒數條，一秒熄一格
  function timerBlocks(left) {
    var b = '';
    for (var i = 0; i < 20; i++) b += '<i class="tb' + (i < left ? ' on' : '') + '"></i>';
    return '<div class="timerbox">' +
      '<div class="tnum" id="ringtxt">' + left + '</div>' +
      '<div class="tblocks" id="tblocks">' + b + '</div>' +
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

    warmup: function () {
      return '<h2>你現在有吃飽嗎？</h2>' +
        '<p class="lede">拉一下你的手機就好。</p>' +
        answering(S.stats.answeredWarmup);
    },

    warmup_result: function () {
      return '<h2>全場分布</h2>' +
        histogram(S.stats.warmupDist) +
        answerList(answersOf('warmup'));
    },

    selfscore: function () {
      return '<h2>你覺得現在自己幸福嗎？</h2>' +
        '<p class="lede">0 到 100，憑直覺。只有你自己看得到你的數字。</p>' +
        answering(S.stats.answeredScore);
    },

    selfscore_result: function () {
      var s = S.stats;
      return '<h2>全場分布</h2>' +
        '<p class="lede" style="color:var(--root-c);font-weight:700">你為什麼給自己這個分數？</p>' +
        histogram(s.outerDist) +
        '<div class="cols3" style="grid-template-columns:repeat(3,auto);gap:56px">' +
          '<div><span class="kicker">最高</span><div class="big" style="font-size:calc(64px * var(--u))">' + (s.outerHigh == null ? '—' : s.outerHigh) + '</div></div>' +
          '<div><span class="kicker">最低</span><div class="big" style="font-size:calc(64px * var(--u))">' + (s.outerLow == null ? '—' : s.outerLow) + '</div></div>' +
          '<div><span class="kicker">平均</span><div class="big" style="font-size:calc(64px * var(--u))">' + (s.outerAvg == null ? '—' : s.outerAvg) + '</div></div>' +
        '</div>' +
        answerList(answersOf('outer'));
    },

    standards: function () {
      return '<h2>幸福的標準</h2>' +
        '<p class="lede">世人怎麼判斷一個人幸不幸福 —— 大概就這三樣。</p>' +
        '<div class="cols3" style="margin-top:26px">' +
          '<div class="col3"><h3>財富豐盛</h3><p class="muted" style="margin:0">有沒有錢、有沒有房、賺得比別人多不多。</p></div>' +
          '<div class="col3"><h3>名聲地位</h3><p class="muted" style="margin:0">頭銜、成就、別人提到你的時候怎麼講。</p></div>' +
          '<div class="col3"><h3>家庭婚姻</h3><p class="muted" style="margin:0">結婚了沒、孩子好不好、家完不完整。</p></div>' +
        '</div>';
    },

    auction_intro: function () {
      return '<h2>幸福拍賣會</h2>' +
        '<div class="cols3" style="margin-top:26px">' +
          '<div class="col3"><h3>每人 100 點</h3><p class="muted" style="margin:0">點數就是錢。</p></div>' +
          '<div class="col3" style="border-color:var(--gold)"><h3>什麼都不買，剩下的點數就是你的財富</h3><p class="muted" style="margin:0">所以不出價是一種策略，不是棄權。</p></div>' +
          '<div class="col3"><h3>每樣 20 秒同時暗標</h3><p class="muted" style="margin:0">最高者得，同價時先出價者得。</p></div>' +
        '</div>' +
        '<div class="note"><b>第一樣是試拍</b>，讓大家先按一次，不扣點也不計分。' +
        '正式的共 ' + (S.auction.lots.length ? S.auction.lots.length - 1 : '—') + ' 樣 —— 標的比人少，所以一定有人什麼都沒標到。</div>';
    },

    auction: function () {
      var a = S.auction;
      if (a.status === 'done') {
        return '<h2>全部開標完畢</h2>';
      }
      var lot = a.lot || { name: '—' };
      // 試拍那一樣不編號，改標「試拍」；後面的才從 1 開始數
      var idxLabel = lot.practice
        ? '試拍 · 不計分'
        : a.idx + ' / ' + Math.max(a.total - 1, 1);
      if (a.status === 'reveal') {
        var r = a.results[a.results.length - 1] || {};
        return '' +
          '<div class="lotidx">' + idxLabel + '</div>' +
          '<div class="auction-row">' +
            '<div>' +
              '<div class="lotname" style="margin-top:6px">' + esc(lot.name) + '</div>' +
              (r.winner
                ? '<div style="margin-top:26px"><span class="kicker">得標</span><div class="big">' + esc(r.winner.name) + '</div>' +
                  '<div class="mono" style="font-size:calc(28px * var(--u));color:var(--vol);margin-top:8px">' + r.amount + ' 點</div>' +
                  '<p class="muted mono" style="margin-top:10px">' + r.bidders + ' 人出價</p></div>'
                : '<div style="margin-top:26px"><div class="big" style="color:var(--ink-3)">流標</div>' +
                  '<p class="lede">這一場，沒有人要「' + esc(lot.name) + '」。</p></div>') +
            '</div>' +
            lotArt(lot) +
          '</div>';
      }
      var left = Math.max(0, Math.ceil((a.deadline - Date.now()) / 1000));
      return '' +
        '<div class="lotidx">' + idxLabel + '</div>' +
        '<div class="auction-row">' +
          '<div>' +
            '<div class="lotname">' + esc(lot.name) + '</div>' +
            '<p class="muted mono" style="margin-top:16px;font-size:calc(13px * var(--u))">已出價 <b id="bidcount" style="color:var(--ink)">' + a.bidCount + '</b> / ' + S.stats.count + ' 人</p>' +
            timerBlocks(left) +
          '</div>' +
          lotArt(lot) +
        '</div>';
    },

    auction_result: function () {
      var s = S.stats;
      // 同分的人一起列，不挑一個當代表
      var names = function (arr) {
        return arr.length ? arr.map(function (x) { return esc(x.name); }).join('、') : '—';
      };
      var withPoints = function (arr) {
        return arr.length
          ? '<p class="mono" style="margin:8px 0 0;font-size:calc(22px * var(--u));color:var(--gold)">' + arr[0].points + ' 點</p>'
          : '';
      };
      return '<h2>看看大家買了什麼</h2>' +
        '<div class="cols3">' +
          '<div class="col3"><h3>買最多樣的人</h3>' +
            '<div class="who">' + names(s.topBuyers) + '</div></div>' +
          '<div class="col3"><h3>剩最多錢的人</h3>' +
            '<div class="who">' + names(s.richest) + '</div>' + withPoints(s.richest) + '</div>' +
          '<div class="col3"><h3>剩最少錢的人</h3>' +
            '<div class="who">' + names(s.poorest) + '</div>' + withPoints(s.poorest) + '</div>' +
        '</div>' +
        '<div class="note" style="border-left-color:var(--root-c)">' +
          '<b>標到東西是有回報的</b>　每標到一樣 <b>幸福指數 +5</b>；' +
          '買最多樣的人再 +5，剩最多錢的人 +10，剩最少錢的人 +5。</div>' +
        buyList();
    },

    event_draw: function () {
      return '<h2>模擬生命中的事件</h2>' +
        '<p class="lede">因為這是幸福模擬器，所以在遊戲的過程中，總會出現一些人生的模擬情境。' +
        '大家可以抽一張卡，看看自己遇到的是什麼。</p>' +
        '<div class="big" style="margin-top:24px">' + S.stats.flipped + ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + S.stats.count + ' 人已翻開</span></div>' +
        '<div class="note">每個人抽到的都不一樣，全場不重複。翻開了就會看到自己的幸福指數怎麼動。</div>';
    },

    event_result: function () {
      var s = S.stats;
      var drop = (s.startAvg != null && s.outerAvg != null) ? (s.outerAvg - s.startAvg) : null;
      return '<h2>追求幸福的結果</h2>' +
        '<div style="display:flex;gap:56px;align-items:flex-end;margin-top:16px">' +
          '<div><span class="kicker">全場平均</span><div class="big" style="font-size:calc(64px * var(--u))">' + (s.outerAvg == null ? '—' : s.outerAvg) + '</div></div>' +
          '<div><span class="kicker">相對開場</span><div class="big" style="font-size:calc(64px * var(--u));color:var(--vol)">' + (drop == null ? '—' : (drop > 0 ? '+' : '') + drop) + '</div></div>' +
        '</div>' +
        // 每個人抽到什麼，一次看完 —— 不標「你是哪一型」，那是評語不是遊戲
        '<div class="hitcards">' + s.allCards.map(function (c) {
          return '<div class="hitcard' + (c.delta > 0 ? ' up' : '') + '">' +
            '<div class="hd"><span>' + esc(c.name) + '</span>' +
              '<b>' + (c.delta > 0 ? '+' : '') + c.delta + '</b></div>' +
            '<p>' + esc(c.text) + '</p>' +
          '</div>';
        }).join('') + '</div>';
    },

    // 七關共用的那一頁，內容在 shared/stage-parts.js
    testimony: function () {
      return StageParts.testimony({ lede: '主持人先講自己的。講你也抓不住的那一件事，不要講你已經克服的。' });
    },

    verse: function () {
      return StageParts.verse({
        ref: S.verse.ref, text: S.verse.text,
        done: S.stats.versesReceived, total: S.stats.count,
      });
    },

    burden: function () {
      return StageParts.prayer({
        done: S.stats.burdens, total: S.stats.count, shared: S.stats.sharedBurdens,
      });
    },

    card: function () {
      return StageParts.keepsake({
        done: S.stats.cardsDone, total: S.stats.count,
        extra: '你在拍賣會買了什麼',
      });
    },

    end: function () {
      return StageParts.nextWeek({
        avg: S.stats.outerAvg,
        week: '真相大白',
        lines: [
          '時間會往前推三十年，你今天買的東西要驗貨。',
          '還有：第二條數值到底是什麼，下一關公布。',
        ],
      });
    },
  };

  // ── 渲染 ─────────────────────────────────────────────────────────────
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

    var isAuction = S.phase.id === 'auction';
    document.getElementById('auctionctl').style.display = isAuction ? 'inline-flex' : 'none';
    document.getElementById('waitbtn').textContent = '每項之間等我：' + (S.auction.waitForHost ? '開' : '關');
    document.getElementById('redealbtn').style.display =
      (S.phase.id === 'event_draw' || S.phase.id === 'event_result') ? 'inline-block' : 'none';
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

  // 暗標倒數：只重畫圈圈，不整頁重繪
  setInterval(function () {
    if (!S || S.phase.id !== 'auction' || S.auction.status !== 'bidding') return;
    var left = Math.max(0, Math.ceil((S.auction.deadline - Date.now()) / 1000));
    var txt = document.getElementById('ringtxt');
    var blocks = document.getElementById('tblocks');
    if (!txt || !blocks) return;
    txt.textContent = left;
    for (var i = 0; i < blocks.children.length; i++) {
      blocks.children[i].className = 'tb' + (i < left ? ' on' : '');
    }
  }, 200);

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
      if (cmd === 'reset' && !confirm('全部重置？所有玩家與分數都會清空。')) return;
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

  document.addEventListener('keydown', function (ev) {
    if (ev.repeat) return;   // 按住不放不要一次跳好幾頁
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT') return;
    if (ev.key === 'n' || ev.key === 'N') { ev.preventDefault(); toggleNotes(); return; }
    if (ev.key === 'Escape') { toggleNotes(false); return; }
    if (ev.key === 'ArrowRight' || ev.key === ' ') { ev.preventDefault(); post('next'); }
    if (ev.key === 'ArrowLeft') post('prev');
  });

  // 房號：網址上有就沿用（重整不會換房），沒有就跟 Worker 要一個新的
  function start(code, fresh) {
    ROOM = code;
    var q = '?room=' + code;
    if (location.search !== q) history.replaceState(null, '', location.pathname + q);
    conn = Room.connect({
      role: 'host', week: WEEK, room: code, fresh: fresh,
      onState: function (d) { S = d; render(); },
      onDrop: function () { var h = document.getElementById('hint'); if (h) h.textContent = '連線中斷，重連中…'; },
    });
  }

  var existing = Room.readCode();
  if (existing) start(existing, false);
  else {
    fetch('/api/new-room')
      .then(function (r) { return r.json(); })
      .then(function (d) { start(d.room, true); })
      .catch(function () {
        document.getElementById('stage').innerHTML =
          '<h2>連不上伺服器</h2><p class="lede">重新整理看看。如果一直失敗，改用本機版：<span class="mono">npx wrangler dev</span></p>';
      });
  }
})();
