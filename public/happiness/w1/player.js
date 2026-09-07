// 玩家手機
(function () {
  'use strict';
  var S = null, pid = null, src = null, sig = '', cardURL = null;
  var screen = document.getElementById('screen');
  var statusEl = document.getElementById('status');

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };

  var WEEK = 1;
  var ROOM = Room.readCode();
  // 測試用：同一台電腦要開多個玩家，就在網址後面加 &seat=2、&seat=3……
  // 不加的話同一個瀏覽器的所有分頁會共用同一個身分。
  var SEAT = new URLSearchParams(location.search).get('seat') || '';
  var PID_KEY = 'happiness_pid_' + ROOM + (SEAT ? '_' + SEAT : '');
  var BURDEN_KEY = 'happiness_burden_' + ROOM + (SEAT ? '_' + SEAT : '');

  // 重擔那句話只存在這支手機裡，不會送到伺服器 ——
  // 除非本人按下「我願意分享」。
  function readBurden() { try { return localStorage.getItem(BURDEN_KEY) || ''; } catch (e) { return ''; } }
  function writeBurden(t) { try { localStorage.setItem(BURDEN_KEY, t); } catch (e) {} }

  try { pid = localStorage.getItem(PID_KEY); } catch (e) { pid = null; }

  function act(type, extra) { if (src) src.action(type, extra); }

  function connect() {
    src = Room.connect({
      role: 'player', week: WEEK, room: ROOM, pid: pid,
      onState: function (d) { S = d; render(); },
      onPid: function (p) {
        pid = p;
        try { localStorage.setItem(PID_KEY, pid); } catch (e) {}
        sig = '';
      },
    });
  }

  function join(name) { if (src) src.join(name); }

  // ── 畫面 ─────────────────────────────────────────────────────────────
  var wait = function (msg, sub) {
    return '<div class="wait"><div class="dot">. . .</div><p style="font-size:21px;color:var(--ink-2)">' +
      esc(msg) + '</p>' + (sub ? '<p style="font-size:17px">' + esc(sub) + '</p>' : '') + '</div>';
  };

  // 送出之後：自己填的數字放大，剩下的畫面是「還在等別人」。
  // 只給人數，不給別人的答案 —— 那是主持人翻頁時才一起看的東西。
  function submitted(value, unit, done, total) {
    var all = total > 0 && done >= total;
    return '<div class="sent' + (all ? ' done' : '') + '">' +
      '<div class="lbl">已送出</div>' +
      '<div class="val">' + esc(value) + (unit ? '<small>' + esc(unit) + '</small>' : '') + '</div>' +
      '<p class="msg">' + (all ? '大家都作答完了，看大螢幕。' : '等待其他玩家作答…') + '</p>' +
      '<p class="cnt">' + done + ' / ' + total + ' 人已作答</p>' +
    '</div>';
  }

  function sliderScreen(title, lede, initial, action, unitLow, unitHigh) {
    return '<h2>' + esc(title) + '</h2><p>' + esc(lede) + '</p>' +
      '<div class="slider"><div class="val" id="sv">' + initial + '</div>' +
      '<input type="range" min="0" max="100" value="' + initial + '" id="sl">' +
      '<div class="ends"><span>' + esc(unitLow) + '</span><span>' + esc(unitHigh) + '</span></div></div>' +
      '<button class="btn primary fullbtn" id="send" data-action="' + action + '">送出</button>';
  }

  var views = {
    lobby: function (me) {
      return '<h2>你已經進場了</h2>' +
        '<p>目前 ' + S.playerCount + ' 個人在場。等主持人開始，這個畫面會自己跳。</p>' +
        '<p class="mono" style="color:var(--ink-3);font-size:16px">手機不要鎖螢幕，等一下會用到。</p>' +
        '<button class="btn ghost fullbtn" id="rename">改名字</button>';
    },
    warmup: function (me) {
      if (me.warmup !== null) return submitted(me.warmup, '', S.answeredWarmup, S.playerCount);
      return sliderScreen('你現在有吃飽嗎？', '拉一下就好。', 50, 'warmup', '完全沒吃', '吃得很飽');
    },
    warmup_result: function () { return wait('看大螢幕'); },
    selfscore: function (me) {
      if (me.outer !== null) return submitted(me.outer, '分', S.answeredScore, S.playerCount);
      return sliderScreen('你覺得現在自己幸福嗎？', '0 到 100，憑直覺。只有你自己看得到你的數字。', 50, 'selfscore', '0', '100');
    },
    selfscore_result: function () { return wait('看大螢幕'); },
    standards: function () { return wait('看大螢幕'); },

    auction_intro: function (me) {
      return '<h2>幸福拍賣會</h2>' +
        '<p>你有 <b class="mono" style="color:var(--gold)">100 點</b> 人生籌碼。</p>' +
        '<ul style="color:var(--ink-2);font-size:18px;padding-left:20px">' +
          '<li>每樣 20 秒，大家<b>同時</b>出價，別人看不到你出多少</li>' +
          '<li>最高者得，同價時先出價者得</li>' +
          '<li><b>什麼都不買，剩下的點數就是你的財富</b></li>' +
        '</ul>' + wait('等主持人開始');
    },

    auction: function (me) {
      var a = S.auction;
      if (a.status === 'done') return wait('拍賣結束', '看大螢幕');
      var lot = a.lot || { name: '—' };
      // 試拍那一樣不編號，也要講清楚它不算分
      var idxLabel = lot.practice ? '試拍 · 不計分' : a.idx + ' / ' + Math.max(a.total - 1, 1);
      if (a.status === 'reveal') {
        var r = a.results[a.results.length - 1] || {};
        var mine = r.winner && r.winner.pid === me.pid;
        return '<div class="lotcard card-face">' +
          '<div class="idx">' + idxLabel + ' · 開標</div>' +
          '<div class="nm">' + esc(lot.name) + '</div>' +
          (r.winner
            ? '<p style="margin-top:14px;font-size:21px">' + (mine
                ? '<span class="ok">你得標了 · ' + r.amount + ' 點</span>'
                : esc(r.winner.name) + ' 以 ' + r.amount + ' 點得標') + '</p>'
            : '<p style="margin-top:14px;color:var(--ink-3)">流標，沒有人出價</p>') +
        '</div>';
      }
      var bid = me.myBid == null ? 0 : me.myBid;
      return '<div class="lotcard card-face">' +
          '<div class="idx">' + idxLabel + '</div>' +
          '<div class="nm">' + esc(lot.name) + '</div>' +
          '<div class="timer" id="timer">–</div>' +
        '</div>' +
        '<p class="mono" style="text-align:center;color:var(--ink-3);margin:14px 0 0">你還有 ' + me.points + ' 點</p>' +
        '<div class="bidnum" id="bv">' + bid + '</div>' +
        '<input type="range" min="0" max="' + me.points + '" value="' + bid + '" id="bl">' +
        '<button class="btn primary fullbtn" id="bid">' + (me.myBid == null ? '出價' : '改成這個價') + '</button>' +
        (lot.practice
          ? '<p class="privacy">這一樣是試拍，隨便出。不扣點，也不算你買到。</p>'
          : me.myBid == null
            ? '<p class="privacy">不出價也是一種選擇。沒花掉的點數就是你的財富。</p>'
            : '<p class="privacy ok">已出價 ' + me.myBid + ' 點，時間到之前都可以改。</p>');
    },

    auction_result: function (me) {
      return '<h2>你買到的</h2>' +
        (me.won.length
          ? '<div class="card-face" style="margin-top:14px">' + me.won.map(function (w) {
              return '<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:2px dashed var(--edge-soft)">' +
                '<span style="font-size:22px;font-weight:700">' + esc(w.name) + '</span>' +
                '<span class="mono" style="color:var(--vol)">' + w.price + ' 點</span></div>';
            }).join('') + '</div>'
          : '<p>你什麼都沒標到。你手上滿手現金——那不是輸，是第三種策略。</p>') +
        '<p class="mono" style="margin-top:16px;color:var(--gold);font-size:23px">剩下的財富 ' + me.points + ' 點</p>' +
        wait('看大螢幕');
    },

    event_draw: function (me) {
      if (!me.card) return wait('等主持人發牌');
      if (!me.cardFlipped) {
        return '<h2>模擬生命中的事件</h2><p>每個人抽到的不一樣。點一下翻開。</p>' +
          '<button class="flip" id="flip">?<small>點我翻開</small></button>';
      }
      var c = me.card;
      return '<div class="card-face evcard">' +
          '<div class="hd"><span>' + esc(c.groupLabel || '') + '</span>' +
          '<b class="' + (c.delta > 0 ? 'up' : '') + '">' + (c.delta > 0 ? '+' + c.delta : c.delta === 0 ? '±0' : c.delta) + '</b></div>' +
          '<p>' + esc(c.text) + '</p>' +
        '</div>' +
        '<button class="btn ' + (me.metoo ? 'primary' : '') + ' fullbtn" id="metoo">' +
          (me.metoo ? '✓ 這件事我真的遇過' : '這件事我真的遇過') + '</button>' +
        '<p class="privacy">按了之後，主持人會看到你的名字，可能會請你說兩句。不想說就再按一次取消。</p>';
    },

    event_result: function (me) {
      var d = (me.outer != null && me.outerStart != null) ? me.outer - me.outerStart : null;
      return '<h2>你現在的分數</h2>' +
        '<div class="slider"><div class="val">' + (me.outer == null ? '—' : me.outer) + '</div></div>' +
        (d == null ? '' : '<p class="mono" style="text-align:center;color:' + (d < 0 ? 'var(--vol)' : 'var(--root-c)') +
          '">開場是 ' + me.outerStart + ' 分（' + (d > 0 ? '+' : '') + d + '）</p>') +
        wait('看大螢幕');
    },

    testimony: function () { return wait('聽主持人分享'); },

    verse: function (me) {
      return '<div class="verse-p"><span class="ref">' + esc(S.verse.ref) + '</span>' +
        '<blockquote>「' + esc(S.verse.text) + '」</blockquote></div>' +
        (me.receivedVerse
          ? '<p class="ok" style="text-align:center;margin-top:20px">已收進你的經文卡包</p>'
          : '<button class="btn primary fullbtn" id="verse">領受</button>');
    },

    burden: function (me) {
      var mine = readBurden();
      return '<h2>剛剛那些卡</h2>' +
        '<p>有沒有哪一張其實就是你？<br>如果有，用一句話寫下來。</p>' +
        '<textarea id="bd" maxlength="120" placeholder="一句話就好">' + esc(mine) + '</textarea>' +
        '<label class="checkline"><input type="checkbox" id="sh"' + (me.burdenShare ? ' checked' : '') + '>' +
          '<span>我願意分享（打勾才會出現在大螢幕上）</span></label>' +
        '<button class="btn primary fullbtn" id="savebd">' + (mine ? '更新' : '寫好了') + '</button>' +
        '<p class="privacy">🔒 <b>這句話只存在你這支手機裡。</b>不打勾的話它根本不會離開這台裝置，主持人的畫面只看得到「已填寫」。它會印在你今天的卡片上——第七關會請你把這張卡找出來。</p>' +
        (mine ? '<p class="ok" style="margin-top:8px">已存下。</p>' : '');
    },

    card: function (me) {
      // 等 +5 記上去了再畫 —— 卡片上要印的是禱告之後的數字，不是之前的
      if (!me.cardDone) return '<h2>你的第一張卡片</h2>' + wait('生成中');
      return '<h2>你的第一張卡片</h2>' +
        '<p>長按圖片存進相簿。這張卡是下一關的入場券。</p>' +
        '<img class="weekcard" id="cardimg" alt="第一關週卡">' +
        '<a class="btn primary fullbtn" id="dl" style="display:block;text-align:center;text-decoration:none" download="幸福模擬器-W1-真幸福.png">下載這張卡</a>' +
        '<p class="privacy">現在就存。不要等回家——回家就忘了。</p>';
    },

    end: function (me) {
      return '<h2>第一關結束</h2>' +
        '<p>下次見。記得帶著你的卡片——開場會請你輸入上面那個數字。</p>' +
        (cardURL ? '<img class="weekcard" src="' + cardURL + '" alt="第一關週卡">' : '') +
        '<p class="privacy">忘記存也沒關係。下一關直接重新評估現在的自己，一樣算數。</p>';
    },
  };

  // ── 綁定事件 ─────────────────────────────────────────────────────────
  function bind(me) {
    var sl = document.getElementById('sl');
    if (sl) {
      var sv = document.getElementById('sv');
      sl.oninput = function () { sv.textContent = sl.value; };
      document.getElementById('send').onclick = function () {
        act(document.getElementById('send').dataset.action, { value: Number(sl.value) });
      };
    }

    var bl = document.getElementById('bl');
    if (bl) {
      var bv = document.getElementById('bv');
      bl.oninput = function () { bv.textContent = bl.value; };
      document.getElementById('bid').onclick = function () { act('bid', { value: Number(bl.value) }); };
    }

    var f = document.getElementById('flip');
    if (f) f.onclick = function () { act('flip'); };

    var m = document.getElementById('metoo');
    if (m) m.onclick = function () { act('metoo'); };

    var v = document.getElementById('verse');
    if (v) v.onclick = function () { act('verse'); };

    var sb = document.getElementById('savebd');
    if (sb) sb.onclick = function () {
      var text = document.getElementById('bd').value;
      var share = document.getElementById('sh').checked;
      writeBurden(text);
      // 沒打勾就只送「有寫」這件事，文字留在本機
      act('burden', { has: !!text.trim(), share: share, text: share ? text : '' });
      sig = '';
      render();
    };

    var rn = document.getElementById('rename');
    if (rn) rn.onclick = function () {
      var n = prompt('你的名字', me.name);
      if (n) act('rename', { name: n });
    };

    // 進到週卡這一頁＝禱告收尾做完了，？？？ +5。狀態回來之後才畫圖。
    if (S.phase.id === 'card' && !me.cardDone) act('card');

    var img = document.getElementById('cardimg');
    if (img) {
      var make = function () {
        var cv = document.createElement('canvas');
        drawWeekCard(cv, {
          name: me.name, outer: me.outer, inner: me.inner,
          verseRef: S.verse.ref, verseText: S.verse.text, burden: readBurden(),
        });
        cardURL = cv.toDataURL('image/png');
        img.src = cardURL;
        var dl = document.getElementById('dl');
        if (dl) dl.href = cardURL;
      };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(make); else make();
    }
  }

  // ── 主渲染 ───────────────────────────────────────────────────────────
  function render() {
    if (!S) return;
    var me = S.me;

    if (!me) {
      statusEl.hidden = true;
      if (sig !== 'join') {
        sig = 'join';
        screen.innerHTML = '<h2>幸福模擬器</h2><p>第一關 · 真幸福</p>' +
          '<p style="margin-top:18px">輸入你的名字就可以進場。</p>' +
          '<input id="nm" maxlength="12" placeholder="名字或暱稱" style="width:100%;padding:14px;font-size:22px;font-weight:700">' +
          '<button class="btn primary fullbtn" id="go">進場</button>';
        document.getElementById('go').onclick = function () {
          var n = document.getElementById('nm').value.trim();
          if (!n) { document.getElementById('nm').focus(); return; }
          join(n);
        };
        document.getElementById('nm').onkeydown = function (e) {
          if (e.key === 'Enter') document.getElementById('go').click();
        };
      }
      return;
    }

    statusEl.hidden = false;
    document.getElementById('myname').textContent = me.name;
    document.getElementById('mystate').textContent = S.phase.title;
    // 點數只有拍賣會用得到，規則還沒講之前狀態列上不掛數字
    var pts = document.getElementById('mypts');
    pts.hidden = !S.pointsInPlay;
    pts.textContent = me.points + ' 點';
    document.getElementById('outerv').textContent = me.outer == null ? '—' : me.outer;
    document.getElementById('outerbar').style.width = (me.outer == null ? 0 : me.outer) + '%';
    document.getElementById('innerv').textContent = me.inner;
    document.getElementById('innerbar').style.width = me.inner + '%';

    var next = [
      S.phase.id, S.auction.status, S.auction.idx,
      me.warmup, me.outer, me.inner, me.myBid, me.cardFlipped, me.metoo,
      me.receivedVerse, me.cardDone, me.hasBurden, me.burdenShare, me.points, me.won.length,
      S.pointsInPlay, S.answeredWarmup, S.answeredScore, S.playerCount,
    ].join('|');
    if (next !== sig) {
      sig = next;
      screen.innerHTML = (views[S.phase.id] || function () { return wait('看大螢幕'); })(me);
      bind(me);
    }
  }

  // 暗標倒數
  setInterval(function () {
    var t = document.getElementById('timer');
    if (!t || !S || S.auction.status !== 'bidding') return;
    t.textContent = Math.max(0, Math.ceil((S.auction.deadline - Date.now()) / 1000));
  }, 200);

  // 沒有房號就先問房號（掃 QR 進來的話網址上就有，這頁不會出現）
  if (!ROOM) {
    statusEl.hidden = true;
    screen.innerHTML = '<h2>幸福模擬器</h2><p>第一關 · 真幸福</p>' +
      '<p style="margin-top:18px">輸入大螢幕上的四碼房號。</p>' +
      '<input id="rc" maxlength="4" autocapitalize="characters" autocomplete="off" placeholder="房號" ' +
        'style="width:100%;padding:16px;font-size:37px;font-weight:700;text-align:center;letter-spacing:.3em;font-family:var(--pixel)">' +
      '<button class="btn primary fullbtn" id="rgo">進場</button>' +
      '<p class="privacy">掃主持人畫面上的 QR 就不用輸入這個。</p>';
    var go = function () {
      var c = document.getElementById('rc').value.toUpperCase().trim();
      if (!Room.CODE_RE.test(c)) { document.getElementById('rc').focus(); return; }
      location.search = '?room=' + c + (SEAT ? '&seat=' + SEAT : '');
    };
    document.getElementById('rgo').onclick = go;
    document.getElementById('rc').onkeydown = function (e) { if (e.key === 'Enter') go(); };
  } else {
    connect();
  }
})();
