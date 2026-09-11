// 大螢幕上跨週共用的整頁元件。
//
// 每一關的畫面各寫各的（那是它自己的戲），但有幾頁七關長得一樣 ——
// 見證分享、領受經文、祝福禱告、儲存模擬回憶、下週預告。
// 這種就放這裡，改一次七關都改到。
window.StageParts = (function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // 「N / M 人已…」。每一頁的主持人都在等這個數字追平。
  function counter(done, total, unit) {
    return '<div class="big counter">' + (done || 0) +
      ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + (total || 0) + ' ' + unit + '</span></div>';
  }

  function art(file, cls) {
    return '<div class="stageart ' + (cls || '') + '"><img src="/happiness/shared/art/' + file + '" alt=""></div>';
  }

  return {
    // 接關。**第二關起每一關的開場都是這一頁**，所以放在這裡 ——
    // 改一次七關都改到，第四到七關直接呼叫就好。
    //
    // 畫面上只有三樣東西：標題、要他做什麼、幾個人接上了。
    // **不要數第一次來的人，也不要解釋他們拿到幾分** —— 那兩件事是寫給主持人看的，
    // 印在牆上就等於當著全場點名。它們在主持人備忘錄裡。
    reconnect: function (opts) {
      opts = opts || {};
      var all = (opts.total || 0) > 0 && (opts.done || 0) >= opts.total;
      // 第二條線的名字要傳進來：**第二關這一頁還沒替它命名**，那裡是「？？？」。
      // 命名是第二關後段的戲，接關頁提早講出來就把那一下劇透掉了。
      var inner = opts.innerLabel || '幸福根基';
      return '<h2>打開上一次的卡片</h2>' +
        '<p class="lede">把卡片上的<b>幸福指數</b>和<b>' + inner + '</b>打進去。</p>' +
        counter(opts.done, opts.total, '已接上') +
        (all ? '<div class="note" style="border-left-color:var(--root-c);color:var(--ink)">' +
          '<b>大家都好了</b></div>' : '');
    },

    // 見證分享。主持人或組員站起來講自己的故事，畫面上不要有東西跟他搶注意力。
    testimony: function (opts) {
      opts = opts || {};
      return '<h2>' + esc(opts.title || '見證分享') + '</h2>' +
        art('testimony.svg', 'wide');
    },

    // 領受經文。經文要占滿畫面，說明的話一句都不要 —— 那是主持人的工作。
    verse: function (opts) {
      opts = opts || {};
      return '<h2>領受經文</h2>' +
        '<div class="verse"><span class="ref">' + esc(opts.ref) + '</span>' +
          '<blockquote>「' + esc(opts.text) + '」</blockquote></div>' +
        '<div class="receive">' +
          art('verse.svg', 'small') +
          counter(opts.done, opts.total, '已領受') +
        '</div>';
    },

    // 祝福禱告。寫下來的東西不會上大螢幕 —— 一個字都不會。
    // 誰願意講，主持人自己在現場問。
    prayer: function (opts) {
      opts = opts || {};
      return '<h2>祝福禱告</h2>' +
        '<p class="lede">' + esc(opts.lede || '領受經文之後，你有什麼想法？寫下來。只有你自己看得到。') + '</p>' +
        '<div class="receive">' +
          art('prayer.svg', 'small') +
          counter(opts.done, opts.total, '已寫下') +
        '</div>';
    },

    // 儲存模擬回憶。卡片存在他自己的相簿裡，那是下一關的入場券。
    keepsake: function (opts) {
      opts = opts || {};
      return '<h2>儲存模擬回憶</h2>' +
        '<p class="lede">長按手機上的圖片存進相簿。這張卡是下一關的入場券。</p>' +
        counter(opts.done, opts.total, '已生成') +
        '<div class="note">卡片上有：這一週的經文、你的兩條指數' +
          (opts.extra ? '、' + esc(opts.extra) : '') + '。寫了心情的人也會印在上面。</div>';
    },

    // 下週預告。上面一排是今晚兩條線的全場平均，下面一整排是講下一關的。
    // 兩個平均並排就是這一關的縮影：一條被推來推去，一條只往上。
    nextWeek: function (opts) {
      opts = opts || {};
      var lines = opts.lines || [];
      // 一個平均 ＋ 底下一行「開場的那個數字 → 差多少」。
      // 那個起點就是他們今晚一進來自己打的，所以這一行是真的在跟上一次比。
      var stat = function (label, v, from, color) {
        var d = (v == null || from == null) ? null : v - from;
        return '<div class="col3"><h3>' + esc(label) + '</h3>' +
          '<div class="who" style="font-size:calc(56px * var(--u));color:' + color + '">' +
            (v == null ? '—' : v) + '</div>' +
          (d == null ? '' :
            '<p class="delta">' + esc(opts.fromLabel || '開場') + ' ' + from +
              '<b style="color:' + (d < 0 ? 'var(--vol)' : 'var(--root-c)') + '">' +
              (d > 0 ? '+' : d === 0 ? '±' : '') + d + '</b></p>') +
        '</div>';
      };
      return '<h2>下週預告</h2>' +
        '<span class="kicker" style="margin-top:10px">今晚全場平均</span>' +
        '<div class="cols3" style="grid-template-columns:1fr 1fr;margin-top:0">' +
          stat('幸福指數', opts.avg, opts.avgFrom, 'var(--vol)') +
          stat(opts.innerLabel || '幸福根基', opts.inner, opts.innerFrom, 'var(--root-c)') +
        '</div>' +
        '<div class="col3 nextbox" style="border-color:var(--gold)">' +
          '<h3 class="next">下一關 · ' + esc(opts.week || '') + '</h3>' +
          lines.map(function (l) {
            return '<p style="margin:8px 0 0;font-size:calc(18px * var(--u));color:var(--ink-2)">' + esc(l) + '</p>';
          }).join('') +
        '</div>';
    },
  };
})();
