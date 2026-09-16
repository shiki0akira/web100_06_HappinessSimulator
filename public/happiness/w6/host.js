// 主持人大螢幕 · 第六關「十字架的勝利」
//
// 十九頁。兩個整面動畫（大魔王登場、最後一擊之後的得勝的力量）跟第二關的時光機同一個等級。
(function () {
  'use strict';
  var WEEK = 6;
  // 大螢幕上印給人手動打字的網址。越短越好打 —— 手機鍵盤打 ? 和 = 很痛苦。
  var JOIN_PATH = '/6';
  var NOTES_PATH = '/h6';   // 主持人備忘錄，掃不到的時候也打得出來
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
    var id = S.phase.id;
    var onFight = (id === 'fight' && !S.fightNow.revealed) || (id === 'win' && !S.winNow.revealed);

    el.innerHTML = S.players.map(function (p) {
      var outer = p.outer == null ? 0 : p.outer;
      // **不掛「新朋友」標籤**，要知道誰第一次來看主持人備忘錄。
      var chips = [];
      if (id === 'cards') chips.push('<span class="chip' + (p.chose ? ' on' : '') + '">' + (p.chose ? '已挑' : '還沒挑') + '</span>');
      if (id === 'draw') chips.push('<span class="chip' + (p.picked ? ' on' : '') + '">' + (p.picked ? '已抽' : '還沒抽') + '</span>');
      if (onFight) chips.push('<span class="chip' + (p.acted ? ' on' : '') + '">' + (p.acted ? '已決定' : '還沒') + '</span>');
      if (id === 'verse' && p.revived) chips.push('<span class="chip on">已領受復活</span>');
      if (id === 'beat') chips.push('<span class="chip' + (p.beat ? ' on' : '') + '">' + (p.beat ? '已出手' : '還沒') + '</span>');
      if (p.prayed) chips.push('<span class="chip">已寫下</span>');
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

  function aspectArt(k) { return '/happiness/shared/art/aspect-' + k + '.svg'; }
  function jobArt(a) { return '/happiness/shared/art/' + a + '.svg'; }

  // 什麼才是「好」？兩欄。右邊翻開之前只有一個問號。
  function goodCols(open) {
    return '<div class="goodgrid' + (open ? ' reveal' : '') + '">' +
      '<div class="goodcol left"><h3>' + esc(S.good.leftLabel) + '</h3><ul>' +
        S.good.left.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
      '</ul></div>' +
      '<div class="goodcol right' + (open ? ' open' : '') + '"><h3>' + esc(S.good.rightLabel) + '</h3>' +
        (open
          ? '<ul>' + S.good.right.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'
          : '<div class="goodq">？</div>') +
      '</div>' +
    '</div>';
  }

  // 魔王 ＋ 血條。mini＝打鬥那兩頁的橫條版（底下還要排四個職業）。
  function bossBar(mini, broken) {
    var pct = Math.max(0, Math.min(100, Math.round(S.hp / S.boss.hp * 100)));
    return '<div class="bosswrap' + (mini ? ' mini' : '') + '">' +
      '<img id="bossimg" class="' + (broken ? 'broken' : '') + '" src="/happiness/shared/art/boss' +
        (broken ? '-broken' : '') + '.svg" alt="">' +
      '<div class="bossname"><small>' + esc(S.boss.lead) + '</small>' + esc(S.boss.name) + '</div>' +
      '<div class="hpbar"><i id="hpfill" style="width:' + pct + '%"></i></div>' +
      '<div class="hpnum" id="hpnum">' + S.hp + ' / ' + S.boss.hp + '</div>' +
    '</div>';
  }

  // 打鬥那兩頁共用的版面（第一階段 fight、第二階段 win）
  function battle(b, isWin) {
    return '<div class="callhd"><h2>' + esc(isWin ? S.winInfo.title : S.fight.title) + '</h2>' +
        (isWin ? '<span class="rn">' + esc(S.winInfo.sub) + '</span>' : '') + '</div>' +
      '<div class="atk"><span class="as">第 ' + (b.round + 1) + ' / ' + b.total + ' 回合 · ' + esc(b.aspect) + '</span>' +
        '<span class="line">' + esc(b.attack) + '</span></div>' +
      bossBar(true, false) +
      (b.revealed
        ? '<div class="jobrow">' + b.byJob.map(function (j) {
            return '<div class="jc' + (j.n ? '' : ' zero') + '">' +
              '<img src="' + jobArt('job-' + j.k) + '" alt="">' +
              '<span class="nm"><b>' + esc(j.t) + '</b><i>' + esc(j.act) + '</i></span>' +
              '<span class="n">' + j.n + ' 人</span>' +
              '<span class="dm">−' + (j.dmg * j.n) + '</span>' +
            '</div>';
          }).join('') + '</div>' +
          '<div class="qcount">出手 ' + b.went + ' 人　什麼都不做 ' + b.idle + ' 人' +
            (isWin ? '' : '　·　每個人掉 1–3 分') + '</div>'
        : '<div class="kfoot">' + counter(b.acted, '人已決定') + '</div>');
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

    // 開場的伏筆。**這一頁不准講出右邊是什麼。**
    good: function () {
      return '<h2>' + esc(S.good.title) + '</h2>' +
        '<div class="goodsub">' + esc(S.good.sub) + '</div>' +
        goodCols(false);
    },

    chase: function () {
      return '<div class="solo"><h2>' + esc(S.chase.line) + '</h2></div>';
    },

    // 挑一塊。大螢幕上只有六塊的名字，**誰挑了哪一塊一律不顯示**。
    cards: function () {
      return '<h2>' + esc(S.pickInfo.title) + '</h2>' +
        '<p class="lede">' + esc(S.pickInfo.sub) + '</p>' +
        '<div class="aspectgrid">' + S.aspects.map(function (a) {
          return '<div class="ac"><img src="' + aspectArt(a.k) + '" alt="">' + esc(a.t) + '</div>';
        }).join('') + '</div>' +
        '<div class="kfoot">' + counter(S.stats.picked, '人已挑好、抽好') + '</div>';
    },

    // 公布抽到的那一張。**翻到這一頁就是公布**；第 5 頁大螢幕上一句話都不顯示。
    draw: function () {
      var c = S.cardsNow;
      if (c.open) {
        return '<h2>' + esc(S.drawInfo.title) + '</h2>' +
          '<div class="taken">' + (c.taken.length
            ? c.taken.map(function (t) {
              return '<div class="tk"><div class="as">' + esc(t.aspect) + '<b>' + esc(t.name) + '</b></div>' +
                '<p>' + esc(t.text) + '</p></div>';
            }).join('')
            : '<p class="lede">沒有人抽。</p>') + '</div>';
      }
      // 一翻到這一頁伺服器就公布了，這裡只會閃一下
      return '<h2>' + esc(S.drawInfo.title) + '</h2>';
    },

    // 統計。**只有人數，沒有名字。**
    tally: function () {
      var t = S.tallyNow;
      return '<h2>' + esc(S.tally.title) + '</h2>' +
        '<div class="bars">' + t.rows.map(function (r) {
          return '<div class="bar2' + (r.n ? '' : ' zero') + '">' +
            '<span class="bl"><img src="' + aspectArt(r.k) + '" alt="">' + esc(r.t) + '</span>' +
            '<span class="bt"><i style="width:' + Math.round(r.n / t.max * 100) + '%"></i></span>' +
            '<span class="bn">' + r.n + ' 人</span>' +
          '</div>';
        }).join('') + '</div>' +
        '<div class="quotes">' + t.rows.reduce(function (all, r) {
          return all.concat(r.texts.map(function (x) { return '<span>' + esc(x) + '</span>'; }));
        }, []).join('') + '</div>';
    },

    // 大魔王登場 —— 整面動畫：從地上升起來、名字打出來、血條填滿。
    bossIn: function () {
      return '<div class="cine bossin">' +
        '<div class="rays"><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
        '<div class="cinelead">' + esc(S.boss.lead) + '</div>' +
        '<img class="risen" src="/happiness/shared/art/boss.svg" alt="">' +
        '<div class="cinetitle">' + esc(S.boss.name) + '</div>' +
        '<div class="hpbar wide"><i class="fillup"></i></div>' +
        '<div class="hpnum">' + S.boss.hp + ' / ' + S.boss.hp + '</div>' +
      '</div>';
    },

    // 四個職業：**只有圖和名字**。它代表什麼，打鬥那一頁每一回合公布了才翻出來。
    job: function () {
      return '<h2>' + esc(S.jobInfo.title) + '</h2>' +
        '<p class="lede">' + esc(S.jobInfo.sub) + '</p>' +
        '<div class="jobgrid">' + S.classes.map(function (c) {
          return '<div class="jobcard">' +
            '<img src="' + jobArt(c.art) + '" alt="">' +
            '<b>' + esc(c.t) + '</b>' +
            '<span class="act">？</span>' +
          '</div>';
        }).join('') + '</div>' +
        '<div class="kfoot"><div class="qcount">' + esc(S.jobInfo.hint) + '</div></div>';
    },

    fight: function () { return battle(S.fightNow, false); },

    // 五回合過去了 —— **不准寫 GAME OVER。**
    lost: function () {
      return '<div class="cine lost">' +
        '<div class="cinelead">' + esc(S.lost.title) + '</div>' +
        '<img class="stand" src="/happiness/shared/art/boss.svg" alt="">' +
        '<div class="hpbar wide"><i style="width:100%"></i></div>' +
        '<div class="hpnum">' + S.boss.hp + ' / ' + S.boss.hp + '</div>' +
        '<div class="cinetitle down">' + esc(S.lost.line) + '</div>' +
      '</div>';
    },

    // 十字架。三段一段一段走，最後一段就是「復活的大能」。**手機上沒有任何按鈕。**
    cross: function () {
      var st = S.crossStep || 0;
      if (st === 0) {
        return '<div class="cross">' +
          '<div style="display:flex;align-items:flex-end;gap:calc(40px * var(--u))">' +
            '<img class="him" src="/happiness/shared/art/superstar.svg" alt="">' +
            '<img class="boss" src="/happiness/shared/art/boss.svg" alt="">' +
          '</div>' +
          '<div class="line" style="margin-top:min(calc(18px * var(--u)),2.4vh)">' + esc(S.cross.steps[0].t) + '</div>' +
        '</div>';
      }
      if (st === 1) {
        return '<div class="cross">' +
          '<img class="crossart" src="/happiness/shared/art/cross-dark.svg" alt="">' +
          '<div class="line" style="margin-top:min(calc(18px * var(--u)),2.4vh)">' + esc(S.cross.steps[1].t) + '</div>' +
        '</div>';
      }
      return '<div class="teaser">' +
        '<div class="powerart"><img src="/happiness/shared/art/' + esc(S.power.art) + '.svg" alt=""></div>' +
        '<h2 class="big-title" style="font-size:min(calc(48px * var(--u)),6vh,3.6vw);letter-spacing:.04em">' +
          esc(S.power.title) + '</h2>' +
      '</div>';
    },

    // 領受經文 ＋ 領受復活。兩個數字都在這一頁等。
    verse: function () {
      return '<h2>領受經文</h2>' +
        '<div class="verse"><span class="ref">' + esc(S.verse.ref) + '</span>' +
          '<blockquote>「' + esc(S.verse.text) + '」</blockquote></div>' +
        '<div class="twocount">' +
          '<div><span class="l">已領受經文</span><b>' + S.stats.versesReceived + ' / ' + S.stats.count + '</b></div>' +
          '<div class="rev"><span class="l">已領受復活</span><b>' + S.stats.revived + ' / ' + S.stats.count + '</b></div>' +
        '</div>';
    },

    win: function () { return battle(S.winNow, true); },

    // 最後一擊：全場一起出手。**全部的人都按了就自己走**（主持人不用按）：
    // 血條慢慢歸零 → 魔王倒下 → 換成「得勝的力量」（舉起手的四個職業，中間站著耶穌）。
    beat: function () {
      var b = S.beatNow;
      var bst = beatStage();
      if (bst === 'drain' || bst === 'broken') {
        var broken = bst === 'broken';
        return '<div class="cine beatfight">' +
          (broken
            // 倒下：被打得晃一下、閃白、往下垮，底下噴出灰塵
            ? '<div class="fallwrap"><img class="bossimg broken" src="/happiness/shared/art/boss-broken.svg" alt="">' +
                '<div class="dust"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>'
            : '<img class="bossimg" src="/happiness/shared/art/boss.svg" alt="">') +
          '<div class="bossname"><small>' + esc(S.boss.lead) + '</small>' + esc(S.boss.name) + '</div>' +
          '<div class="hpbar wide"><i id="hpfill" class="drain" style="width:' + (broken ? 0 : beatFromPct() * beatLeft()) + '%"></i></div>' +
          '<div class="hpnum" id="hpnum">' + (broken ? 0 : Math.round(beatFrom * beatLeft())) + ' / ' + S.boss.hp + '</div>' +
          (broken ? '<div class="cinetitle">' + esc(S.beatInfo.done) + '</div>' : '') +
        '</div>';
      }
      if (b.done) {
        return '<div class="cine victory">' +
          '<div class="rays gold"><i></i><i></i><i></i><i></i><i></i><i></i></div>' +
          '<img class="party" src="/happiness/shared/art/victory-party.svg" alt="">' +
          '<div class="crossdone">' + esc(S.beatInfo.done) + '　·　' + esc(S.beatInfo.gainNote) + '</div>' +
          '<div class="cinelead" style="margin-top:min(calc(16px * var(--u)),2vh)">' + esc(S.victory.lead) + '</div>' +
          '<div class="cinetitle big">' + esc(S.victory.title) + '</div>' +
          '<div class="cineline">' + esc(S.victory.line) + '</div>' +
        '</div>';
      }
      return '<div class="cine beatfight">' +
          '<div class="cinelead">' + esc(S.beatInfo.title) + '　·　' + esc(S.beatInfo.sub) + '</div>' +
          '<img class="bossimg" src="/happiness/shared/art/boss.svg" alt="">' +
          '<div class="bossname"><small>' + esc(S.boss.lead) + '</small>' + esc(S.boss.name) + '</div>' +
          '<div class="hpbar wide"><i style="width:' + Math.round(S.hp / S.boss.hp * 100) + '%"></i></div>' +
          '<div class="hpnum">' + S.hp + ' / ' + S.boss.hp + '</div>' +
          '<div style="margin-top:min(calc(14px * var(--u)),1.8vh)">' + counter(b.hit, '人已出手') + '</div>' +
        '</div>';
    },

    // 開場那張蓋著的卡，到這一頁**直接是翻開的**（不用主持人再按）。
    // 左邊淡下去，重點在右邊。
    goodOpen: function () {
      return '<h2>' + esc(S.good.title) + '</h2>' +
        '<div class="goodsub">信靠耶穌，成為人生勝利組</div>' +
        goodCols(true);
    },

    bless: function () {
      return StageParts.prayer({
        title: '得勝禱告',
        lede: '「' + S.bless.ask + '＿＿」。只有你自己看得到。',
        done: S.stats.blessed, total: S.stats.count,
      });
    },

    card: function () {
      return StageParts.keepsake({
        done: S.stats.cardsDone, total: S.stats.count,
        extra: '你抽到的那一張、你正在打的那一仗',
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
        week: '釋放與自由',
        lines: [
          '今天靠自己打了五回合，它每一次都補回來。倒下的那一刻，不是我們變強了 —— 是他先站起來。',
          '在世上還是有苦難。但那一仗，他已經打贏了。',
          '魔王倒了，可是你身上還背著一些東西。下一關 —— 釋放與自由，把它卸下來。',
        ],
      });
    },
  };

  // ── 血條動畫 ─────────────────────────────────────────────────────────
  // 第一階段：公布的那一刻血條真的掉下去，**1.4 秒後補滿** —— 那個「補回來」就是這一段的戲。
  // 第二階段：一樣掉下去，**但它補不回來**。
  var healKey = '', healTimer = null;
  function healAnim() {
    var id = S.phase.id;
    var b = id === 'fight' ? S.fightNow : id === 'win' ? S.winNow : null;
    var key = b && b.revealed ? id + b.round : '';
    if (key === healKey) return;
    healKey = key;
    clearTimeout(healTimer);
    if (!key) return;
    var fill = document.getElementById('hpfill');
    var num = document.getElementById('hpnum');
    if (!fill || !num) return;
    var max = S.boss.hp;
    fill.style.width = Math.round(b.hp / max * 100) + '%';
    num.textContent = b.hp + ' / ' + max + '　（−' + b.dmg + '）';
    if (id === 'win') {
      num.className = 'hpnum win';
      num.textContent = b.hp + ' / ' + max + '　（−' + b.dmg + '）　' + S.winInfo.noheal;
      return;
    }
    num.className = 'hpnum';
    healTimer = setTimeout(function () {
      var fl = document.getElementById('hpfill');
      var nm = document.getElementById('hpnum');
      if (!fl || !nm) return;
      fl.style.width = '100%';
      nm.className = 'hpnum heal';
      nm.textContent = max + ' / ' + max + '　' + S.fight.heal;
    }, 1400);
  }

  // ── 最後一擊的動畫 ─────────────────────────────────────────────────
  // 伺服器只知道「倒了沒」。**在這一頁親眼看到它從沒倒變成倒了**，才播：
  // 血條慢慢歸零（BEAT_DRAIN）→ 倒下的魔王（BEAT_BROKEN）→ 勝利畫面。
  // 重新整理或跳頁進來的時候已經倒了，就直接給勝利畫面。
  var BEAT_DRAIN = 2600, BEAT_BROKEN = 3000;
  var beatFrom = 0, beatAt = 0, beatTimer = null, beatWasUp = false;
  function beatFromPct() { return Math.round(beatFrom / S.boss.hp * 100); }
  // 還剩幾成血（先快後慢，最後那一點點拖一下）
  function beatLeft() {
    var t = Math.min(1, (Date.now() - beatAt) / BEAT_DRAIN);
    return Math.pow(1 - t, 2.2);
  }
  function beatStage() {
    if (!beatAt) return '';
    var t = Date.now() - beatAt;
    return t < BEAT_DRAIN ? 'drain' : t < BEAT_DRAIN + BEAT_BROKEN ? 'broken' : '';
  }
  function beatWatch() {
    if (S.phase.id !== 'beat') { beatWasUp = false; beatAt = 0; return; }
    if (!S.beatNow.done) { beatWasUp = true; beatAt = 0; beatFrom = S.hp; return; }
    if (beatWasUp && !beatAt) {
      beatWasUp = false;
      beatAt = Date.now();
      clearTimeout(beatTimer);
      beatTimer = setTimeout(function () { paint(); beatTimer = setTimeout(paint, BEAT_BROKEN); }, BEAT_DRAIN);
    }
  }
  var beatTick = null;
  function beatNumbers() {
    clearInterval(beatTick);
    if (beatStage() !== 'drain') return;
    beatTick = setInterval(function () {
      var nm = document.getElementById('hpnum');
      var fl = document.getElementById('hpfill');
      if (!nm || !fl || beatStage() !== 'drain') { clearInterval(beatTick); return; }
      nm.textContent = Math.round(beatFrom * beatLeft()) + ' / ' + S.boss.hp;
      fl.style.width = (beatFromPct() * beatLeft()) + '%';
    }, 50);
  }

  function paint() {
    beatWatch();
    stage.className = 'stage phase-' + S.phase.id +
      (S.phase.id === 'bossIn' || S.phase.id === 'beat' || S.phase.id === 'lost' ? ' cinepage' : '');
    stage.innerHTML = (views[S.phase.id] || function () { return ''; })();

    var qr = document.getElementById('qr');
    if (qr && ROOM) {
      try { QR.render(qr, joinUrl(), qrScale(7), '#161A18', '#ffffff'); } catch (err) {}
    }
    healKey = '';
    healAnim();
    beatNumbers();
    fitSolo();
  }

  // 整頁一句話那幾頁**不准斷行**，可是句子長度是文案決定的 ——
  // CSS 的 vw 算的是整個視窗，扣掉側欄之後就爆出去了。所以畫完再量一次，
  // **量到塞得下為止**。改文案的人不用回來算字級。
  function fitSolo() {
    var list = stage.querySelectorAll('.solo h2, .cine .cinetitle, .cine .cineline, .cross .line');
    var avail = stage.clientWidth - parseFloat(getComputedStyle(stage).paddingLeft) * 2;
    for (var i = 0; i < list.length; i++) {
      var h = list[i];
      h.style.fontSize = '';
      var size = parseFloat(getComputedStyle(h).fontSize);
      var guard = 0;
      while (h.scrollWidth > avail && size > 18 && guard++ < 80) {
        size -= 2;
        h.style.fontSize = size + 'px';
      }
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
    show('cardsctl', S.phase.id === 'draw');
    show('fightctl', S.phase.id === 'fight');
    show('crossctl', S.phase.id === 'cross');
    show('winctl', S.phase.id === 'win');
    show('beatctl', S.phase.id === 'beat');

    if (S.phase.id === 'fight' || S.phase.id === 'win') {
      var isWin = S.phase.id === 'win';
      var b = isWin ? S.winNow : S.fightNow;
      var last = b.round >= b.total - 1;
      document.getElementById(isWin ? 'wprev' : 'fprev').disabled = b.round <= 0;
      var btn = document.getElementById(isWin ? 'wstep' : 'fstep');
      btn.textContent = !b.revealed
        ? '公布結果（' + (b.round + 1) + '/' + b.total + '）'
        : (last ? '都打完了，按下一頁' : '下一回合 →（' + (b.round + 2) + '/' + b.total + '）');
      btn.disabled = b.revealed && last;
    }
    if (S.phase.id === 'cross') {
      var st = S.crossStep || 0;
      document.getElementById('cback').disabled = st <= 0;
      var cn = document.getElementById('cnext');
      var LABELS = ['下一步（他替他們挨了那一擊）', '下一步（復活的大能）', '走完了，按下一頁'];
      cn.textContent = LABELS[st];
      cn.disabled = st >= 2;
    }
    if (S.phase.id === 'beat') {
      var ba = document.getElementById('beatall');
      ba.textContent = S.beatNow.done ? '已經倒下了' : '全場出手（' + S.beatNow.hit + '/' + S.beatNow.total + '）';
      ba.disabled = S.beatNow.done;
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
      if (cmd === 'cardsRedeal' && !confirm('大家重來一次？每個人的幸福指數會還原，剛剛挑的那一塊和抽到的那一句都會清掉。')) return;
      if (cmd === 'fightRestart' && !confirm('五回合整個重跑？每個人掉的分數會還原。')) return;
      if (cmd === 'winRestart' && !confirm('第二階段重跑？血條會回到滿的。')) return;
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
