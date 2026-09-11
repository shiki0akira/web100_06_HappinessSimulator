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
// 揭曉那一頁左邊那一張。背後一個大十字架，頭頂一盞聚光燈一閃一閃，
// 他張開手站在光裡 —— 「我想向大家介紹這一位」那句話要有一個對象站在那裡。
//
// 形象照著參考圖走：長髮、**連成一圈的鬍子**（頭髮和鬍子接在一起，中間留一張臉）、
// 白袍加一條紅色的斜披肩、雙手張開。
{
  const OUT_SHARED = 'public/happiness/shared/art';
  fs.mkdirSync(OUT_SHARED, { recursive: true });

  // 22 × 28。臉不畫五官細節 —— 放大到電視上，兩點眼睛比五官好看。
  // 頭髮（n）從兩側一路包到下巴，就是那一圈鬍子；中間剩下的 k 才是臉。
  const HIM = [
    '......................',
    '.......nnnnnnnn.......',
    '......nnnnnnnnnn......',
    '.....nnnnnnnnnnnn.....',
    '.....nnnkkkkkknnn.....',
    '.....nnkkkkkkkknn.....',
    '.....nkkkkkkkkkkn.....',
    '.....nkkDkkkkDkkn.....',
    '.....nkkkkkkkkkkn.....',
    '.....nnkkkkkkkknn.....',
    '.....nnnkkkkkknnn.....',
    '......nnnkkkknnn......',
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
    '...WWWWWWWWWWWWWWWW...',
    '..WWWWWWWWWWWWWWWWWW..',
    '..WWWWWWWWWWWWWWWWWW..',
    '..wwwwwwwwwwwwwwwwww..',
  ];
  HIM.forEach((r, y) => { if (r.length !== 22) throw new Error('第 ' + y + ' 列不是 22 格：' + r.length); });

  const W = 48, H = 58;
  const FX = 13, FY = 24;         // 他站的位置
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

  // 十字架。**畫在光束前面、他後面** —— 畫在光束底下會被光洗掉，看起來像一根柱子。
  // 用中性的灰，深色和淺色主題都看得見。
  const cross = PAL.w;
  body += `<rect x="21" y="6" width="6" height="46" fill="${cross}" opacity=".7"/>`;
  body += `<rect x="5" y="26" width="38" height="6" fill="${cross}" opacity=".7"/>`;
  // 上緣壓一條深線，十字架在亮底上才不會糊掉
  body += `<rect x="21" y="6" width="6" height="1" fill="${PAL.D}" opacity=".45"/>`;
  body += `<rect x="5" y="26" width="38" height="1" fill="${PAL.D}" opacity=".45"/>`;

  // 他站在光裡。**畫在最前面** —— 光穿過他，十字架在他身後。
  body += sprite(HIM, FX, FY);

  // 紅色的斜披肩：從左肩斜到右腰。用畫的，不寫進字元圖 ——
  // 斜線在字元圖裡要一格一格對，改一次就要重數一次。
  for (let i = 0; i < 9; i++) {
    body += `<rect x="${FX + 5 + i}" y="${FY + 16 + i}" width="2" height="1" fill="${PAL.H}"/>`;
  }

  // 地板 ＋ 光落在地上的一圈
  body += `<rect x="10" y="53" width="28" height="1" fill="${PAL.G}" opacity=".28"/>`;
  body += `<rect x="4" y="55" width="40" height="1" fill="${PAL.w}" opacity=".45"/>`;

  // 兩側的星星，跟著光一起眨
  const star = (x, y, d) =>
    `<g class="tw" style="animation-delay:${d}s">` +
    `<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL.G}"/>` +
    `<rect x="${x - 1}" y="${y + 1}" width="3" height="1" fill="${PAL.G}"/>` +
    `<rect x="${x}" y="${y + 2}" width="1" height="1" fill="${PAL.G}"/></g>`;
  body += star(3, 12, 0) + star(44, 16, 0.7) + star(2, 40, 1.4) + star(45, 44, 2.1);

  // 一閃一閃：硬切，不做淡入淡出 —— 這一套視覺沒有漸層。
  const css =
    '.beam{animation:sp 1.8s steps(1) infinite}' +
    '@keyframes sp{0%,49%{opacity:.55}50%,99%{opacity:1}100%{opacity:.55}}' +
    '.tw{animation:tk 2.4s steps(1) infinite}' +
    '@keyframes tk{0%,45%{opacity:.15}50%,95%{opacity:1}100%{opacity:.15}}';

  fs.writeFileSync(OUT_SHARED + '/superstar.svg', animatedSvg(W, H, css, body, '萬世巨星'));
  console.log('第三關：superstar.svg（十字架前、聚光燈下的他）');
}
