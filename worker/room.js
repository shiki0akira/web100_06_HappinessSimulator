import { DurableObject } from 'cloudflare:workers';
import * as W1 from './w1-game.js';
import * as W2 from './w2-game.js';

// 七關共用同一個 class，用 week 決定套哪一關的規則。
// 加一關就是在這裡多一行。
const GAMES = { 1: W1, 2: W2 };

const CLEANUP_MS = 6 * 60 * 60 * 1000;   // 最後一個人離線六小時後，房間自己清空

// 一個房號一個 Room。狀態寫進 DO storage，是為了讓連線休眠後醒來還接得上，
// 不是為了保存 —— 沒人連著六小時就整個刪掉。
// 重擔的文字從來不會進到這裡：它留在玩家自己的手機上，
// 除非他親手按下「我願意分享」。
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.code = '';
    this.week = 1;
    this.state = null;
    ctx.blockConcurrencyWhile(async () => {
      this.week = (await ctx.storage.get('week')) || 1;
      this.code = (await ctx.storage.get('code')) || '';
      this.state = (await ctx.storage.get('state')) || null;
    });
  }

  // 房號已經把週次編進 DO 的名字裡（w2:ABCD），所以一個房間只會是一關
  get game() { return GAMES[this.week] || W1; }

  async fetch(request) {
    const url = new URL(request.url);
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 });
    }

    const role = url.searchParams.get('role') === 'host' ? 'host' : 'player';
    const pid = url.searchParams.get('pid') || '';
    const code = (url.searchParams.get('room') || '').toUpperCase();
    const week = Number(url.searchParams.get('week')) || 1;

    if (GAMES[week] && week !== this.week) {
      this.week = week;
      await this.ctx.storage.put('week', week);
      this.state = null;            // 換了關就換一套規則，舊狀態不能沿用
    }
    if (code && code !== this.code) {
      this.code = code;
      await this.ctx.storage.put('code', code);
    }

    // 主持人開新場：把舊的房間狀態清掉
    const fresh = role === 'host' && url.searchParams.get('fresh') === '1';
    if (!this.state || fresh) {
      this.state = this.game.createState();
      await this.save();
    }

    const pair = new WebSocketPair();
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    // 附加資料要序列化，休眠醒來後才知道這條連線是誰
    server.serializeAttachment({ role, pid: this.state.players[pid] ? pid : '' });
    server.send(JSON.stringify(this.viewFor({ role, pid })));

    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  viewFor(att) {
    return att.role === 'host'
      ? this.game.hostView(this.state, this.code)
      : this.game.playerView(this.state, att.pid, this.code);
  }

  broadcast() {
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(JSON.stringify(this.viewFor(ws.deserializeAttachment() || { role: 'player', pid: '' })));
      } catch (e) { /* 連線已斷，下一輪會被清掉 */ }
    }
  }

  async save() {
    await this.ctx.storage.put('state', this.state);
  }

  async schedule(at) {
    if (at) {
      this.state.cleanupAt = 0;
      await this.ctx.storage.setAlarm(at);
    }
  }

  async webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch (e) { return; }
    const att = ws.deserializeAttachment() || { role: 'player', pid: '' };
    const now = Date.now();
    let next = null;

    if (msg.t === 'join') {
      let pid = att.pid;
      if (!pid || !this.state.players[pid]) {
        pid = this.game.addPlayer(this.state, msg.name);
      } else if (msg.name) {
        this.state.players[pid].name = String(msg.name).slice(0, 12);
      }
      ws.serializeAttachment({ role: att.role, pid });
      ws.send(JSON.stringify({ assigned: pid }));
    } else if (msg.t === 'action') {
      if (!att.pid) return;
      // 玩家的動作也可能推進遊戲（例如全部人都出價了就直接開標），
      // 所以這裡也要收下一次鬧鐘的時間
      next = this.game.applyAction(this.state, att.pid, msg, now);
    } else if (msg.t === 'host') {
      if (att.role !== 'host') return;
      if (msg.cmd === 'reset') {
        this.state = this.game.createState();
        await this.ctx.storage.deleteAlarm();
      } else {
        next = this.game.applyHost(this.state, msg, now);
      }
    } else {
      return;
    }

    await this.save();
    await this.schedule(next);
    this.broadcast();
  }

  async webSocketClose(ws) {
    // 最後一個人離開就排清空
    if (this.ctx.getWebSockets().length <= 1) {
      this.state.cleanupAt = Date.now() + CLEANUP_MS;
      await this.save();
      const current = await this.ctx.storage.getAlarm();
      if (!current) await this.ctx.storage.setAlarm(this.state.cleanupAt);
    }
  }

  async alarm() {
    const now = Date.now();

    if (this.state.cleanupAt && now >= this.state.cleanupAt && this.ctx.getWebSockets().length === 0) {
      await this.ctx.storage.deleteAll();
      this.state = this.game.createState();
      return;
    }

    // 只有需要計時的關卡才有 onAlarm（第一關的拍賣）
    if (typeof this.game.onAlarm === 'function') {
      const next = this.game.onAlarm(this.state, now);
      await this.save();
      if (next) await this.ctx.storage.setAlarm(next);
      this.broadcast();
    }
  }
}
