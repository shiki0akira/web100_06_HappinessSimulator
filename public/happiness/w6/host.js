// 主持人大螢幕 · 第六關「十字架的勝利」
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
    var onCards = S.phase.id === 'cards' && !S.cardsNow.open;
    var onFight = S.phase.id === 'fight' && !S.fightNow.revealed;
    // 誰被打中了：**不加紅色、不寫「危險」**（架構第十一節）
    var hitNow = {};
    if (S.phase.id === 'together') {
      S.togetherNow.hits.forEach(function (h) { if (!h.prays) hitNow[h.pid] = true; });
    }

    el.innerHTML = S.players.map(function (p) {
      var outer = p.outer == null ? 0 : p.outer;
      // **不掛「新朋友」標籤**，要知道誰第一次來看主持人備忘錄。
      var chips = [];
      if (onCards) chips.push('<span class="chip' + (p.picked ? ' on' : '') + '">' + (p.picked ? '已挑' : '還沒挑') + '</span>');
      if (onFight) chips.push('<span class="chip' + (p.moved ? ' on' : '') + '">' + (p.moved ? '已出招' : '還沒出招') + '</span>');
      if (hitNow[p.pid]) chips.push('<span class="chip hit">等人扛</span>');
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

  function aspectArt(k) { return '/happiness/shared/art/aspect-' + k + '.svg'; }

  // 什麼才是「好」？兩欄。右邊翻開之前只有一個問號。
  function goodCols(open) {
    return '<div class="goodgrid">' +
      '<div class="goodcol"><h3>' + esc(S.good.leftLabel) + '</h3><ul>' +
        S.good.left.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
      '</ul></div>' +
      '<div class="goodcol right' + (open ? ' open' : '') + '"><h3>' + esc(S.good.rightLabel) + '</h3>' +
        (open
          ? '<ul>' + S.good.right.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'
          : '<div class="goodq">？</div>') +
      '</div>' +
    '</div>';
  }

  // 魔王 ＋ 血條。hp 是現在剩多少（回血動畫在 paint 裡處理）。
  // mini：打鬥和結算那兩頁塞得下 —— 魔王縮成一條，血條照樣看得到。
  function bossArt(hp, broken, mini) {
    var b = S.bossInfo;
    var pct = Math.max(0, Math.min(100, Math.round(hp / b.hp * 100)));
    return '<div class="bosswrap' + (mini ? ' mini' : '') + '">' +
      '<img id="bossimg" class="' + (broken ? 'broken' : '') + '" src="/happiness/shared/art/boss' +
        (broken ? '-broken' : '') + '.svg" alt="">' +
      '<div class="bossname"><small>' + esc(S.bossInfo.title) + '</small>' + esc(b.name) + '</div>' +
      '<div class="hpbar"><i id="hpfill" style="width:' + pct + '%"></i></div>' +
      '<div class="hpnum" id="hpnum">' + (broken ? '0' : hp) + ' / ' + b.hp + '</div>' +
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

    // 教會投影片第 2 頁。標題頁沒有副標 —— 接第五關的那兩句在下一頁開頭講。
    intro: function () {
      return '<div class="teaser">' +
        '<span class="kicker">今天的主題</span>' +
        '<h2 class="big-title">' + esc(S.intro.title) + '</h2>' +
        '<div class="teaseart"><img src="/happiness/shared/art/quest-cross.svg" alt=""></div>' +
      '</div>';
    },

    // 什麼才是「好」？**右邊那一格蓋著**，第 14 頁才翻開。這一頁不准講出它是什麼。
    good: function () {
      return '<h2>' + esc(S.good.title) + '</h2>' +
        '<div class="goodsub">' + esc(S.good.sub) + '</div>' +
        goodCols(false);
    },

    // 整頁只有一句話。念完停三秒再翻頁，答案在下一頁那三張卡。
    chase: function () {
      return '<div class="solo"><h2>' + esc(S.chase.line) + '</h2></div>';
    },

    // 三張困難卡。**大螢幕上不顯示任何人抽到什麼** —— 每個人的三張都不一樣，
    // 公布之後才翻出被挑走的那幾張。
    cards: function () {
      var c = S.cardsNow;
      if (c.open) {
        return '<h2>' + esc(S.pickInfo.title) + '</h2>' +
          '<div class="taken">' + (c.taken.length
            ? c.taken.map(function (t) {
              return '<div class="tk"><div class="as">' + esc(t.aspect) + '<b>' + esc(t.name) + '</b></div>' +
                '<p>' + esc(t.text) + '</p></div>';
            }).join('')
            : '<p class="lede">沒有人挑。</p>') + '</div>';
      }
      return '<h2>' + esc(S.pickInfo.title) + '</h2>' +
        '<p class="lede">' + esc(S.pickInfo.sub) + '</p>' +
        '<div class="cardgrid">' +
          '<div class="cardback">？</div><div class="cardback">？</div><div class="cardback">？</div>' +
        '</div>' +
        '<div class="kfoot">' + counter(S.stats.picked, '人已挑') + '</div>';
    },

    // 統計 ＋ 合體。**只有人數，沒有名字** —— 這一題是重擔。
    boss: function () {
      var b = S.bossNow;
      if (b.merged) return bossArt(S.bossInfo.hp, false);
      return '<h2>' + esc(S.tally.title) + '</h2>' +
        '<div class="bars">' + b.rows.map(function (r) {
          return '<div class="bar2' + (r.n ? '' : ' zero') + '">' +
            '<span class="bl"><img src="' + aspectArt(r.k) + '" alt="">' + esc(r.t) + '</span>' +
            '<span class="bt"><i style="width:' + Math.round(r.n / b.max * 100) + '%"></i></span>' +
            '<span class="bn">' + r.n + ' 人</span>' +
          '</div>';
        }).join('') + '</div>' +
        '<div class="quotes">' + b.rows.reduce(function (all, r) {
          return all.concat(r.texts.map(function (t) { return '<span>' + esc(t) + '</span>'; }));
        }, []).join('') + '</div>';
    },

    // 靠自己打。四招都掉一樣的分 —— 打掉多少血不一樣，代價一樣。
    fight: function () {
      var f = S.fightNow;
      return '<div class="callhd"><h2>' + esc(S.fight.title) + '</h2></div>' +
        '<div class="atk"><span class="as">第 ' + (f.round + 1) + ' 回合 · ' + esc(f.aspect) + '</span>' +
          '<span class="line">' + esc(f.attack) + '</span></div>' +
        bossArt(S.bossInfo.hp, false, true) +
        '<div class="mgrid">' + f.cols.map(function (c) {
          return '<div class="mv">' +
            '<b>' + esc(c.label) + '</b>' +
            '<span class="dmg' + (c.dmg ? '' : ' miss') + '">' + (c.dmg ? '−' + c.dmg : 'MISS') + '</span>' +
            (f.revealed
              ? '<span class="n">' + c.n + ' 人　幸福指數 −2</span>' +
                '<div class="t">' + esc(c.t) + '</div>' +
                '<div class="who">' + c.names.map(esc).join('・') + '</div>'
              : '') +
          '</div>';
        }).join('') + '</div>' +
        (f.revealed ? '' : '<div class="kfoot">' + counter(S.stats.moved, '人已出招') + '</div>');
    },

    // 勞苦重擔的不幸人生。血條還是滿的，四招各出了幾次（**不印名字**）。
    fightEnd: function () {
      var e = S.fightEndNow;
      return '<div class="callhd"><h2>' + esc(S.fightEnd.title) + '</h2>' +
          '<span class="rn">' + esc(S.fightEnd.lead) + '</span></div>' +
        bossArt(S.bossInfo.hp, false, true) +
        '<div class="endgrid">' + e.cols.map(function (c) {
          return '<div class="endcell"><b>' + esc(c.label) + '</b><em>' + c.n + ' 次</em></div>';
        }).join('') + '</div>' +
        '<div class="qcount">全場平均掉了 ' + e.avgLost + ' 分</div>';
    },

    // 十字架。四段一段一段走。**手機上沒有任何按鈕。**
    cross: function () {
      var st = S.crossStep || 0;
      if (st === 0) {
        return '<div class="cross">' +
          '<img class="boss raise" src="/happiness/shared/art/boss.svg" alt="">' +
          '<div class="line" style="margin-top:min(calc(18px * var(--u)),2.4vh)">' + esc(S.cross.steps[0].t) + '</div>' +
        '</div>';
      }
      if (st === 1) {
        return '<div class="cross">' +
          '<div style="display:flex;align-items:flex-end;gap:calc(40px * var(--u))">' +
            '<img class="him" src="/happiness/shared/art/superstar.svg" alt="">' +
            '<img class="boss" src="/happiness/shared/art/boss.svg" alt="">' +
          '</div>' +
          '<div class="line" style="margin-top:min(calc(18px * var(--u)),2.4vh)">' + esc(S.cross.steps[1].t) + '</div>' +
        '</div>';
      }
      if (st === 2) {
        return '<div class="cross dark">' +
          '<img class="crossart" src="/happiness/shared/art/cross-dark.svg" alt="">' +
          '<div class="days">' + S.cross.days.map(function (d, i) {
            return '<span class="on' + (i === 2 ? ' last' : '') + '" style="animation-delay:' + (i * 1.4) + 's">' + esc(d) + '</span>';
          }).join('') + '</div>' +
        '</div>';
      }
      return '<div class="cross dark">' +
        '<img class="boss broken" src="/happiness/shared/art/boss-broken.svg" alt="" style="width:min(calc(300px * var(--u)),34vh)">' +
        '<div class="hpbar" style="width:min(calc(560px * var(--u)),62vw)"><i style="width:0%"></i></div>' +
        '<div class="hpnum">0 / ' + S.bossInfo.hp + '</div>' +
        '<div class="line" style="margin-top:min(calc(20px * var(--u)),2.6vh);color:var(--gold)">' +
          esc(S.cross.steps[3].t) + '</div>' +
        '<div class="crossdone">' + esc(S.cross.gainNote) + '</div>' +
      '</div>';
    },

    // 復活的大能成為我們得勝的能力。打開的墳墓，石頭滾到旁邊。
    power: function () {
      return '<div class="teaser">' +
        '<div class="powerart"><img src="/happiness/shared/art/' + esc(S.power.art) + '.svg" alt=""></div>' +
        '<h2 class="big-title" style="font-size:min(calc(48px * var(--u)),6vh,3.6vw);letter-spacing:.04em">' +
          esc(S.power.title) + '</h2>' +
      '</div>';
    },

    verse: function () {
      return StageParts.verse({
        ref: S.verse.ref, text: S.verse.text,
        done: S.stats.versesReceived, total: S.stats.count,
      });
    },

    // 在生活中得勝。苦難照樣來，但這一次全場可以替他扛。
    // **能量條一格一個被打中的人**，不是按了幾次。
    together: function () {
      var t = S.togetherNow;
      var e = t.energy;
      return '<div class="callhd"><h2>' + esc(S.together.title) + '</h2>' +
          '<span class="rn">' + esc(S.together.sub) + '</span></div>' +
        '<div class="atk"><span class="as">第 ' + (t.round + 1) + ' 回合 · ' + esc(t.aspect) + '</span></div>' +
        '<div class="hitgrid">' + (t.hits.length
          ? t.hits.map(function (h) {
            return '<div class="hitrow' + (h.prays ? ' lit' : '') + '">' +
              '<span class="who"><i>第 ' + (h.round + 1) + ' 回合 · ' + esc(h.aspect) + '</i>' + esc(h.name) + '</span>' +
              '<span class="what">' + esc(h.text) + '</span>' +
              '<span class="pr">' + (h.prays
                ? '<span class="hearts">' + new Array(Math.min(h.prays, 8) + 1).join('♥') + '</span>　' + h.prays + ' 人為他禱告'
                : '等人為他禱告') + '</span>' +
            '</div>';
          }).join('')
          : '<p class="lede">按「出招」開始。</p>') + '</div>' +
        '<div class="energy' + (e.done ? ' full' : '') + '">' +
          '<div class="el"><span>全場能量</span><span>' + e.lit + ' / ' + e.planned + '</span></div>' +
          '<div class="cells">' + new Array(e.planned + 1).join('x').split('').map(function (_, i) {
            return '<i class="' + (i < e.lit ? 'on' : '') + '"></i>';
          }).join('') + '</div>' +
        '</div>';
    },

    // 這一仗，全場一起打贏。按「翻開」之後換成第 4 頁那兩欄，右邊填滿。
    won: function () {
      if (S.goodOpen) {
        return '<h2>' + esc(S.good.title) + '</h2>' +
          '<div class="goodsub">' + esc(S.won.sub) + '</div>' +
          goodCols(true);
      }
      var t = S.togetherNow;
      return '<div class="wonhead"><h2>' + esc(S.won.title) + '</h2>' +
          '<span class="sub">' + esc(S.won.sub) + '</span></div>' +
        '<div class="hitgrid">' + (t.hits.length
          ? t.hits.map(function (h) {
            return '<div class="hitrow' + (h.prays ? ' lit' : '') + '">' +
              '<span class="who"><i>' + esc(h.aspect) + '</i>' + esc(h.name) + '</span>' +
              '<span class="what">' + esc(h.text) + '</span>' +
              '<span class="pr">' + h.prays + ' 人為他禱告</span>' +
            '</div>';
          }).join('')
          : '<p class="lede">今天沒有人被打中。</p>') + '</div>';
    },

    // 這一關的得勝禱告有指定題目。**完全不上牆** —— 這裡只有「幾人已寫下」。
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
        extra: '你挑的那一張、你正在打的那一仗',
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
          '今天靠自己打了三回合，魔王一滴血都沒少。倒下的那一刻，不是我們打的 —— 那 +10 是他給的。',
          '在世上還是有苦難。但今天被打中的人，沒有一個被留在原地。',
          '魔王倒了，可是你身上還背著一些東西。下一關 —— 釋放與自由，把它卸下來。',
        ],
      });
    },
  };

  // ── 主渲染 ───────────────────────────────────────────────────────────
  // 靠自己打：公布的那一刻血條真的會掉，**停一秒之後補滿 999** ——
  // 那個「補回來」就是這一頁全部的戲，所以它是動畫，不是一行字。
  var healKey = '', healTimer = null;
  function healAnim() {
    var f = S.fightNow;
    var key = S.phase.id === 'fight' && f.revealed ? 'r' + f.round : '';
    if (key === healKey) return;
    healKey = key;
    clearTimeout(healTimer);
    if (!key) return;
    var fill = document.getElementById('hpfill');
    var num = document.getElementById('hpnum');
    if (!fill || !num) return;
    var hp = S.bossInfo.hp;
    var left = Math.max(1, hp - f.dmg);
    fill.style.width = Math.round(left / hp * 100) + '%';
    num.textContent = left + ' / ' + hp + '　（−' + f.dmg + '）';
    healTimer = setTimeout(function () {
      var fl = document.getElementById('hpfill');
      var nm = document.getElementById('hpnum');
      if (!fl || !nm) return;
      fl.style.width = '100%';
      nm.className = 'hpnum heal';
      nm.textContent = hp + ' / ' + hp + '　' + S.fight.heal;
    }, 1400);
  }

  function paint() {
    stage.className = 'stage phase-' + S.phase.id +
      (S.phase.id === 'cross' && (S.crossStep || 0) >= 2 ? ' dark' : '');
    stage.innerHTML = (views[S.phase.id] || function () { return ''; })();

    var qr = document.getElementById('qr');
    if (qr && ROOM) {
      try { QR.render(qr, joinUrl(), qrScale(7), '#161A18', '#ffffff'); } catch (err) {}
    }
    healKey = '';
    healAnim();
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
    show('cardsctl', S.phase.id === 'cards');
    show('bossctl', S.phase.id === 'boss');
    show('fightctl', S.phase.id === 'fight');
    show('crossctl', S.phase.id === 'cross');
    show('togetherctl', S.phase.id === 'together');
    show('wonctl', S.phase.id === 'won');

    if (S.phase.id === 'cards') {
      var cr = document.getElementById('creveal');
      cr.textContent = S.cardsNow.open ? '已經公布了' : '公布結果（' + S.stats.picked + '/' + S.stats.count + ' 已挑）';
      cr.disabled = S.cardsNow.open;
    }
    if (S.phase.id === 'boss') {
      var bm = document.getElementById('bmerge');
      bm.textContent = S.bossNow.merged ? '已經合體了' : '合體（前三名 → 大魔王）';
      bm.disabled = S.bossNow.merged;
    }
    if (S.phase.id === 'fight') {
      // 一顆按鈕按到底：還沒公布就是「公布結果」，公布過了才變「下一回合」。
      var f = S.fightNow;
      var last = f.round >= f.total - 1;
      document.getElementById('fprev').disabled = f.round <= 0;
      var fs = document.getElementById('fstep');
      fs.textContent = !f.revealed
        ? '公布結果（' + (f.round + 1) + '/' + f.total + '）'
        : (last ? '都打完了，按下一頁' : '下一回合 →（' + (f.round + 2) + '/' + f.total + '）');
      fs.disabled = f.revealed && last;
    }
    if (S.phase.id === 'cross') {
      var st = S.crossStep || 0;
      document.getElementById('cback').disabled = st <= 0;
      var cn = document.getElementById('cnext');
      var CROSS_LABELS = ['下一步（他走到最前面）', '下一步（三天）', '下一步（復活）', '走完了，按下一頁'];
      cn.textContent = CROSS_LABELS[st];
      cn.disabled = st >= 3;
    }
    if (S.phase.id === 'together') {
      var t = S.togetherNow;
      var lastR = t.round >= t.total - 1;
      document.getElementById('tprev').disabled = t.round <= 0;
      var ts = document.getElementById('tstep');
      ts.textContent = !t.struck
        ? '出招（' + (t.round + 1) + '/' + t.total + '）'
        : (lastR ? '三回合都打完了，按下一頁' : '下一回合 →（' + (t.round + 2) + '/' + t.total + '）');
      ts.disabled = t.struck && lastR;
      var wa = document.getElementById('wonall');
      wa.textContent = t.energy.done ? '能量條滿了' : '全場得勝（' + t.energy.lit + '/' + t.energy.planned + '）';
      wa.disabled = t.energy.done;
    }
    if (S.phase.id === 'won') {
      document.getElementById('gopen').textContent = S.goodOpen ? '蓋回去' : '翻開「在耶穌基督裡的好」';
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
      if (cmd === 'cardsRedeal' && !confirm('重發三張困難卡？每個人的幸福指數會還原，重新洗一輪牌。')) return;
      if (cmd === 'fightRestart' && !confirm('第一回合整個重跑？每個人掉的分數會還原。')) return;
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
