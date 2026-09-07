// 第一關的像素插圖產生器。跑 `node tools/pixel-art.mjs` 會重畫 public/happiness/w1/art/ 底下的 SVG。
//
// 為什麼用產生器而不是直接畫 SVG：圖案在這裡是一格一格的字元圖，
// 改一個像素就是改一個字，比在 SVG 裡找 <rect> 好改太多了。
//
// 規則跟站上的視覺一樣：純方格、不抗鋸齒、不漸層。'.' 是透明，其他字母查 PAL。
import fs from 'fs';
import path from 'path';

const OUT = 'public/happiness/w1/art';

const PAL = {
  // 金
  G: '#F0C64B', S: '#C99B1C', o: '#7A5A0E',
  // 青
  C: '#54D6AF', c: '#2E8F76',
  // 橘紅
  R: '#FF8A4C', H: '#C4491A', h: '#FF6F43',
  // 灰白／暗
  W: '#B9C7C1', w: '#8A9C96', D: '#3A4A45',
};

// 同一列同色併成一個 rect，檔案才不會長出幾百個節點
function sprite(map, ox, oy) {
  const out = [];
  map.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') { x++; continue; }
      if (!PAL[ch]) throw new Error('沒有這個顏色：' + ch);
      let w = 1;
      while (x + w < row.length && row[x + w] === ch) w++;
      out.push(`<rect x="${ox + x}" y="${oy + y}" width="${w}" height="1" fill="${PAL[ch]}"/>`);
      x += w;
    }
  });
  return out.join('');
}

function write(name, viewBox, body, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" shape-rendering="crispEdges"` +
    ` role="img" aria-label="${label}">${body}</svg>\n`;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, name), svg);
  return svg.length;
}

// ── 幸福的標準（第六頁的底圖）────────────────────────────────────────────
const COINS = [
  '................',
  '................',
  '..oooooooooo....',
  '..oGGGGGGGGo....',
  '..oSSSSSSSSo....',
  '...oooooooooo...',
  '...oGGGGGGGGo...',
  '...oSSSSSSSSo...',
  '..oooooooooo....',
  '..oGGGGGGGGo....',
  '..oSSSSSSSSo....',
  '...oooooooooo...',
  '...oGGGGGGGGo...',
  '...oSSSSSSSSo...',
  '...oooooooooo...',
  '................',
];
const CROWN = [
  '................',
  '................',
  '..C....CC....C..',
  '..C....CC....C..',
  '..CC..CCCC..CC..',
  '..CCC.CCCC.CCC..',
  '..CCCCCCCCCCCC..',
  '..CCCCCCCCCCCC..',
  '..CGGCCGGCCGGC..',
  '..CCCCCCCCCCCC..',
  '.CCCCCCCCCCCCCC.',
  '.CCCCCCCCCCCCCC.',
  '................',
  '................',
  '................',
  '................',
];
const HOUSE = [
  '................',
  '................',
  '.......RR.......',
  '......RRRR......',
  '.....RRRRRR.....',
  '....RRRRRRRR....',
  '...RRRRRRRRRR...',
  '.RRRRRRRRRRRRRR.',
  '..WWWWWWWWWWWW..',
  '..WWWHHWWHHWWW..',
  '..WWHHHHHHHHWW..',
  '..WWWHHHHHHWWW..',
  '..WWWWHHHHWWWW..',
  '..WWWWWHHWWWWW..',
  '..WWWWWWWWWWWW..',
  '................',
];

{
  // 寬 144：三個圖示的中心落在 16.7%／50%／83.3%，剛好對齊上面那三張卡
  const W = 144, H = 19;
  let deco = '';
  for (let x = 0; x < W; x += 2) deco += `<rect x="${x}" y="17" width="1" height="1" fill="${PAL.C}" opacity=".3"/>`;
  [[8, 3], [44, 5], [52, 2], [96, 4], [104, 8], [136, 6], [40, 12], [100, 13]].forEach(([x, y]) => {
    deco += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL.G}" opacity=".55"/>` +
            `<rect x="${x - 1}" y="${y + 1}" width="3" height="1" fill="${PAL.G}" opacity=".25"/>` +
            `<rect x="${x}" y="${y + 2}" width="1" height="1" fill="${PAL.G}" opacity=".55"/>`;
  });
  write('standards.svg', `0 0 ${W} ${H}`,
    deco + sprite(COINS, 16, 1) + sprite(CROWN, 64, 1) + sprite(HOUSE, 112, 1),
    '財富豐盛、名聲地位、家庭婚姻');
}

// ── 拍賣標的：一樣一張，暗標和開標的時候擺在畫面右邊 ────────────────────
// key 就是 LOTS 的 id（10 是「？」）
const LOTS = {
  1: ['健康的身體', [
    '................',
    '................',
    '................',
    '...hhh....hhh...',
    '..hhhhhhhhhhhh..',
    '..hhhhhhhhhhhh..',
    '..HHHHHHHHHHHH..',
    '...HHHHHHHHHH...',
    '....HHHHHHHH....',
    '.....HHHHHH.....',
    '......HHHH......',
    '.......HH.......',
    '................',
    '................',
    '................',
    '................',
  ]],
  2: ['一段不會走的關係', [
    '................',
    '................',
    '................',
    '..CC.......GG...',
    '..CC.......GG...',
    '.CCCC.....GGGG..',
    '.CCCCCCCCCGGGG..',
    '.CCCC.....GGGG..',
    '.CCCC.....GGGG..',
    '.CCCC.....GGGG..',
    '.CC.CC...GG.GG..',
    '.CC.CC...GG.GG..',
    '................',
    '................',
    '................',
    '................',
  ]],
  3: ['說走就走的自由', [
    '................',
    '.......cc.......',
    '.......cc.......',
    '......cccc......',
    '......cccc......',
    '..cccccccccccc..',
    '.cccccccccccccc.',
    '.cccccccccccccc.',
    '.......cc.......',
    '.......cc.......',
    '.....cccccc.....',
    '.....cccccc.....',
    '.......cc.......',
    '................',
    '................',
    '................',
  ]],
  4: ['被看見、被肯定', [
    '................',
    '................',
    '.......GG.......',
    '.......GG.......',
    '......GGGG......',
    '..GGGGGGGGGGGG..',
    '...GGGGGGGGGG...',
    '....GGGGGGGG....',
    '....GGGGGGGG....',
    '...GGGG..GGGG...',
    '..GGG......GGG..',
    '................',
    '................',
    '................',
    '................',
    '................',
  ]],
  5: ['一份有成就感的工作', [
    '................',
    '................',
    '.....DDDDDD.....',
    '.....D....D.....',
    '.WWWWWWWWWWWWWW.',
    '.WWWWWWWWWWWWWW.',
    '.WWWWWWWWWWWWWW.',
    '.WWWWWWGGWWWWWW.',
    '.WWWWWWGGWWWWWW.',
    '.WWWWWWWWWWWWWW.',
    '.WWWWWWWWWWWWWW.',
    '.wwwwwwwwwwwwww.',
    '................',
    '................',
    '................',
    '................',
  ]],
  6: ['孩子順利長大', [
    '................',
    '................',
    '................',
    '.....CC...CC....',
    '....CCCC.CCCC...',
    '....CCCC.CCCC...',
    '.....CCCcCCC....',
    '........c.......',
    '........c.......',
    '........c.......',
    '..DDDDDDDDDDDD..',
    '..DDDDDDDDDDDD..',
    '................',
    '................',
    '................',
    '................',
  ]],
  7: ['一夜好眠', [
    '................',
    '................',
    '......GGGG..WWW.',
    '....GGGGGG...W..',
    '...GGGG.....WWW.',
    '...GGG..........',
    '..GGG...........',
    '..GGG...........',
    '..GGG...........',
    '...GGG..........',
    '...GGGG.........',
    '....GGGGGG......',
    '......GGGG......',
    '................',
    '................',
    '................',
  ]],
  8: ['每天多三小時', [
    '................',
    '................',
    '......WWWW......',
    '....WWWWWWWW....',
    '...WWWWWWWWWW...',
    '..WWWWWDWWWWWW..',
    '..WWWWWDWWWWWW..',
    '..WWWWWDDDDWWW..',
    '..WWWWWWWWWWWW..',
    '..WWWWWWWWWWWW..',
    '...WWWWWWWWWW...',
    '....WWWWWWWW....',
    '......WWWW......',
    '................',
    '................',
    '................',
  ]],
  9: ['一個完全懂你的人', [
    '................',
    '................',
    '..WWWWWWWWWWWW..',
    '..WWWWWWWWWWWW..',
    '..WWWHHWWHHWWW..',
    '..WWHHHHHHHHWW..',
    '..WWWHHHHHHWWW..',
    '..WWWWHHHHWWWW..',
    '..WWWWWHHWWWWW..',
    '..WWWWWWWWWWWW..',
    '...WWW..........',
    '...WW...........',
    '................',
    '................',
    '................',
    '................',
  ]],
  10: ['？', [
    '................',
    '................',
    '..GGGGGGGGGGGG..',
    '..GGGGGGGGGGGG..',
    '..GGGGSSSSGGGG..',
    '..GGGSSGGSSGGG..',
    '..GGGGGGGSSGGG..',
    '..GGGGGGSSGGGG..',
    '..GGGGGSSGGGGG..',
    '..GGGGGSSGGGGG..',
    '..GGGGGGGGGGGG..',
    '..GGGGGSSGGGGG..',
    '..GGGGGGGGGGGG..',
    '..GGGGGGGGGGGG..',
    '................',
    '................',
  ]],
};

let n = 0;
for (const [id, [label, map]] of Object.entries(LOTS)) {
  write('lot-' + id + '.svg', '0 0 16 16', sprite(map, 0, 0), label);
  n++;
}
console.log('畫好了：standards.svg ＋ ' + n + ' 張標的圖 → ' + OUT);
