// 週卡：畫成一張真正的圖片（1080 × 1440），手機長按才存得起來。像素風。
// 要改小組名稱改這一行就好。
var GROUP_NAME = '幸福小組';

(function (global) {
  'use strict';

  var SANS = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
  var PIXEL = '"Press Start 2P", ui-monospace, monospace';

  var INK = '#0E1512';
  var PAPER = '#F1F3EC';
  var ORANGE = '#C4491A';
  var GREEN = '#0B7A63';
  var GOLD = '#A8760B';
  var GREY = '#A8B5AD';

  function splitLines(ctx, text, maxWidth) {
    var out = [], line = '';
    for (var i = 0; i < text.length; i++) {
      var test = line + text[i];
      if (ctx.measureText(test).width > maxWidth && line) { out.push(line); line = text[i]; }
      else { line = test; }
    }
    if (line) out.push(line);
    return out;
  }

  // maxY 是這一塊最低能畫到哪一條基線。放不下的收成一個刪節號 ——
  // 寧可少一句話，也不要壓到頁尾的日期上面。
  function wrap(ctx, text, x, y, maxWidth, lineHeight, maxY) {
    var arr = splitLines(ctx, text, maxWidth);
    for (var i = 0; i < arr.length; i++) {
      var last = i === arr.length - 1;
      var noRoom = maxY && (y + lineHeight > maxY);
      ctx.fillText(!last && noRoom ? arr[i] + '…' : arr[i], x, y);
      y += lineHeight;
      if (!last && noRoom) break;
    }
    return y;
  }

  function today() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '.' + p(d.getMonth() + 1) + '.' + p(d.getDate());
  }

  // 一格一格的能量條
  function blocks(ctx, x, y, w, h, n, filled, color) {
    var gap = 6, bw = (w - gap * (n - 1)) / n;
    for (var i = 0; i < n; i++) {
      var bx = x + i * (bw + gap);
      ctx.fillStyle = i < filled ? color : PAPER;
      ctx.fillRect(bx, y, bw, h);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 4;
      ctx.strokeRect(bx + 2, y + 2, bw - 4, h - 4);
    }
  }

  // 點點分隔線
  function dots(ctx, x, y, w, color) {
    ctx.fillStyle = color;
    for (var i = 0; i < w; i += 16) ctx.fillRect(x + i, y, 8, 8);
  }

  // 每一關的封面字樣。加一關就在這裡多一行。
  var WEEKS = {
    1: { banner: 'W1  TRUE HAPPINESS', title: '真幸福' },
    2: { banner: 'W2  THE REVEAL',     title: '真相大白' },
    3: { banner: 'W3  SUPERSTAR',      title: '萬世巨星' },
    4: { banner: 'W4  CONNECTED',      title: '幸福連線' },
    5: { banner: 'W5  HE KNOCKS',      title: '當上帝來敲門' },
    6: { banner: 'W6  THE CROSS',      title: '十字架的勝利' },
    7: { banner: 'W7  SET FREE',       title: '釋放與自由' },
  };

  // data: { week, name, outer, outerPrev, inner, innerLabel, verseRef, verseText,
  //         burden, bought, listLabel, path: { label, steps: [] } }
  function drawWeekCard(canvas, data) {
    var W = 1080, H = 1440, M = 96, CW = W - M * 2;
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic';

    // 紙 + 外框
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, 20); ctx.fillRect(0, H - 20, W, 20);
    ctx.fillRect(0, 0, 20, H); ctx.fillRect(W - 20, 0, 20, H);
    // 角落的像素缺口
    ctx.fillRect(20, 20, 24, 24); ctx.fillRect(W - 44, 20, 24, 24);
    ctx.fillRect(20, H - 44, 24, 24); ctx.fillRect(W - 44, H - 44, 24, 24);

    var wk = WEEKS[data.week || 1] || WEEKS[1];

    // 頂部色帶
    ctx.fillStyle = INK;
    ctx.fillRect(M, 74, CW, 74);
    ctx.fillStyle = PAPER;
    ctx.font = '400 22px ' + PIXEL;
    ctx.fillText(wk.banner, M + 24, 122);

    var y = 254;
    ctx.fillStyle = INK;
    ctx.font = '900 88px ' + SANS;
    ctx.fillText(wk.title, M, y);

    // 幸福指數
    y += 74;
    ctx.fillStyle = GREEN;
    ctx.font = '400 20px ' + PIXEL;
    ctx.fillText('OUTER', M, y);
    ctx.fillStyle = INK;
    ctx.font = '700 26px ' + SANS;
    ctx.fillText('幸福指數', M + 108, y);
    ctx.fillStyle = ORANGE;
    ctx.font = '400 44px ' + PIXEL;
    ctx.textAlign = 'right';
    ctx.fillText(String(data.outer == null ? '--' : data.outer), W - M, y + 6);
    ctx.textAlign = 'left';
    // 落差要印出來 —— 第二關那張卡最有力的就是這個。
    // 放在標籤右邊，不要擠在數字旁邊：三位數會撞上去。
    if (data.outerPrev != null && data.outerPrev !== data.outer) {
      ctx.fillStyle = '#5C706A';
      ctx.font = '400 22px ' + PIXEL;
      ctx.fillText('上週 ' + data.outerPrev, M + 236, y);
    }
    y += 26;
    blocks(ctx, M, y, CW, 44, 10, Math.round((data.outer || 0) / 10), ORANGE);

    // 第二條。第一關印的是三個問號，但數字是真的 —— 第二關才正名。
    y += 84;
    var inner = data.inner || 0;
    ctx.fillStyle = GREEN;
    ctx.font = '400 20px ' + PIXEL;
    ctx.fillText('INNER', M, y);
    ctx.fillStyle = INK;
    ctx.font = '700 26px ' + SANS;
    ctx.fillText(data.innerLabel || '？？？', M + 108, y);
    ctx.fillStyle = GREEN;
    ctx.font = '400 44px ' + PIXEL;
    ctx.textAlign = 'right';
    ctx.fillText(String(inner), W - M, y + 6);
    ctx.textAlign = 'left';
    y += 26;
    blocks(ctx, M, y, CW, 44, 10, Math.round(inner / 10), GREEN);

    // 他在遊戲裡走的那條路。第三關的人生模擬器按了五下，
    // **那五下要留在卡片上** —— 隔週再看到這張卡，他想得起自己選了什麼。
    // 只佔一行，而且把底下經文前面那段留白吃掉一半，整張卡的長度不變。
    var hasPath = !!(data.path && data.path.steps && data.path.steps.length);
    if (hasPath) {
      y += 80;
      ctx.fillStyle = ORANGE;
      ctx.font = '400 18px ' + PIXEL;
      ctx.fillText(data.path.label || 'MY PATH', M, y);
      y += 40;
      var road = data.path.steps.join('  ›  ');
      ctx.fillStyle = INK;
      ctx.font = '700 ' + (road.length > 30 ? 26 : 30) + 'px ' + SANS;
      ctx.fillText(road, M, y);
    }

    // 經文（字要大，這是最可能被轉發出去的部分）
    y += hasPath ? 46 : 96;
    dots(ctx, M, y, CW, GREY);
    y += 70;
    ctx.fillStyle = GOLD;
    ctx.font = '400 22px ' + PIXEL;
    ctx.fillText(data.verseRef.replace(/\s+/g, ' '), M, y);
    y += 76;
    ctx.fillStyle = INK;
    ctx.font = '900 54px ' + SANS;
    y = wrap(ctx, '「' + data.verseText + '」', M, y, CW, 86);

    // 這一關他手上有什麼。第一關是買到的東西，第二關是他保住的三樣 ——
    // 標籤用 listLabel 換掉就好。
    if (data.bought && data.bought.length) {
      y += 54;
      ctx.fillStyle = GOLD;
      ctx.font = "400 18px " + PIXEL;
      ctx.fillText(data.listLabel || "I BOUGHT", M, y);
      y += 46;
      var list = data.bought.join("、");
      // 東西多的時候字級降一級，不然這一塊會把底下那句話擠掉
      var lsize = list.length > 24 ? 28 : 34;
      ctx.fillStyle = INK;
      ctx.font = "700 " + lsize + "px " + SANS;
      // 底下還要留給「他自己寫的那一句」，所以這一塊最多畫到這裡
      y = wrap(ctx, list, M, y, CW, Math.round(lsize * 1.5), H - M - 210);
    }

    // 他自己寫的那一句（整張卡最有重量的地方）
    if (data.burden) {
      y += 62;
      ctx.fillStyle = GREEN;
      ctx.fillRect(M, y - 34, 10, 44);
      ctx.font = '400 18px ' + PIXEL;
      ctx.fillText('MY LINE', M + 28, y);
      y += 58;
      var size = data.burden.length <= 24 ? 44 : data.burden.length <= 60 ? 36 : 30;
      ctx.fillStyle = INK;
      ctx.font = '700 ' + size + 'px ' + SANS;
      y = wrap(ctx, '「' + data.burden + '」', M, y, CW, Math.round(size * 1.68), H - M - 96);
    }

    // 頁尾
    dots(ctx, M, H - M - 74, CW, GREY);
    ctx.fillStyle = '#5C706A';
    ctx.font = '400 20px ' + PIXEL;
    ctx.fillText(today(), M, H - M);
    ctx.font = '700 24px ' + SANS;
    ctx.fillText('　' + GROUP_NAME, M + 200, H - M);
    if (data.name) {
      ctx.textAlign = 'right';
      ctx.font = '700 24px ' + SANS;
      ctx.fillText(data.name, W - M, H - M);
      ctx.textAlign = 'left';
    }
    return canvas;
  }

  global.drawWeekCard = drawWeekCard;
})(window);
