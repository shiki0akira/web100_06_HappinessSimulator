// 像素插圖產生器。跑 `node tools/pixel-art.mjs` 會重畫站上所有的 SVG。
//
// 為什麼用產生器而不是直接畫 SVG：圖案在這裡是一格一格的字元圖，
// 改一個像素就是改一個字，比在 SVG 裡找 <rect> 好改太多了。
//
// 規則跟站上的視覺一樣：純方格、不抗鋸齒、不漸層。'.' 是透明，其他字母查 PAL。
import fs from 'fs';
import path from 'path';

const OUT = 'public/happiness/w1/art';
// 人生資產的圖示七關共用（第一關拍賣台上的東西、第二關要保住的三樣，是同一批），
// 所以它們住在 shared/art，不掛在任何一關底下。
const OUT_ASSETS = 'public/happiness/shared/art';

const PAL = {
  // 金
  G: '#F0C64B', S: '#C99B1C', o: '#7A5A0E',
  // 青
  C: '#54D6AF', c: '#2E8F76',
  // 橘紅
  R: '#FF8A4C', H: '#C4491A', h: '#FF6F43',
  // 灰白／暗
  W: '#B9C7C1', w: '#8A9C96', D: '#3A4A45',
  g: '#C99B1C', k: '#F3DCC0',   // 燈罩的暗面／膚色
  n: '#4A3220',                 // 深棕：頭髮和鬍子（第三關的那一位）
  d: '#2B3A36',                 // 黑影：亮底上夠深，暗底上還看得出輪廓（純黑會整個消失）
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

function write(name, viewBox, body, label, dir) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" shape-rendering="crispEdges"` +
    ` role="img" aria-label="${label}">${body}</svg>\n`;
  const out = dir || OUT;
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, name), svg);
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

// ── 人生資產：一樣一張 ──────────────────────────────────────────────────
// 第一關暗標和開標的時候擺在畫面右邊；第二關是「保住三樣」的選單和逐項揭曉。
// key 就是 w1-data.js 的 LOTS 和 w2-data.js 的 ASSETS 共用的那個 id。
const LOTS = {
  // 0 是試拍品：一看就知道不重要，正好用來讓大家按過一次
  0: ['一杯珍珠奶茶（試拍）', [
    '................',
    '..........CC....',
    '.........CC.....',
    '........CC......',
    '..WWWWWWWWWWWW..',
    '..WWWWWWWWWWWW..',
    '..WSSSSSSSSSSW..',
    '..WSSSSSSSSSSW..',
    '...WSSSSSSSSW...',
    '...WSDDSSDDSW...',
    '...WSDDSSDDSW...',
    '....WSDDDDSW....',
    '....WSDDDDSW....',
    '.....WWWWWW.....',
    '................',
    '................',
  ]],
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
  2: ['相愛的伴侶', [
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
  3: ['自由的時間', [
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
  4: ['被看見與肯定', [
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
  5: ['有成就感的工作', [
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
  6: ['家庭婚姻美滿', [
    '................',
    '................',
    '.......RR.......',
    '......RRRR......',
    '.....RRRRRR.....',
    '....RRRRRRRR....',
    '...RRRRRRRRRR...',
    '.RRRRRRRRRRRRRR.',
    '..RWWWWWWWWWWR..',
    '..RWWHHWWHHWWR..',
    '..RWHHHHHHHHWR..',
    '..RWWHHHHHHWWR..',
    '..RWWWHHHHWWWR..',
    '..RWWWWHHWWWWR..',
    '..RRRRRRRRRRRR..',
    '................',
  ]],
  7: ['每天睡眠都很好', [
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
  // 一面手鏡。第一關的拍賣標的和第二關貨架上的是同一樣東西。
  8: ['出眾的外貌', [
    '................',
    '................',
    '.....oooooo.....',
    '....oGGGGGGo....',
    '...oGkkkkkkGo...',
    '...oGkkkkkkGo...',
    '...oGkkkkkkGo...',
    '...oGkkkkkkGo...',
    '....oGGGGGGo....',
    '.....oooooo.....',
    '.......SS.......',
    '.......SS.......',
    '......SSSS......',
    '.....SSSSSS.....',
    '................',
    '................',
  ]],
  9: ['每天多三小時', [
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
  10: ['成為名人', [
    '................',
    '......GGGG......',
    '.....GGGGGG.....',
    '.....GGGGGG.....',
    '.....GGGGGG.....',
    '.....GGGGGG.....',
    '....G.GGGG.G....',
    '....G.GGGG.G....',
    '....GGGGGGGG....',
    '.......GG.......',
    '.......GG.......',
    '.......GG.......',
    '.....GGGGGG.....',
    '....GGGGGGGG....',
    '................',
    '................',
  ]],
  // 11 只有第二關用得到：第一關的規則是「不買就是財富」，錢不在標的裡。
  11: ['財富自由', COINS],
  // 買三送一的那一份。蓋著的時候是一個關著的寶箱，拆開之後蓋子打開、有光跑出來。
  gift: ['買三送一的那一份', [
    '................',
    '................',
    '....oooooooo....',
    '...oGGGGGGGGo...',
    '..oGGSSSSSSGGo..',
    '..oGGGGGGGGGGo..',
    '..oooooooooooo..',
    '..oGGGoooooGGo..',
    '..oGGGoSSSoGGo..',
    '..oGGGoooooGGo..',
    '..oGGGGGGGGGGo..',
    '..oGGGGGGGGGGo..',
    '..oooooooooooo..',
    '................',
    '................',
    '................',
  ]],
  'gift-open': ['生命', [
    '................',
    '.....C....C.....',
    '...oooooooooo...',
    '..oGGGGGGGGGGo..',
    '..oGSSSSSSSSGo..',
    '...oooooooooo...',
    '................',
    '.....C..C.C.....',
    '..oooooooooooo..',
    '..oGGGGGGGGGGo..',
    '..oGGGGGGGGGGo..',
    '..oGGGGGGGGGGo..',
    '..oooooooooooo..',
    '................',
    '................',
    '................',
  ]],
};

let n = 0;
for (const [id, [label, map]] of Object.entries(LOTS)) {
  write('asset-' + id + '.svg', '0 0 16 16', sprite(map, 0, 0), label, OUT_ASSETS);
  n++;
}
console.log('畫好了：standards.svg → ' + OUT + '；' + n + ' 張人生資產圖 → ' + OUT_ASSETS);

// ── 會動的共用插圖：領受經文、祝福禱告 ──────────────────────────────────
// 用 <img> 載入的 SVG 跑得動 CSS 動畫（跑不動 JS），所以動畫寫在 <style> 裡。
// 慢、小幅度、不閃 —— 這兩頁的畫面是要讓人安靜下來的，不是要抓注意力。
function animatedSvg(w, h, css, body, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges"` +
    ` role="img" aria-label="${label}"><style>${css}</style>${body}</svg>\n`;
}

{
  const OUT_SHARED = 'public/happiness/shared/art';
  fs.mkdirSync(OUT_SHARED, { recursive: true });

  // 領受經文：一顆心一格一格長出來，旁邊的光點慢慢眨
  const HEART = [
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
    '................',
  ];
  const HANDS = [
    '................',
    '................',
    '.......CC.......',
    '......CCCC......',
    '......CCCC......',
    '.....CCCCCC.....',
    '....CCCCCCCC....',
    '....CC.CC.CC....',
    '....CC.CC.CC....',
    '....CCCCCCCC....',
    '.....CCCCCC.....',
    '.....CCCCCC.....',
    '......CCCC......',
    '................',
    '................',
    '................',
  ];
  const spark = (x, y, d) =>
    `<g class="sp" style="animation-delay:${d}s">` +
    `<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL.G}"/>` +
    `<rect x="${x - 1}" y="${y + 1}" width="3" height="1" fill="${PAL.G}"/>` +
    `<rect x="${x}" y="${y + 2}" width="1" height="1" fill="${PAL.G}"/></g>`;

  const css =
    '.sp{animation:tw 2.6s steps(1) infinite}' +
    '@keyframes tw{0%,45%{opacity:.15}50%,95%{opacity:1}100%{opacity:.15}}' +
    '.beat{animation:bt 2.6s steps(1) infinite;transform-origin:16px 10px}' +
    '@keyframes bt{0%,70%{transform:translateY(0)}75%,85%{transform:translateY(-1px)}100%{transform:translateY(0)}}' +
    '.rise{animation:rs 3.4s steps(1) infinite}' +
    '@keyframes rs{0%{opacity:0;transform:translateY(2px)}25%{opacity:1}70%{opacity:1;transform:translateY(-3px)}100%{opacity:0;transform:translateY(-4px)}}';

  fs.writeFileSync(OUT_SHARED + '/verse.svg', animatedSvg(32, 18, css,
    `<g class="beat">${sprite(HEART, 8, 1)}</g>` + spark(2, 4, 0) + spark(27, 3, 0.9) + spark(4, 12, 1.7),
    '領受'));

  const drops = [ [10, 12, 0], [16, 13, 0.8], [22, 12, 1.6] ]
    .map(([x, y, d]) => `<g class="rise" style="animation-delay:${d}s">` +
      `<rect x="${x}" y="${y}" width="2" height="2" fill="${PAL.G}"/></g>`).join('');
  fs.writeFileSync(OUT_SHARED + '/prayer.svg', animatedSvg(32, 18, css,
    `<g class="beat">${sprite(HANDS, 8, 1)}</g>` + drops + spark(3, 5, 0.4) + spark(28, 6, 1.3),
    '禱告'));
  console.log('也畫了會動的：verse.svg／prayer.svg');
}

// ── 共用插圖：見證分享 ──────────────────────────────────────────────────
// 一張溫馨的圖，不是三個圖示排排站：一盞燈、圍成一圈坐著的人、幾顆飄起來的心。
// 格子比其他圖細（一個人 14 格高），放大到大螢幕上才看得出是「人在聽人講話」。
{
  const person = (shirt) => [
    '.....DDDD.....',
    '....DDDDDD....',
    '....DkkkkD....',
    '....DkkkkD....',
    '.....kkkk.....',
    '...' + shirt.repeat(8) + '...',
    '..' + shirt.repeat(10) + '..',
    '..' + shirt.repeat(10) + '..',
    '..' + shirt.repeat(10) + '..',
    '..' + shirt.repeat(3) + 'kk' + shirt.repeat(3) + '..',
    '..' + shirt.repeat(10) + '..',
    '...DDD..DDD...',
    '...DDD..DDD...',
    '..DDDD..DDDD..',
  ];
  const LAMP = [
    '...GGGGGG...',
    '..GGGGGGGG..',
    '.GGGGGGGGGG.',
    'GGGGGGGGGGGG',
    '.gggggggggg.',
    '.....DD.....',
    '.....DD.....',
    '.....DD.....',
    '.....DD.....',
    '.....DD.....',
    '.....DD.....',
    '.....DD.....',
    '...DDDDDD...',
    '..DDDDDDDD..',
  ];
  const HEART = [
    '.hh..hh.',
    'hhhhhhhh',
    'hhhhhhhh',
    '.HHHHHH.',
    '..HHHH..',
    '...HH...',
  ];

  const W = 78, H = 34;
  let body = '';
  // 地板：一條實線加上一排點點，像室內的地毯邊
  body += `<rect x="0" y="30" width="${W}" height="1" fill="${PAL.w}" opacity=".55"/>`;
  for (let x = 1; x < W; x += 3) body += `<rect x="${x}" y="32" width="2" height="1" fill="${PAL.C}" opacity=".35"/>`;
  // 燈：光用幾顆點點斜斜地灑出來就好。整片半透明的方塊在深色底上會變成一個灰盒子。
  [[4, 13], [8, 11], [12, 12], [16, 10], [20, 13]].forEach(([x, y]) => {
    body += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL.G}" opacity=".55"/>`;
  });
  body += sprite(LAMP, 6, 16);
  // 講的人在中間偏左，兩個人坐在旁邊聽
  body += sprite(person('R'), 24, 16);   // 講的人：暖橘
  body += sprite(person('C'), 42, 16);
  body += sprite(person('G'), 58, 16);
  // 對話框：講的人頭上
  body += `<rect x="24" y="4" width="20" height="9" fill="${PAL.C}"/>` +
          `<rect x="27" y="12" width="4" height="2" fill="${PAL.C}"/>` +
          sprite(HEART, 30, 5);
  // 飄起來的心和光點
  body += sprite(HEART, 50, 2) + sprite(HEART, 66, 7);
  [[20, 2], [52, 12], [72, 18]].forEach(([x, y]) => {
    body += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL.G}" opacity=".6"/>` +
            `<rect x="${x - 1}" y="${y + 1}" width="3" height="1" fill="${PAL.G}" opacity=".3"/>` +
            `<rect x="${x}" y="${y + 2}" width="1" height="1" fill="${PAL.G}" opacity=".6"/>`;
  });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges"` +
    ` role="img" aria-label="見證分享">${body}</svg>\n`;
  fs.mkdirSync('public/happiness/shared/art', { recursive: true });
  fs.writeFileSync('public/happiness/shared/art/testimony.svg', svg);
  console.log('見證分享重畫了（一張溫馨的場景）');
}

// ── 第三關：萬世巨星 ────────────────────────────────────────────────────
// 揭曉那一頁左邊那一張。一個完整的十字架立在後面，頭頂一盞聚光燈一閃一閃，
// 他站在十字架底下的光裡 —— 「我想向大家介紹這一位」那句話要有一個對象站在那裡。
//
// 形象照著參考圖走：長髮、**細細的一圈鬍子**（頭髮從兩側包到下巴收起來）、
// 白袍加一條紅色的斜披肩。
//
// 兩個踩過的坑：
//   1. 橫桿放在正中間 → 那是「＋」，不是十字架。橫桿要靠上面，頭頂留一段直柱。
//   2. 十字架用灰色又壓在光束裡 → 跟光糊成一根柱子。改成木頭色，而且整個十字架
//      要在他頭頂上方看得完整，他只擋住最底下那一段。
{
  const OUT_SHARED = 'public/happiness/shared/art';
  fs.mkdirSync(OUT_SHARED, { recursive: true });

  // 22 × 27。臉不畫五官細節 —— 放大到電視上，兩點眼睛比五官好看。
  // 鬍子：兩側的頭髮包下來，加上人中那一道和下巴那一片，中間留一格當嘴巴。
  // **中間那一格嘴巴不能省** —— 少了它整張臉下半部就是一坨咖啡色。
  const HIM = [
    '......................',
    '.......nnnnnnnn.......',
    '......nnnnnnnnnn......',
    '.....nnnnnnnnnnnn.....',
    '.....nnkkkkkkkknn.....',
    '.....nkkkkkkkkkkn.....',
    '.....nkkkkkkkkkkn.....',
    '.....nkkDkkkkDkkn.....',
    '.....nkkkkkkkkkkn.....',
    '.....nkknnnnnnkkn.....',
    '.....nnnnnkknnnnn.....',
    '......nnnnnnnnnn......',
    '.......nnnnnnnn.......',
    '........kkkkkk........',
    '....WWWWWWWWWWWWWW....',
    '...WWWWWWWWWWWWWWWW...',
    '.kkWWWWWWWWWWWWWWWWkk.',
    'kkkWWWWWWWWWWWWWWWWkkk',
    '.kkWWWWWWWWWWWWWWWWkk.',
    '...WWWWWWWWWWWWWWWW...',
    '...WWWWWWWWWWWWWWWW...',
    '...WWWWWWWWWWWWWWWW...',
    '...WWWWWWWWWWWWWWWW...',
    '...WWWWWWWWWWWWWWWW...',
    '..WWWWWWWWWWWWWWWWWW..',
    '..WWWWWWWWWWWWWWWWWW..',
    '..wwwwwwwwwwwwwwwwww..',
  ];
  HIM.forEach((r, y) => { if (r.length !== 22) throw new Error('第 ' + y + ' 列不是 22 格：' + r.length); });

  const W = 48, H = 58;
  const FX = 13, FY = 29;         // 他站的位置
  let body = '';

  // 聚光燈的燈罩
  body += `<rect x="21" y="0" width="6" height="2" fill="${PAL.D}"/>`;
  body += `<rect x="20" y="2" width="8" height="1" fill="${PAL.o}"/>`;
  body += `<rect x="21" y="3" width="6" height="1" fill="${PAL.G}"/>`;

  // 光束：從燈口一路開到地上，越下面越寬也越淡。
  // **一定要開到地板** —— 只開到他頭上，那就不是光，是一頂帽子。
  // 整片半透明方塊在深色底上會變成灰盒子，所以用一條一條的橫格疊出來。
  let beam = '';
  for (let y = 4; y <= 54; y++) {
    const k = (y - 4) / 50;
    const w = 5 + k * 34;
    const x = 24 - w / 2;
    const op = (0.30 - k * 0.22).toFixed(3);
    beam += `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="1" fill="${PAL.G}" opacity="${op}"/>`;
  }
  body += `<g class="beam">${beam}</g>`;

  // 十字架。**木頭色，畫在光束前面、他後面。**
  // 用灰色會跟光束糊成一根柱子；木頭色在亮底上是深的，在光束裡是剪影，兩種主題都立得起來。
  // 比例：直柱 y=6–48、橫桿壓在 y=16–20 —— 頭頂上面那一段留長，才是十字架不是加號。
  const wood = PAL.n, edge = PAL.o;
  body += `<rect x="22" y="6" width="4" height="42" fill="${wood}"/>`;
  body += `<rect x="8" y="16" width="32" height="4" fill="${wood}"/>`;
  // 上緣和左緣打一道亮邊，深色主題上才不會整根消失
  body += `<rect x="22" y="6" width="4" height="1" fill="${edge}"/>`;
  body += `<rect x="8" y="16" width="32" height="1" fill="${edge}"/>`;
  body += `<rect x="22" y="20" width="1" height="28" fill="${edge}" opacity=".55"/>`;

  // 他站在光裡。**畫在最前面** —— 他只擋住十字架最底下那一段。
  body += sprite(HIM, FX, FY);

  // 紅色的斜披肩：從左肩斜到右腰。用畫的，不寫進字元圖 ——
  // 斜線在字元圖裡要一格一格對，改一次就要重數一次。
  for (let i = 0; i < 9; i++) {
    body += `<rect x="${FX + 5 + i}" y="${FY + 15 + i}" width="2" height="1" fill="${PAL.H}"/>`;
  }

  // 地板 ＋ 光落在地上的一圈
  body += `<rect x="11" y="56" width="26" height="1" fill="${PAL.G}" opacity=".28"/>`;
  body += `<rect x="4" y="57" width="40" height="1" fill="${PAL.w}" opacity=".45"/>`;

  // 兩側的星星，跟著光一起眨
  const star = (x, y, d) =>
    `<g class="tw" style="animation-delay:${d}s">` +
    `<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL.G}"/>` +
    `<rect x="${x - 1}" y="${y + 1}" width="3" height="1" fill="${PAL.G}"/>` +
    `<rect x="${x}" y="${y + 2}" width="1" height="1" fill="${PAL.G}"/></g>`;
  body += star(4, 10, 0) + star(43, 12, 0.7) + star(3, 38, 1.4) + star(44, 42, 2.1);

  // 一閃一閃：硬切，不做淡入淡出 —— 這一套視覺沒有漸層。
  const css =
    '.beam{animation:sp 1.8s steps(1) infinite}' +
    '@keyframes sp{0%,49%{opacity:.55}50%,99%{opacity:1}100%{opacity:.55}}' +
    '.tw{animation:tk 2.4s steps(1) infinite}' +
    '@keyframes tk{0%,45%{opacity:.15}50%,95%{opacity:1}100%{opacity:.15}}';

  fs.writeFileSync(OUT_SHARED + '/superstar.svg', animatedSvg(W, H, css, body, '萬世巨星'));
  console.log('第三關：superstar.svg（十字架下、聚光燈裡的他）');
}

// ── 第三關：聚光燈打在一個還看不清楚的人身上 ──────────────────────────
// 「我想先跟大家介紹一位萬世巨星」那一頁：**聚光燈一閃一閃的，台上是一個黑色的人影**。
// 沒有十字架、沒有星星、看不見他的臉 ——
// 這一頁的戲就是「燈已經打下去了，但你還看不出來他是誰」。
//
// 玩完八題、公布答案之後翻到下一頁：十字架出現、他的臉也出現。
// **兩張圖的人站在同一個位置**（FX/FY 一樣），所以翻頁的時候他不會跳。
{
  const OUT_SHARED = 'public/happiness/shared/art';
  const W = 48, H = 58;
  const FX = 13, FY = 29;
  let body = '';

  // 燈罩＋燈口。燈是開著的，所以燈口這一條是亮的。
  body += `<rect x="21" y="0" width="6" height="2" fill="${PAL.D}"/>`;
  body += `<rect x="20" y="2" width="8" height="1" fill="${PAL.o}"/>`;
  body += `<rect x="21" y="3" width="6" height="1" fill="${PAL.G}"/>`;

  // 光束：從燈口一路開到地上，越下面越寬也越淡。跟下一頁同一個算式 ——
  // **兩頁的光要疊得起來**，翻頁的時候只有十字架和他的臉會出現。
  let beam = '';
  for (let y = 4; y <= 54; y++) {
    const k = (y - 4) / 50;
    const w = 5 + k * 34;
    const x = 24 - w / 2;
    const op = (0.30 - k * 0.22).toFixed(3);
    beam += `<rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="1" fill="${PAL.G}" opacity="${op}"/>`;
  }
  body += `<g class="beam">${beam}</g>`;

  // 黑色的人影。用深板岩色不用純黑 ——
  // **純黑在深色主題上會整個消失**；這個顏色在亮底上夠深，在暗底上又還看得出輪廓。
  const SHADOW = [
    '......................',
    '.......dddddddd.......',
    '......dddddddddd......',
    '.....dddddddddddd.....',
    '.....dddddddddddd.....',
    '.....dddddddddddd.....',
    '.....dddddddddddd.....',
    '.....dddddddddddd.....',
    '.....dddddddddddd.....',
    '.....dddddddddddd.....',
    '.....dddddddddddd.....',
    '......dddddddddd......',
    '.......dddddddd.......',
    '........dddddd........',
    '....dddddddddddddd....',
    '...dddddddddddddddd...',
    '.dddddddddddddddddddd.',
    'dddddddddddddddddddddd',
    '.dddddddddddddddddddd.',
    '...dddddddddddddddd...',
    '...dddddddddddddddd...',
    '...dddddddddddddddd...',
    '...dddddddddddddddd...',
    '...dddddddddddddddd...',
    '..dddddddddddddddddd..',
    '..dddddddddddddddddd..',
    '..dddddddddddddddddd..',
  ];
  SHADOW.forEach((r, y) => { if (r.length !== 22) throw new Error('第 ' + y + ' 列不是 22 格：' + r.length); });
  body += sprite(SHADOW, FX, FY);

  // 地板 ＋ 光落在地上的一圈
  body += `<rect x="11" y="56" width="26" height="1" fill="${PAL.G}" opacity=".28"/>`;
  body += `<rect x="4" y="57" width="40" height="1" fill="${PAL.w}" opacity=".4"/>`;

  // 一閃一閃：硬切，不做淡入淡出 —— 這一套視覺沒有漸層。
  // **比下一頁閃得更明顯**（0.25 ↔ 1，而且快一點）：這一頁的燈還在找人，
  // 下一頁的燈已經找到他了，所以下一頁只是微微呼吸。
  const css =
    '.beam{animation:sp0 1.1s steps(1) infinite}' +
    '@keyframes sp0{0%,44%{opacity:.25}45%,89%{opacity:1}90%,100%{opacity:.6}}';

  fs.writeFileSync(OUT_SHARED + '/superstar-empty.svg', animatedSvg(W, H, css, body, '聚光燈下還看不清楚的人'));
  console.log('第三關：superstar-empty.svg（聚光燈一閃一閃，台上一個黑影）');
}

// ── 第三關第 14 頁：三個關卡的小插畫 ──────────────────────────────────
// 「藉著他到父那裡去」那一頁排成 RPG 的關卡地圖：三個節點、中間有路連起來。
// 一格一個東西，**不要畫成一個場景** —— 2–4 公尺外只看得出「一個東西」，
// 場景裡的細節（誰站在哪裡、地上有沒有裂縫）在那個尺寸下全部糊掉。
//
//   ① 鎖鏈：綁住我們的那個東西
//   ② 十字架：他替我們付的那個代價
//   ③ 天堂：門開著，光從裡面出來
//
// **三張的東西都置中、都佔差不多的高度**，橫著擺才不會一張大一張小。
{
  const OUT_SHARED = 'public/happiness/shared/art';
  const W = 32, H = 24;
  const box = (x, y, w, h, c) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;

  // 1 · 鎖鏈。五個環扣成一條，**深淺交錯**才看得出是一環一環的，不是一根管子。
  {
    const LINK = [
      '.WWWW.',
      'WW..WW',
      'WW..WW',
      'WW..WW',
      'WW..WW',
      '.WWWW.',
    ];
    const dim = LINK.map((r) => r.replace(/W/g, 'w'));
    let b = '';
    [1, 7, 13, 19, 25].forEach((x, i) => { b += sprite(i % 2 ? dim : LINK, x, 9); });
    // 環和環之間卡住的那一格
    [6, 12, 18, 24].forEach((x) => { b += box(x, 11, 1, 2, PAL.D); });
    write('quest-chain.svg', `0 0 ${W} ${H}`, b, '鎖鏈', OUT_SHARED);
  }

  // 2 · 十字架。木頭色，上緣和左緣打一道亮邊，深色主題上才不會整根消失。
  {
    let b = '';
    b += box(14, 2, 4, 20, PAL.n);      // 直柱
    b += box(8, 7, 16, 4, PAL.n);       // 橫桿
    b += box(14, 2, 4, 1, PAL.o);
    b += box(8, 7, 16, 1, PAL.o);
    b += box(14, 11, 1, 11, PAL.o);
    write('quest-cross.svg', `0 0 ${W} ${H}`, b, '十字架', OUT_SHARED);
  }

  // 3 · 天堂。一扇開著的金門，光從裡面出來，底下踩在雲上。
  {
    let b = '';
    // 門：上面是圓的，不是一個方盒子
    b += box(14, 2, 4, 1, PAL.G);
    b += box(12, 3, 8, 2, PAL.G);
    b += box(11, 5, 10, 16, PAL.G);
    // 門裡的光
    b += box(14, 4, 4, 1, PAL.k);
    b += box(13, 5, 6, 16, PAL.k);
    b += box(15, 3, 2, 1, PAL.k);
    // 灑出來的光
    [[8, 8], [8, 14], [22, 10], [22, 16]].forEach(([x, y]) => {
      b += box(x, y, 2, 1, PAL.G) + box(x - 2, y, 1, 1, PAL.S);
    });
    // 雲：門踩在上面。**整條要連起來** —— 中間斷掉會露出一塊黑，
    // 看起來像門底下破了一個洞。兩邊各鼓一包，才不會變成一塊木板。
    b += box(2, 20, 28, 3, PAL.W);
    b += box(4, 19, 6, 1, PAL.W) + box(22, 19, 6, 1, PAL.W);
    b += box(6, 18, 3, 1, PAL.W) + box(24, 18, 3, 1, PAL.W);
    b += box(2, 22, 28, 1, PAL.w);
    write('quest-heaven.svg', `0 0 ${W} ${H}`, b, '天堂的門', OUT_SHARED);
  }
  console.log('第三關：quest-chain／quest-cross／quest-heaven.svg（第 14 頁的三格）');
}

// ── 第六關「十字架的勝利」 ────────────────────────────────────────────────
// 大魔王「勞苦重擔」、碎掉的它、十字架的剪影、打開的墳墓，還有六個面向的小圖。
//
// ⚠️ **魔王不准畫成惡魔**：不准有角、不准有尾巴、不准冒火。
// 它是帳單、鬧鐘、公事包疊出來的一隻巨人 —— 看起來有點好笑、有點累。
// 可怕的地方不是長相，是它會一直回血。
{
  const OUT_SHARED = 'public/happiness/shared/art';
  const box = (x, y, w, h, c) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;

  // 1 · 勞苦重擔本體（32×32）
  {
    let b = '';
    b += box(4, 30, 24, 1, PAL.w);                       // 影子
    // 鬧鐘（頭）：兩顆鈴鐺 ＋ 圓臉 ＋ 指針
    b += box(11, 2, 2, 2, PAL.H) + box(19, 2, 2, 2, PAL.H);
    b += box(13, 3, 6, 1, PAL.W) + box(12, 4, 8, 6, PAL.W) + box(13, 10, 6, 1, PAL.W);
    b += box(12, 4, 8, 1, PAL.k);
    b += box(15, 6, 1, 3, PAL.D) + box(16, 7, 3, 1, PAL.D);
    // 帳單：從身體兩邊插出來
    b += box(6, 11, 7, 3, PAL.G) + box(6, 11, 7, 1, PAL.S);
    b += box(19, 10, 7, 4, PAL.G) + box(19, 10, 7, 1, PAL.S);
    // 公事包（身體）
    b += box(14, 11, 4, 1, PAL.D) + box(13, 12, 1, 2, PAL.D) + box(18, 12, 1, 2, PAL.D);
    b += box(5, 14, 22, 14, PAL.n) + box(5, 14, 22, 1, PAL.o);
    b += box(15, 21, 2, 2, PAL.o);                       // 鎖扣
    // 累的表情：眉毛垂下來、眼睛兩點、嘴巴一條
    b += box(10, 17, 4, 1, PAL.D) + box(18, 17, 4, 1, PAL.D);
    b += box(11, 19, 2, 2, PAL.D) + box(19, 19, 2, 2, PAL.D);
    b += box(13, 25, 6, 1, PAL.D);
    // 藥袋：卡在左邊
    b += box(2, 20, 3, 7, PAL.W) + box(2, 20, 3, 1, PAL.w);
    write('boss.svg', '0 0 32 32', b, '勞苦重擔', OUT_SHARED);
  }

  // 2 · 碎掉的它。同樣那幾樣東西，散在地上 —— **不要畫成屍體**，就是一堆東西掉下來。
  {
    let b = '';
    b += box(2, 30, 28, 1, PAL.w);
    b += box(3, 24, 9, 5, PAL.n) + box(3, 24, 9, 1, PAL.o);
    b += box(13, 26, 7, 3, PAL.n) + box(13, 26, 7, 1, PAL.o);
    b += box(21, 25, 8, 4, PAL.n) + box(21, 25, 8, 1, PAL.o);
    b += box(6, 20, 5, 4, PAL.W) + box(6, 20, 5, 1, PAL.k);   // 鬧鐘的一半
    b += box(23, 20, 4, 4, PAL.W) + box(23, 20, 4, 1, PAL.k);
    b += box(12, 21, 6, 2, PAL.G) + box(17, 18, 5, 2, PAL.G); // 飄下來的帳單
    b += box(9, 17, 2, 1, PAL.w) + box(20, 15, 2, 1, PAL.w);  // 灰塵
    write('boss-broken.svg', '0 0 32 32', b, '碎掉的勞苦重擔', OUT_SHARED);
  }

  // 3 · 十字架的剪影（暗場那一段）。**不准血腥** —— 只有一個形狀和一道光邊。
  {
    let b = '';
    b += box(14, 3, 4, 24, PAL.d) + box(8, 9, 16, 4, PAL.d);
    b += box(14, 3, 4, 1, PAL.o) + box(8, 9, 16, 1, PAL.o) + box(14, 13, 1, 14, PAL.o);
    b += box(6, 28, 20, 1, PAL.D);
    write('cross-dark.svg', '0 0 32 32', b, '十字架的剪影', OUT_SHARED);
  }

  // 4 · 打開的墳墓：石頭滾到旁邊，光從裡面出來。
  {
    let b = '';
    b += box(2, 2, 28, 20, PAL.w) + box(2, 2, 28, 2, PAL.D);   // 石壁
    b += box(9, 8, 11, 14, PAL.D);                              // 洞口
    b += box(10, 7, 9, 1, PAL.D) + box(11, 6, 7, 1, PAL.D);
    b += box(11, 10, 7, 12, PAL.k) + box(12, 8, 5, 2, PAL.k);   // 裡面的光
    b += box(13, 12, 3, 10, '#FFF4B8');
    b += box(21, 11, 8, 11, PAL.W) + box(22, 10, 6, 1, PAL.W);  // 滾開的石頭
    b += box(21, 20, 8, 2, PAL.w);
    [[7, 4], [12, 3], [17, 3], [22, 5]].forEach(([x, y]) => { b += box(x, y, 1, 1, PAL.G); });
    b += box(2, 22, 28, 1, PAL.w);
    write('tomb-open.svg', '0 0 32 24', b, '打開的墳墓', OUT_SHARED);
  }

  // 5 · 六個面向的小圖（16×16）。統計長條、魔王合體、玩家手機上的卡都用這一批。
  const ICONS = {
    // 財務：一枚有 S 記號的硬幣
    money: [
      '................',
      '................',
      '.....SSSSSS.....',
      '...SSGGGGGGSS...',
      '..SGGGGGGGGGGS..',
      '.SGGGGSSSSGGGGS.',
      '.SGGGGSGGGGGGGS.',
      '.SGGGGSSSSGGGGS.',
      '.SGGGGGGGGSGGGS.',
      '.SGGGGSSSSGGGGS.',
      '..SGGGGGGGGGGS..',
      '...SSGGGGGGSS...',
      '.....SSSSSS.....',
      '................',
      '................',
      '................',
    ],
    // 工作：公事包
    work: [
      '................',
      '................',
      '......DDDD......',
      '......D..D......',
      '..nnnnnnnnnnnn..',
      '..noooooooooon..',
      '..nnnnnnnnnnnn..',
      '..nnnnnoonnnnn..',
      '..nnnnnoonnnnn..',
      '..nnnnnnnnnnnn..',
      '..nnnnnnnnnnnn..',
      '..nnnnnnnnnnnn..',
      '................',
      '................',
      '................',
      '................',
    ],
    // 婚姻：兩個扣在一起的戒指
    married: [
      '................',
      '................',
      '................',
      '.....GG...GG....',
      '....G..G.G..G...',
      '...G....G....G..',
      '...G....G....G..',
      '...G....G....G..',
      '....G..G.G..G...',
      '.....GG...GG....',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    // 感情：一顆心
    love: [
      '................',
      '................',
      '...hh......hh...',
      '..hhhh....hhhh..',
      '.hhhhhh..hhhhhh.',
      '.hhhhhhhhhhhhhh.',
      '.hhhhhhhhhhhhhh.',
      '..hhhhhhhhhhhh..',
      '...hhhhhhhhhh...',
      '....hhhhhhhh....',
      '.....hhhhhh.....',
      '......hhhh......',
      '.......hh.......',
      '................',
      '................',
      '................',
    ],
    // 家庭：一間亮著燈的房子
    family: [
      '................',
      '.......HH.......',
      '......HHHH......',
      '.....HHHHHH.....',
      '....HHHHHHHH....',
      '...HHHHHHHHHH...',
      '..HHHHHHHHHHHH..',
      '..WWWWWWWWWWWW..',
      '..WWWWWWWWWWWW..',
      '..WWWWGGGGWWWW..',
      '..WWWWGGGGWWWW..',
      '..WWWWWWWWWWWW..',
      '..WWWWWWWWWWWW..',
      '................',
      '................',
      '................',
    ],
    // 健康：十字（不是宗教的十字架，是醫療的那一種）
    body: [
      '................',
      '................',
      '......CCCC......',
      '......CCCC......',
      '..CCCCCCCCCCCC..',
      '..CCCCCCCCCCCC..',
      '..CCCCCCCCCCCC..',
      '..CCCCCCCCCCCC..',
      '......CCCC......',
      '......CCCC......',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
  };
  const NAMES = { money: '財務', work: '工作', married: '婚姻', love: '感情', family: '家庭', body: '健康' };
  Object.keys(ICONS).forEach((k) => {
    write('aspect-' + k + '.svg', '0 0 16 16', sprite(ICONS[k], 0, 0), NAMES[k], OUT_SHARED);
  });

  console.log('第六關：boss／boss-broken／cross-dark／tomb-open ＋ 六個面向的小圖');
}

// ── 第六關的四個職業 ─────────────────────────────────────────────────────
// 騎士、法師、坦克、村民。**四個都是人**，不是怪物 ——
// 這一關的對手是勞苦重擔，不是彼此。
{
  const OUT_SHARED = 'public/happiness/shared/art';
  const JOBS = {
    // 騎士：頭盔 ＋ 劍。正面衝上去。
    knight: [
      '................',
      '.....WWWWWW.....',
      '....WWWWWWWW....',
      '....WWddddWW....',
      '....WW....WW....',
      '....WWdddWWW....',
      '.....WWWWWW.....',
      '...WWWWWWWWWW...',
      '..WWWWWWWWWWWW..',
      '..WW.WWWWWW.WW..',
      '..WW.WWWWWW.WW..',
      '.....WWWWWW.....',
      '.....WW..WW.....',
      '.....WW..WW.....',
      '....DDD..DDD....',
      '................',
    ],
    // 法師：尖帽 ＋ 一顆會發光的球。想辦法解決。
    mage: [
      '.......C........',
      '......CCC.......',
      '.....CCCCC......',
      '....CCCCCCC.....',
      '...CCCCCCCCC....',
      '......kkkk......',
      '.....kkkkkk.....',
      '.....kddkdk.....',
      '......kkkk......',
      '....cccccccc....',
      '...cccccccccc...',
      '..ccccccccccccG.',
      '..cc.cccccc.ccG.',
      '.....cccccc.....',
      '....DDD..DDD....',
      '................',
    ],
    // 坦克：一面大盾。硬扛下來。
    tank: [
      '................',
      '......kkkk......',
      '.....kkkkkk.....',
      '.....kddkdk.....',
      '......kkkk......',
      '..WWWWWWWWWWWW..',
      '.WWWWWWWWWWWWWW.',
      '.WWWWWwwwwWWWWW.',
      '.WWWWwwwwwwWWWW.',
      '.WWWWwwwwwwWWWW.',
      '.WWWWWwwwwWWWWW.',
      '..WWWWWWWWWWWW..',
      '...WWWWWWWWWW...',
      '.....WWWWWW.....',
      '....DDD..DDD....',
      '................',
    ],
    // 村民：草帽 ＋ 圍裙。你不是英雄，你只是想有人一起。
    villager: [
      '................',
      '....GGGGGGGG....',
      '...GGGGGGGGGG...',
      '......kkkk......',
      '.....kkkkkk.....',
      '.....kddkdk.....',
      '......kkkk......',
      '....hhhhhhhh....',
      '...hhhhhhhhhh...',
      '...hh.WWWW.hh...',
      '...hh.WWWW.hh...',
      '....hhWWWWhh....',
      '.....hhhhhh.....',
      '.....hh..hh.....',
      '....DDD..DDD....',
      '................',
    ],
  };
  const NAMES = { knight: '騎士', mage: '法師', tank: '坦克', villager: '村民' };
  Object.keys(JOBS).forEach((k) => {
    write('job-' + k + '.svg', '0 0 16 16', sprite(JOBS[k], 0, 0), NAMES[k], OUT_SHARED);
  });
  console.log('第六關：四個職業（騎士／法師／坦克／村民）');
}

// ── 第七關「釋放與自由」 ──────────────────────────────────────────────────
// 被綁住的小人（0–5 條鎖鏈）、閉上眼睛的小人、飛走的鳥、一截鎖鏈、天上的教會。
//
// ⚠️ 鎖鏈用**中灰和深灰交錯**：亮色主題的白底、暗色主題的深底都看得到。
// ⚠️ 天上的教會是**一群人，不掛名字、不照人數**。不准畫審判、不准畫地獄。
{
  const OUT_SHARED = 'public/happiness/shared/art';
  const box = (x, y, w, h, c) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  PAL.L = '#F7F4E8';   // 白袍
  PAL.y = '#FFF4B8';   // 門裡的光

  // 16 × 20 的一個人。eyes 換成閉著的就是最後一格那一張。
  const person = (closed) => [
    '......nnnn......',
    '.....nnnnnn.....',
    '.....kkkkkk.....',
    closed ? '.....ddkkdd.....' : '.....kdkkdk.....',
    '.....kkkkkk.....',
    '......kkkk......',
    '....CCCCCCCC....',
    '...CCCCCCCCCC...',
    '..kCCCCCCCCCCk..',
    '..kCCCCCCCCCCk..',
    '..kCCCCCCCCCCk..',
    '...CCCCCCCCCC...',
    '....CCCCCCCC....',
    '....CCCCCCCC....',
    '....cccccccc....',
    '.....cc..cc.....',
    '.....cc..cc.....',
    '.....cc..cc.....',
    '....DDD..DDD....',
    '................',
  ];

  // 一條鎖鏈橫過身體：一環三格，深淺交錯
  const band = (y) => {
    let b = '';
    for (let i = 0; i < 5; i++) {
      const x = 1 + i * 3;
      const c = i % 2 ? PAL.D : PAL.w;
      b += box(x, y, 3, 1, c) + box(x, y + 1, 1, 1, c) + box(x + 2, y + 1, 1, 1, c);
    }
    return b;
  };
  // 第幾條綁在哪裡：手臂、腿、腰、胸、脖子
  const BANDS = [9, 15, 12, 7, 5];
  for (let n = 0; n <= 5; n++) {
    let b = sprite(person(false), 0, 0);
    BANDS.slice(0, n).forEach((y) => { b += band(y); });
    write('bound-' + n + '.svg', '0 0 16 20', b, n ? '身上有 ' + n + ' 條鎖鏈的人' : '沒有鎖鏈的人', OUT_SHARED);
  }
  write('rest.svg', '0 0 16 20', sprite(person(true), 0, 0), '閉上眼睛的人', OUT_SHARED);

  // 一截鎖鏈（大螢幕上一個人一截）
  {
    const LINK = ['.wwww.', 'ww..ww', 'ww..ww', '.wwww.'];
    const DARK = LINK.map((r) => r.replace(/w/g, 'D'));
    write('chain-link.svg', '0 0 10 4', sprite(LINK, 0, 0) + sprite(DARK, 4, 0), '一截鎖鏈', OUT_SHARED);
  }

  // 飛走的鳥
  write('bird.svg', '0 0 9 5', sprite([
    'w.......w',
    'ww.....ww',
    '.ww...ww.',
    '..wwDww..',
    '....D....',
  ], 0, 0), '飛走的鳥', OUT_SHARED);

  // 天上的教會：門開著、光從裡面出來，耶穌站在門前，一群穿白衣的人圍著。
  // **一群人不掛名字**；門和光是第三關「到父那裡去」那一扇。
  {
    const W = 64, H = 40;
    let body = '';
    // 光：一圈一圈往外淡
    let glow = '';
    for (let r = 0; r < 6; r++) {
      glow += `<rect x="${24 - r * 4}" y="${2 + r}" width="${16 + r * 8}" height="${30 - r}" fill="${PAL.G}" opacity="${(0.22 - r * 0.03).toFixed(2)}"/>`;
    }
    body += `<g class="glow">${glow}</g>`;
    // 門（上緣是圓的）＋門裡的光
    body += box(29, 3, 6, 1, PAL.G) + box(27, 4, 10, 2, PAL.G) + box(26, 6, 12, 22, PAL.G);
    body += box(30, 5, 4, 1, PAL.y) + box(28, 6, 8, 22, PAL.y);
    // 門前的耶穌：長髮、白袍、紅色斜披肩
    const HIM = [
      '..nnnn..',
      '.nkkkkn.',
      '.nkdkdn.',
      '.nnkknn.',
      '..nnnn..',
      '.LLLLLL.',
      'kLLLLLLk',
      'kLLLLLLk',
      '.LLLLLL.',
      '.LLLLLL.',
      '.LLLLLL.',
      '.LLLLLL.',
      '.wwwwww.',
    ];
    body += sprite(HIM, 28, 17);
    for (let i = 0; i < 5; i++) body += box(29 + i, 22 + i, 1, 1, PAL.H);
    // 一群人：三排，越後面越小越淡。**舉起手的**跟**站著的**交錯。
    const small = (x, y, up) =>
      box(x + 1, y, 2, 2, PAL.k) + box(x, y + 2, 4, 5, PAL.L) + box(x, y + 7, 4, 1, PAL.w) +
      (up ? box(x - 1, y, 1, 3, PAL.k) + box(x + 4, y, 1, 3, PAL.k) : '');
    const crowd = [];
    [4, 11, 18, 41, 48, 55].forEach((x, i) => crowd.push([x, 22, i % 2 === 0]));
    [1, 8, 15, 21, 38, 44, 51, 58].forEach((x, i) => crowd.push([x, 29, i % 2 === 1]));
    let people = '';
    crowd.forEach(([x, y, up], i) => {
      people += `<g class="hop" style="animation-delay:${(i % 4) * 0.3}s">${small(x, y, up)}</g>`;
    });
    body += people;
    // 雲：大家踩在上面，整條連起來
    body += box(0, 37, 64, 3, PAL.W) + box(0, 39, 64, 1, PAL.w);
    body += box(6, 36, 10, 1, PAL.W) + box(26, 36, 12, 1, PAL.W) + box(48, 36, 10, 1, PAL.W);
    // 星星
    [[6, 6], [14, 12], [50, 8], [58, 14]].forEach(([x, y]) => {
      body += `<g class="tw">${box(x, y, 1, 1, PAL.G)}${box(x - 1, y + 1, 3, 1, PAL.G)}${box(x, y + 2, 1, 1, PAL.G)}</g>`;
    });
    const css =
      '.glow{animation:gl 2.4s steps(1) infinite}@keyframes gl{0%,49%{opacity:.75}50%,100%{opacity:1}}' +
      '.hop{animation:hop 1.6s steps(1) infinite}@keyframes hop{0%,49%{transform:translateY(0)}50%,100%{transform:translateY(-1px)}}' +
      '.tw{animation:tk 2s steps(1) infinite}@keyframes tk{0%,45%{opacity:.2}50%,100%{opacity:1}}' +
      '@media (prefers-reduced-motion:reduce){.glow,.hop,.tw{animation:none}}';
    fs.writeFileSync(OUT_SHARED + '/heaven-church.svg', animatedSvg(W, H, css, body, '天上的教會：門開著，一群穿白衣的人和耶穌在一起'));
  }
  console.log('第七關：bound-0～5／rest／chain-link／bird／heaven-church.svg');
}

// ── 第七關第 7 頁「因著信，得著真自由、真幸福」──────────────────────────────
// 一個人舉起雙手跳起來（教會投影片第 2、12 頁那張跳起來的照片），腳邊是斷掉的鎖鏈，
// 鳥從斷開的地方飛走（投影片第 10 頁）。**不畫十字架、不畫水** —— 這一頁講的是「信」，不是儀式。
{
  const OUT_SHARED = 'public/happiness/shared/art';
  const box = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  const W = 48, H = 32;
  const JUMP = [
    '.k............k.',
    '.C....nnnn....C.',
    '.C...nnnnnn...C.',
    '.CC..kkkkkk..CC.',
    '..C..kdkkdk..C..',
    '..CC.kkddkk.CC..',
    '...CC.kkkk.CC...',
    '....CCCCCCCC....',
    '....CCCCCCCC....',
    '....CCCCCCCC....',
    '....CCCCCCCC....',
    '....cccccccc....',
    '....cc....cc....',
    '...cc......cc...',
    '..cc........cc..',
    '.DDD........DDD.',
  ];
  JUMP.forEach((r, y) => { if (r.length !== 16) throw new Error('JUMP 第 ' + y + ' 列不是 16 格'); });
  let body = '';
  // 身後的光
  let glow = '';
  for (let r = 0; r < 5; r++) {
    glow += `<rect x="${18 - r * 3}" y="${2 + r}" width="${12 + r * 6}" height="${22 - r}" fill="${PAL.G}" opacity="${(0.2 - r * 0.035).toFixed(3)}"/>`;
  }
  body += `<g class="glow">${glow}</g>`;
  // 地面
  body += box(0, 29, W, 1, PAL.w) + box(0, 30, W, 2, PAL.W);
  // 斷掉的鎖鏈：左右各一截，斷口朝中間
  const LINK = ['.wwww.', 'ww..ww', 'ww..ww', '.wwww.'];
  const DARK = LINK.map((r) => r.replace(/w/g, 'D'));
  body += sprite(LINK, 2, 25) + sprite(DARK, 6, 25) + box(10, 26, 2, 2, PAL.w);
  body += box(36, 26, 2, 2, PAL.w) + sprite(DARK, 38, 25) + sprite(LINK, 42, 25);
  // 跳起來的人（離地一點）
  body += `<g class="jump">${sprite(JUMP, 16, 7)}</g>`;
  // 鳥：從斷口往上飛
  // 小小的鳥（5×3），離人遠一點，不要擋到他
  const BIRD = ['w...w', '.w.w.', '..D..'];
  [[4, 17, 0], [39, 16, 0.4], [7, 7, 0.8], [36, 5, 1.2], [42, 10, 0.6]].forEach(([x, y, d]) => {
    body += `<g class="fly" style="animation-delay:${d}s">${sprite(BIRD, x, y)}</g>`;
  });
  // 星星
  [[14, 3], [33, 20], [12, 21]].forEach(([x, y]) => {
    body += `<g class="tw">${box(x, y, 1, 1, PAL.G)}${box(x - 1, y + 1, 3, 1, PAL.G)}${box(x, y + 2, 1, 1, PAL.G)}</g>`;
  });
  const css =
    '.jump{animation:jp 1.2s steps(1) infinite}@keyframes jp{0%,49%{transform:translateY(0)}50%,100%{transform:translateY(-2px)}}' +
    '.fly{animation:fl 1.6s steps(1) infinite}@keyframes fl{0%,49%{transform:translateY(0)}50%,100%{transform:translateY(-1px)}}' +
    '.glow{animation:gl 2.4s steps(1) infinite}@keyframes gl{0%,49%{opacity:.75}50%,100%{opacity:1}}' +
    '.tw{animation:tk 2s steps(1) infinite}@keyframes tk{0%,45%{opacity:.2}50%,100%{opacity:1}}' +
    '@media (prefers-reduced-motion:reduce){.jump,.fly,.glow,.tw{animation:none}}';
  fs.writeFileSync(OUT_SHARED + '/faith-free.svg', animatedSvg(W, H, css, body, '一個人舉起雙手跳起來，腳邊的鎖鏈斷了，鳥飛走'));
  console.log('第七關：faith-free.svg（因著信，得著真自由）');
}
