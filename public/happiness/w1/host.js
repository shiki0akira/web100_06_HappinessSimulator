// 主持人大螢幕
(function () {
  'use strict';
  var WEEK = 1;
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
  function joinUrl() { return location.origin + JOIN_PATH + '?room=' + ROOM; }

  // ── 側欄玩家狀態 ──────────────────────────────────────────────────────
  function renderPlayers() {
    var el = document.getElementById('plist');
    if (!S.players.length) {
      el.innerHTML = '<p class="muted" style="font-size:calc(13px * var(--u))">還沒有人進場。</p>';
      return;
    }
    el.innerHTML = S.players.map(function (p) {
      var outer = p.outer == null ? 0 : p.outer;
      var chips = [];
      if (p.won.length) chips.push('<span class="chip">標到 ' + p.won.length + ' 樣</span>');
      if (p.cardFlipped) chips.push('<span class="chip' + (p.cardKind === 'hit' ? ' on' : '') + '">' + (p.cardKind === 'hit' ? '重擊' : p.cardKind === 'question' ? '？卡' : '已抽') + '</span>');
      if (p.metoo) chips.push('<span class="chip on">我遇過</span>');
      if (p.hasBurden) chips.push('<span class="chip">已填寫</span>');
      if (p.receivedVerse) chips.push('<span class="chip on">已領受</span>');
      return '' +
        '<div class="prow">' +
          '<div class="nm">' + esc(p.name) +
            '<span class="val">' + (p.outer == null ? '—' : p.outer) + '</span>' +
          '</div>' +
          // 上面是幸福指數，下面那條第一關還沒有名字。它有數字、它會動，
          // 但畫面上只有三個問號 —— 有人問就說「下週」。
          '<div class="bars">' +
            '<span class="bar" title="幸福指數"><i style="width:' + outer + '%;background:var(--vol)"></i></span>' +
            '<span class="bar" title="？？？"><i style="width:' + (p.inner || 0) + '%;background:var(--root-c)"></i></span>' +
          '</div>' +
          // ？？？ 的數字等它真的開始長才出現 —— 憑空冒出來比一直掛 0 有戲
          '<div class="meta">剩 <b>' + p.points + '</b> 點' +
            (p.inner ? '<b class="mono" style="color:var(--root-c);margin-left:8px">？？？ ' + p.inner + '</b>' : '') +
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
  function histogram(dist, accent) {
    var max = Math.max.apply(null, dist.concat([1]));
    return '<div class="hist">' + dist.map(function (n, i) {
      return '<div class="col">' +
        '<em>' + (n || '') + '</em>' +
        '<i style="height:' + (n / max * 100) + '%;background:' + (accent || 'var(--vol)') + '"></i>' +
        '<b>' + (i * 10) + '</b>' +
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
          : '<span class="muted">等人進來…</span>') + '</div>';
    },

    warmup: function () {
      return '<span class="kicker">Interaction 1</span><h2>今天晚餐吃飽了嗎？</h2>' +
        '<p class="lede">不要介紹玩法，直接玩一題。這三十秒同時做完三件事：確認每支手機都連上了、他們學會了操作、破冰。</p>' +
        '<div class="big" style="margin-top:24px">' + S.stats.answeredWarmup + ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + S.stats.count + '</span></div>' +
        histogram(S.stats.warmupDist);
    },

    warmup_result: function () {
      return '<span class="kicker">Interaction 1</span><h2>全場分布</h2>' +
        histogram(S.stats.warmupDist) +
        '<div class="note"><b>笑一波就好</b>　這題沒有意義，它的意義是每支手機都連上了。接著進第二題。</div>';
    },

    selfscore: function () {
      return '<span class="kicker">Interaction 2</span><h2>你覺得現在自己幸福嗎？</h2>' +
        '<p class="lede">0 到 100。這個數字就是每個人的幸福指數起點，會跟著他走完七週。</p>' +
        '<div class="big" style="margin-top:30px">' + S.stats.answeredScore + ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + S.stats.count + ' 人已作答</span></div>' +
        '<div class="note"><b>作答中不顯示分布</b>　避免互相定錨。全部填完再翻下一頁。</div>';
    },

    selfscore_result: function () {
      var s = S.stats;
      return '<span class="kicker">Interaction 2</span><h2>全場分布</h2>' +
        '<p class="lede">只念兩個事實：最高幾分、最低幾分。中間的空白讓它留著。</p>' +
        histogram(s.outerDist) +
        '<div class="cols3" style="grid-template-columns:repeat(3,auto);gap:56px">' +
          '<div><span class="kicker">最高</span><div class="big" style="font-size:calc(64px * var(--u))">' + (s.outerHigh == null ? '—' : s.outerHigh) + '</div></div>' +
          '<div><span class="kicker">最低</span><div class="big" style="font-size:calc(64px * var(--u))">' + (s.outerLow == null ? '—' : s.outerLow) + '</div></div>' +
          '<div><span class="kicker">平均</span><div class="big" style="font-size:calc(64px * var(--u))">' + (s.outerAvg == null ? '—' : s.outerAvg) + '</div></div>' +
        '</div>' +
        '<div class="note"><b>有人會填 100</b>　那是防衛，不要糾正、不要開玩笑。等一下的機會與命運，他自己會發現那 100 分怎麼縮水的。</div>';
    },

    host_intro: function () {
      return '<span class="kicker">Host</span><h2>我會填幾分，但我不玩</h2>' +
        '<p class="lede">講你自己會設幾分，然後說明你不參與計分——這句話讓大家知道你不是在評分他們。</p>' +
        '<div class="note"><b>關鍵建議</b>　設一個誠實的、不完美的分數。設 70，不要設 95。然後把這兩分半全部花在講「我為什麼不是 100」。你先示弱，全場的防衛心會掉一大半。</div>';
    },

    auction_intro: function () {
      return '<span class="kicker">Main game</span><h2>幸福拍賣會</h2>' +
        '<div class="cols3" style="margin-top:26px">' +
          '<div class="col3"><h3>每人 100 點</h3><p class="muted" style="margin:0">點數就是錢。</p></div>' +
          '<div class="col3" style="border-color:var(--gold)"><h3>什麼都不買，剩下的點數就是你的財富</h3><p class="muted" style="margin:0">所以不出價是一種策略，不是棄權。</p></div>' +
          '<div class="col3"><h3>每樣 20 秒同時暗標</h3><p class="muted" style="margin:0">最高者得，同價時先出價者得。</p></div>' +
        '</div>' +
        '<div class="note">本場共 ' + (S.auction.lots.length || '—') + ' 樣（依人數決定），最後一樣是「？」。第一關不揭曉它是什麼。</div>';
    },

    auction: function () {
      var a = S.auction;
      if (a.status === 'done') {
        return '<span class="kicker">Auction</span><h2>全部開標完畢</h2>' +
          '<p class="lede">按「下一頁」看大家買了什麼。</p>';
      }
      var lot = a.lot || { name: '—' };
      if (a.status === 'reveal') {
        var r = a.results[a.results.length - 1] || {};
        return '<span class="kicker">Auction · 開標</span>' +
          '<div class="lotidx">' + (a.idx + 1) + ' / ' + a.total + '</div>' +
          '<div class="lotname" style="margin-top:6px">' + esc(lot.name) + '</div>' +
          (r.winner
            ? '<div style="margin-top:26px"><span class="kicker">得標</span><div class="big">' + esc(r.winner.name) + '</div>' +
              '<div class="mono" style="font-size:calc(28px * var(--u));color:var(--vol);margin-top:8px">' + r.amount + ' 點</div>' +
              '<p class="muted mono" style="margin-top:10px">' + r.bidders + ' 人出價</p></div>'
            : '<div style="margin-top:26px"><div class="big" style="color:var(--ink-3)">流標</div>' +
              '<p class="lede">這場沒有人要「' + esc(lot.name) + '」。這句話你講得出來。</p></div>');
      }
      var left = Math.max(0, Math.ceil((a.deadline - Date.now()) / 1000));
      return '<span class="kicker">Auction · 暗標中</span>' +
        '<div class="lotidx">' + (a.idx + 1) + ' / ' + a.total + '</div>' +
        '<div class="auction-row">' +
          '<div><div class="lotname">' + esc(lot.name) + '</div>' +
          '<p class="muted mono" style="margin-top:16px;font-size:calc(13px * var(--u))">已出價 <b id="bidcount" style="color:var(--ink)">' + a.bidCount + '</b> / ' + S.stats.count + ' 人</p></div>' +
          timerBlocks(left) +
        '</div>';
    },

    auction_result: function () {
      var s = S.stats;
      var lots = function (arr) {
        return arr && arr.length
          ? '<ul>' + arr.map(function (w) { return '<li>' + esc(w.name) + ' · ' + w.price + ' 點</li>'; }).join('') + '</ul>'
          : '<p class="muted" style="margin:6px 0 0">什麼都沒標到</p>';
      };
      return '<span class="kicker">Settlement</span><h2>看看大家買了什麼</h2>' +
        '<p class="lede">不是排名，是三種策略。</p>' +
        '<div class="cols3">' +
          '<div class="col3"><h3>買最多樣的人</h3>' +
            '<div class="who">' + (s.mostLots ? esc(s.mostLots.name) : '—') + '</div>' +
            (s.mostLots ? lots(s.mostLots.won) + '<p class="muted mono" style="margin:8px 0 0">剩 ' + s.mostLots.points + ' 點</p>' : '') +
            '<div class="say">「你花光了，值得嗎？」</div></div>' +
          '<div class="col3"><h3>剩最多錢的人</h3>' +
            '<div class="who">' + (s.richest ? esc(s.richest.name) : '—') + '</div>' +
            (s.richest ? '<p class="mono" style="margin:8px 0 0;font-size:calc(22px * var(--u));color:var(--gold)">' + s.richest.points + ' 點</p>' : '') +
            '<div class="say">「你很有錢。你打算拿來做什麼？」</div></div>' +
          '<div class="col3"><h3>什麼都沒標到的人</h3>' +
            '<div class="who">' + (s.empties.length ? s.empties.map(function (e) { return esc(e.name); }).join('、') : '（沒有人）') + '</div>' +
            '<p class="muted" style="margin:8px 0 0;font-size:calc(14px * var(--u))">他們手上滿手現金。那不是輸，是第三種人生策略。</p></div>' +
        '</div>' +
        '<div class="note">停久一點。他們現在回答得很有把握——三分鐘後這些答案會變得很不一樣。</div>';
    },

    event_draw: function () {
      var g = S.stats.groupCounts;
      return '<span class="kicker">Interaction 4</span><h2>機會與命運</h2>' +
        '<p class="lede">每人抽一張，全場不重複。系統看你剩多少錢，從對應那一組發卡。</p>' +
        '<div class="big" style="margin-top:20px">' + S.stats.flipped + ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + S.stats.count + ' 人已翻開</span></div>' +
        '<div class="cols3">' +
          S.stats.decks.map(function (d) {
            return '<div class="col3"><h3>' + esc(d.label) + '</h3>' +
              '<p class="mono muted" style="margin:0;font-size:calc(13px * var(--u))">' + esc(d.rule) + ' · ' + g[d.key] + ' 人</p>' +
              '<p style="margin:8px 0 0;font-size:calc(14px * var(--u));color:var(--ink-2)">' + esc(d.character) + '</p></div>';
          }).join('') +
        '</div>';
    },

    event_result: function () {
      var s = S.stats;
      var drop = (s.startAvg != null && s.outerAvg != null) ? (s.outerAvg - s.startAvg) : null;
      return '<span class="kicker">Interaction 4</span><h2>三種策略，三種摔法</h2>' +
        '<div style="display:flex;gap:56px;align-items:flex-end;margin-top:16px">' +
          '<div><span class="kicker">全場平均</span><div class="big" style="font-size:calc(64px * var(--u))">' + (s.outerAvg == null ? '—' : s.outerAvg) + '</div></div>' +
          '<div><span class="kicker">相對開場</span><div class="big" style="font-size:calc(64px * var(--u));color:var(--vol)">' + (drop == null ? '—' : (drop > 0 ? '+' : '') + drop) + '</div></div>' +
        '</div>' +
        '<div class="hitcards">' + s.hitCards.map(function (h) {
          return '<div class="hitcard">' +
            '<div class="hd"><span>' + esc(h.groupLabel) + '</span><b>' + h.delta + '</b></div>' +
            '<p>' + esc(h.text) + '</p>' +
            '<div class="nm">' + (h.absent ? '今天沒有人走這條路，但我認識走這條路的人。' : esc(h.name)) + '</div>' +
          '</div>';
        }).join('') + '</div>' +
        (s.metoo.length
          ? '<div class="note"><b>按了「這件事我真的遇過」</b>　' + s.metoo.map(esc).join('、') + '　→ 點一兩位分享，比你點名有效得多。</div>'
          : '<div class="note">還沒有人按「這件事我真的遇過」。</div>');
    },

    testimony: function () {
      return '<span class="kicker">Host</span><h2>你的見證</h2>' +
        '<p class="lede">接在他們剛剛的分享後面。</p>' +
        '<div class="note"><b>唯一的提醒</b>　你要說的不是「後來我變幸福了」，是「我也是那個抓不住的人」。他們接下來要寫自己的重擔，寫不寫得出來，取決於你這四分鐘的誠實程度。</div>';
    },

    verse: function () {
      return '<div class="verse"><span class="ref">' + esc(S.verse.ref) + '</span>' +
        '<blockquote>「' + esc(S.verse.text) + '」</blockquote></div>' +
        '<p class="lede" style="margin-top:26px">全場的分數都掉了——買很多的、囤著錢的、什麼都沒標到的。所以這句話的對象不是某些人，是在場每一個人。</p>' +
        '<p class="mono muted" style="margin-top:12px">已領受 ' + S.stats.versesReceived + ' / ' + S.stats.count + '</p>' +
        '<div class="note"><b>底下那條線現在會動</b>　每個人領受完，側欄第二條槽 +10。<b>不要解釋、不要指出來</b>——有人問就說「下週」。第二關才會替它正名。</div>';
    },

    burden: function () {
      var shared = S.stats.sharedBurdens;
      return '<span class="kicker">Interaction 5</span><h2>禱告，順手把石頭收下來</h2>' +
        '<p class="lede">「剛剛那些卡，有沒有哪一張其實就是你？如果有，用一句話寫下來。只有你自己看得到。」</p>' +
        '<div class="big" style="margin-top:20px">' + S.stats.burdens + ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + S.stats.count + ' 已填寫</span></div>' +
        '<div class="note"><b>預設完全不公開</b>　主畫面只顯示「已填寫」，不顯示內容。除非本人按下「我願意分享」。</div>' +
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
        '<p class="lede">這張卡是下週的入場券。散會前每個人手機裡都要有——直接問一句「存好的舉手」。</p>' +
        '<div class="big" style="margin-top:20px">' + S.stats.cardsDone + ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + S.stats.count + ' 已生成</span></div>' +
        '<div class="note"><b>不要說回家再存</b>　漏掉的人下週就接不上了。忘記存也沒關係，下週直接重新評估現在的自己，跟新朋友走同一條路。</div>' +
        '<div class="note"><b>禱告完，底下那條再 +5</b>　卡片一生成就加。今晚結束時每個人的 ？？？ 停在 15。</div>';
    },

    end: function () {
      var s = S.stats;
      return '<span class="kicker">Carry forward</span><h2>第一關結束</h2>' +
        '<p class="lede">這三件事請同工現在拍一張主畫面存起來，第二關開場口頭帶到就好。</p>' +
        '<div class="cols3">' +
          '<div class="col3"><h3>拍賣配置</h3><p class="muted" style="font-size:calc(14px * var(--u));margin:6px 0 0">「你們上禮拜買了什麼」</p></div>' +
          '<div class="col3"><h3>誰抽到重擊卡</h3><p style="font-size:calc(14px * var(--u));margin:6px 0 0">' +
            (s.hitCards.filter(function (h) { return !h.absent; }).map(function (h) { return esc(h.name); }).join('、') || '—') +
            '</p><p class="muted" style="font-size:calc(13px * var(--u));margin:6px 0 0">「上禮拜金融風暴那位，還好嗎」</p></div>' +
          '<div class="col3"><h3>誰標到「？」</h3><p style="font-size:calc(14px * var(--u));margin:6px 0 0">' +
            (function () {
              var who = S.players.filter(function (p) { return p.won.some(function (w) { return w.mystery; }); });
              return who.length ? who.map(function (p) { return esc(p.name); }).join('、') : '（流標）';
            })() +
            '</p><p class="muted" style="font-size:calc(13px * var(--u));margin:6px 0 0">第二關開標揭曉「永生」時，全場會看向他</p></div>' +
        '</div>' +
        '<div class="note"><b>收尾那句鉤子</b>　「今天有人運氣很好。運氣好的人，我們下禮拜見。」</div>';
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

    var e = S.stats.energy;
    document.getElementById('energybar').style.width = e + '%';
    document.getElementById('energyval').textContent = S.stats.outerAvg == null ? '—' : e + '%';
    document.getElementById('hint').textContent =
      S.phase.id === 'lobby' ? '玩家掃碼進場後按「下一頁」開始' : (S.phase.title || '');

    renderPlayers();
    stage.innerHTML = (views[S.phase.id] || function () { return ''; })();

    // 每次回到入場頁都要重畫：stage.innerHTML 一被改寫，canvas 就是全新的空白元素
    var qr = document.getElementById('qr');
    if (qr && ROOM) {
      try { QR.render(qr, joinUrl(), 8, '#161A18', '#ffffff'); } catch (err) {}
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

  document.querySelectorAll('[data-cmd]').forEach(function (b) {
    b.onclick = function () {
      var cmd = b.dataset.cmd;
      if (cmd === 'reset' && !confirm('全部重置？所有玩家與分數都會清空。')) return;
      post(cmd);
    };
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.repeat) return;   // 按住不放不要一次跳好幾頁
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT') return;
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
