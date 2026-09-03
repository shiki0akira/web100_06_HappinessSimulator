// 房間連線。七關共用。
// 房號放在查詢字串 ?room=XXXX —— QR code 掃進來就是這個網址。
(function (global) {
  'use strict';

  var CODE_RE = /^[A-HJ-NP-Z2-9]{4}$/;

  function connect(opts) {
    var role = opts.role === 'host' ? 'host' : 'player';
    var week = opts.week || 1;
    var code = opts.room;
    var pid = opts.pid || '';
    var fresh = !!opts.fresh;
    var ws = null;
    var closed = false;
    var backoff = 500;

    function url() {
      var proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      var q = '?room=' + encodeURIComponent(code) + '&role=' + role + '&week=' + week;
      if (pid) q += '&pid=' + encodeURIComponent(pid);
      if (fresh) q += '&fresh=1';
      return proto + '//' + location.host + '/ws' + q;
    }

    function open() {
      if (closed) return;
      ws = new WebSocket(url());

      ws.onopen = function () {
        backoff = 500;
        fresh = false;                      // 重連時不要再把房間清掉
        if (opts.onOpen) opts.onOpen();
      };

      ws.onmessage = function (ev) {
        var d;
        try { d = JSON.parse(ev.data); } catch (e) { return; }
        if (d.assigned) {
          pid = d.assigned;
          if (opts.onPid) opts.onPid(pid);
          return;
        }
        if (opts.onState) opts.onState(d);
      };

      ws.onclose = function () {
        if (closed) return;
        if (opts.onDrop) opts.onDrop();
        setTimeout(open, backoff);
        backoff = Math.min(backoff * 2, 5000);
      };

      ws.onerror = function () { try { ws.close(); } catch (e) {} };
    }

    function send(msg) {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
    }

    // 手機切回前景時，斷掉的連線立刻補回來，不用等退避計時
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && !closed && (!ws || ws.readyState > 1)) open();
    });

    open();

    return {
      send: send,
      join: function (name) { send({ t: 'join', name: name }); },
      action: function (type, extra) { send(Object.assign({ t: 'action', type: type }, extra || {})); },
      host: function (cmd, extra) { send(Object.assign({ t: 'host', cmd: cmd }, extra || {})); },
      pid: function () { return pid; },
      close: function () { closed = true; if (ws) ws.close(); },
    };
  }

  function readCode() {
    var c = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
    return CODE_RE.test(c) ? c : '';
  }

  global.Room = { connect: connect, readCode: readCode, CODE_RE: CODE_RE };
})(window);
