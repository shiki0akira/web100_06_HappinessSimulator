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

    if (url.pathname === '/') {
      return Response.redirect(new URL('/happiness/zh-TW/', url).toString(), 302);
    }

    return env.ASSETS.fetch(request);
  },
};
