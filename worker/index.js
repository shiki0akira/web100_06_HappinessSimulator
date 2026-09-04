export { Room } from './room.js';

// 房號用不會看錯的字：沒有 0/O、1/I
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;

function newCode() {
  let c = '';
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  for (let i = 0; i < 4; i++) c += ALPHABET[bytes[i] % ALPHABET.length];
  return c;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 開新房：主持人畫面載入時跟 Worker 要一個房號
    if (url.pathname === '/api/new-room') {
      return Response.json({ room: newCode() });
    }

    // 房間連線。room 決定連到哪一個 Durable Object，week 讓七關共用同一個 class。
    if (url.pathname === '/ws') {
      const code = (url.searchParams.get('room') || '').toUpperCase();
      const week = url.searchParams.get('week') || '1';
      if (!CODE_RE.test(code)) return new Response('bad room code', { status: 400 });
      const stub = env.ROOM.getByName('w' + week + ':' + code);
      return stub.fetch(request);
    }

    // 加入房間的短網址。大螢幕上印的是這個，QR 編的也是這個 ——
    // 越短的網址 QR 模組越大，隔著電視越好掃。
    //   /j            → 玩家頁，讓他手動輸入四碼房號
    //   /j?room=XXXX  → 直接進那一間
    //   /j?w=2        → 第二關（之後用）
    if (url.pathname === '/j') {
      const week = /^[1-7]$/.test(url.searchParams.get('w') || '') ? url.searchParams.get('w') : '1';
      const code = (url.searchParams.get('room') || '').toUpperCase();
      const to = new URL('/happiness/w' + week + '/zh-TW/p/', url);
      if (CODE_RE.test(code)) to.searchParams.set('room', code);
      return Response.redirect(to.toString(), 302);
    }

    // 最短的入場網址：/1 到 /7。大螢幕上印給人手動打字的就是這個 ——
    // 問號和等號在手機鍵盤上很難打，所以連 ?w= 都不要。
    //   /2            → 第二關的玩家頁，讓他輸入四碼房號
    //   /2?room=XXXX  → 直接進那一間
    if (/^\/[1-7]$/.test(url.pathname)) {
      const week = url.pathname.slice(1);
      const code = (url.searchParams.get('room') || '').toUpperCase();
      const to = new URL('/happiness/w' + week + '/zh-TW/p/', url);
      if (CODE_RE.test(code)) to.searchParams.set('room', code);
      return Response.redirect(to.toString(), 302);
    }

    // 主持人備忘錄的短網址。入場頁上那個小 QR 編的就是這個，
    // 掃不到的時候也打得出來（/h2 就是第二關）。
    //   /h2           → 第二關的備忘錄，讓他輸入四碼房號
    //   /h2?room=XXXX → 直接連上那一間，跟著大螢幕走
    if (url.pathname === '/h' || /^\/h[1-7]$/.test(url.pathname)) {
      const week = url.pathname.length > 2
        ? url.pathname.slice(2)
        : (/^[1-7]$/.test(url.searchParams.get('w') || '') ? url.searchParams.get('w') : '1');
      const code = (url.searchParams.get('room') || '').toUpperCase();
      const to = new URL('/happiness/w' + week + '/zh-TW/h/', url);
      if (CODE_RE.test(code)) to.searchParams.set('room', code);
      return Response.redirect(to.toString(), 302);
    }

    if (url.pathname === '/') {
      return Response.redirect(new URL('/happiness/zh-TW/', url).toString(), 302);
    }

    return env.ASSETS.fetch(request);
  },
};
