// 極簡 QR 產生器：byte mode、錯誤更正 L、版本 1–6（單一區塊，不需交錯）。
// 只夠用來編一段區網網址；掃不出來時大螢幕上的網址仍然可以手動輸入。
(function (global) {
  'use strict';

  var CAP_BYTES   = [17, 32, 53, 78, 106, 134];   // v1..v6，byte mode 可放幾個位元組
  var DATA_CW     = [19, 34, 55, 80, 108, 136];   // 資料碼字數
  var EC_CW       = [7, 10, 15, 20, 26, 36];      // 錯誤更正碼字數
  var ALIGN_POS   = [null, 18, 22, 26, 30, 34];   // v2..v6 的單一校正圖形中心

  // 格式資訊（ECC = L，遮罩 0–7）直接查表，避免自己算 BCH 出錯
  var FORMAT_L = [
    '111011111000100', '111001011110011', '111110110101010', '111100010011101',
    '110011000101111', '110001100011000', '110110001000001', '110100101110110'
  ];

  // ── GF(256) ──────────────────────────────────────────────────────────
  var EXP = new Array(512), LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x; LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function gmul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  // 生成多項式，係數由高次到低次（poly[0] 是最高次項，永遠是 1）。
  // 順序很重要 —— rsEncode 是照這個順序取 gen[j+1] 的。排反了 EC 碼字會全錯，
  // 而且錯得很安靜：QR 畫得出來、看起來很正常，就是沒有任何掃描器讀得了。
  function rsGenerator(n) {
    var poly = [1];
    for (var i = 0; i < n; i++) {
      var next = new Array(poly.length + 1).fill(0);
      for (var j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];                      // 乘 x
        next[j + 1] ^= gmul(poly[j], EXP[i]);    // 乘 α^i
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecLen) {
    var gen = rsGenerator(ecLen);
    var res = new Array(ecLen).fill(0);
    for (var i = 0; i < data.length; i++) {
      var factor = data[i] ^ res[0];
      res.shift();
      res.push(0);
      for (var j = 0; j < ecLen; j++) res[j] ^= gmul(gen[j + 1], factor);
    }
    return res;
  }

  // ── 位元流 ───────────────────────────────────────────────────────────
  function utf8Bytes(str) {
    var out = [], enc = unescape(encodeURIComponent(str));
    for (var i = 0; i < enc.length; i++) out.push(enc.charCodeAt(i));
    return out;
  }

  function buildCodewords(bytes, version) {
    var total = DATA_CW[version - 1];
    var bits = [];
    function push(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); }
    push(0b0100, 4);          // byte mode
    push(bytes.length, 8);    // 版本 1–9 的位元組長度指示為 8 bits
    bytes.forEach(function (b) { push(b, 8); });
    for (var t = 0; t < 4 && bits.length < total * 8; t++) bits.push(0);   // 終止符
    while (bits.length % 8) bits.push(0);
    var cw = [];
    for (var i = 0; i < bits.length; i += 8) {
      var v = 0;
      for (var k = 0; k < 8; k++) v = (v << 1) | bits[i + k];
      cw.push(v);
    }
    var pad = [0xec, 0x11], pi = 0;
    while (cw.length < total) cw.push(pad[pi++ % 2]);
    return cw.concat(rsEncode(cw, EC_CW[version - 1]));
  }

  // ── 版面 ─────────────────────────────────────────────────────────────
  function blank(size) {
    var m = [], r = [];
    for (var i = 0; i < size; i++) { m.push(new Array(size).fill(null)); r.push(new Array(size).fill(false)); }
    return { m: m, reserved: r };
  }

  function placeFinder(g, row, col) {
    for (var r = -1; r <= 7; r++) {
      for (var c = -1; c <= 7; c++) {
        var rr = row + r, cc = col + c;
        if (rr < 0 || cc < 0 || rr >= g.m.length || cc >= g.m.length) continue;
        var on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                 (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                 (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        g.m[rr][cc] = on ? 1 : 0;
        g.reserved[rr][cc] = true;
      }
    }
  }

  function placeAlignment(g, cx, cy) {
    for (var r = -2; r <= 2; r++) {
      for (var c = -2; c <= 2; c++) {
        var on = Math.max(Math.abs(r), Math.abs(c)) !== 1;
        g.m[cy + r][cx + c] = on ? 1 : 0;
        g.reserved[cy + r][cx + c] = true;
      }
    }
  }

  function reserveFormat(g) {
    var size = g.m.length;
    for (var i = 0; i < 9; i++) {
      if (i !== 6) { g.reserved[8][i] = true; g.reserved[i][8] = true; }
    }
    g.reserved[8][8] = true;
    for (var k = 0; k < 8; k++) { g.reserved[size - 1 - k][8] = true; g.reserved[8][size - 1 - k] = true; }
  }

  function skeleton(version) {
    var size = 17 + version * 4;
    var g = blank(size);
    placeFinder(g, 0, 0);
    placeFinder(g, 0, size - 7);
    placeFinder(g, size - 7, 0);
    if (version >= 2) { var a = ALIGN_POS[version - 1]; placeAlignment(g, a, a); }
    for (var i = 8; i < size - 8; i++) {           // 時序圖形
      var v = i % 2 === 0 ? 1 : 0;
      g.m[6][i] = v; g.reserved[6][i] = true;
      g.m[i][6] = v; g.reserved[i][6] = true;
    }
    g.m[size - 8][8] = 1;                          // 固定為深色的模組
    g.reserved[size - 8][8] = true;
    reserveFormat(g);
    return g;
  }

  function maskFn(n, i, j) {
    switch (n) {
      case 0: return (i + j) % 2 === 0;
      case 1: return i % 2 === 0;
      case 2: return j % 3 === 0;
      case 3: return (i + j) % 3 === 0;
      case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
      case 5: return ((i * j) % 2) + ((i * j) % 3) === 0;
      case 6: return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
      default: return (((i + j) % 2) + ((i * j) % 3)) % 2 === 0;
    }
  }

  function placeData(g, codewords, mask) {
    var size = g.m.length, bitIdx = 0;
    var total = codewords.length * 8;
    var up = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col = 5;                       // 跳過時序欄
      for (var n = 0; n < size; n++) {
        var row = up ? size - 1 - n : n;
        for (var s = 0; s < 2; s++) {
          var c = col - s;
          if (g.reserved[row][c]) continue;
          var bit = 0;
          if (bitIdx < total) {
            bit = (codewords[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
            bitIdx++;
          }
          if (maskFn(mask, row, c)) bit ^= 1;
          g.m[row][c] = bit;
        }
      }
      up = !up;
    }
  }

  function placeFormat(g, mask) {
    var bits = FORMAT_L[mask].split('').map(Number);
    var size = g.m.length;
    for (var i = 0; i <= 5; i++) g.m[8][i] = bits[i];
    g.m[8][7] = bits[6];
    g.m[8][8] = bits[7];
    g.m[7][8] = bits[8];
    for (var k = 9; k <= 14; k++) g.m[14 - k][8] = bits[k];
    // 第二份：第 8 列的右邊八格放 bit 0–7，第 8 行的下面七格放 bit 8–14。
    // bits[0] 是最高位（bit 14），所以查表要用 14 - i。
    for (var a = 0; a <= 7; a++) g.m[8][size - 1 - a] = bits[14 - a];
    for (var b = 8; b <= 14; b++) g.m[size - 15 + b][8] = bits[14 - b];
    g.m[size - 8][8] = 1;
  }

  function penalty(m) {
    var size = m.length, score = 0, i, j;
    // 規則 1：連續同色
    function runs(get) {
      for (i = 0; i < size; i++) {
        var run = 1;
        for (j = 1; j < size; j++) {
          if (get(i, j) === get(i, j - 1)) { run++; }
          else { if (run >= 5) score += 3 + (run - 5); run = 1; }
        }
        if (run >= 5) score += 3 + (run - 5);
      }
    }
    runs(function (a, b) { return m[a][b]; });
    runs(function (a, b) { return m[b][a]; });
    // 規則 2：2×2 同色
    for (i = 0; i < size - 1; i++) {
      for (j = 0; j < size - 1; j++) {
        var v = m[i][j];
        if (v === m[i][j + 1] && v === m[i + 1][j] && v === m[i + 1][j + 1]) score += 3;
      }
    }
    // 規則 3：類似定位圖形的樣式
    var pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    var pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    function match(line, pat) {
      for (var k = 0; k < 11; k++) if (line[k] !== pat[k]) return false;
      return true;
    }
    for (i = 0; i < size; i++) {
      for (j = 0; j <= size - 11; j++) {
        var h = [], v2 = [];
        for (var k = 0; k < 11; k++) { h.push(m[i][j + k]); v2.push(m[j + k][i]); }
        if (match(h, pat1) || match(h, pat2)) score += 40;
        if (match(v2, pat1) || match(v2, pat2)) score += 40;
      }
    }
    // 規則 4：深色比例
    var dark = 0;
    for (i = 0; i < size; i++) for (j = 0; j < size; j++) dark += m[i][j];
    var pct = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return score;
  }

  function encode(text) {
    var bytes = utf8Bytes(text);
    var version = 0;
    for (var v = 1; v <= 6; v++) { if (bytes.length <= CAP_BYTES[v - 1]) { version = v; break; } }
    if (!version) throw new Error('QR: 網址太長');
    var codewords = buildCodewords(bytes, version);

    var best = null;
    for (var mask = 0; mask < 8; mask++) {
      var g = skeleton(version);
      placeData(g, codewords, mask);
      placeFormat(g, mask);
      var s = penalty(g.m);
      if (!best || s < best.score) best = { score: s, m: g.m };
    }
    return best.m;
  }

  // 畫成 <canvas>，quiet zone 4 個模組
  function render(canvas, text, pxPerModule, dark, light) {
    var m = encode(text);
    var size = m.length, q = 4, scale = pxPerModule || 6;
    var side = (size + q * 2) * scale;
    canvas.width = side; canvas.height = side;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = light || '#ffffff';
    ctx.fillRect(0, 0, side, side);
    ctx.fillStyle = dark || '#000000';
    for (var i = 0; i < size; i++) {
      for (var j = 0; j < size; j++) {
        if (m[i][j]) ctx.fillRect((j + q) * scale, (i + q) * scale, scale, scale);
      }
    }
    return canvas;
  }

  global.QR = { encode: encode, render: render };
})(window);
