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
    return '<div class="big" style="margin-top:20px">' + (done || 0) +
      ' <span class="muted" style="font-size:calc(34px * var(--u))">/ ' + (total || 0) + ' ' + unit + '</span></div>';
  }

  function art(file, cls) {
    return '<div class="stageart ' + (cls || '') + '"><img src="/happiness/shared/art/' + file + '" alt=""></div>';
  }

  return {
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
          '<p class="mono muted" style="margin:0">已領受 ' + (opts.done || 0) + ' / ' + (opts.total || 0) + '</p>' +
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
          '<p class="mono muted" style="margin:0">已寫下 ' + (opts.done || 0) + ' / ' + (opts.total || 0) + '</p>' +
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

    // 下週預告。只留一個全場平均，其他都是講下一關的。
    nextWeek: function (opts) {
      opts = opts || {};
      var lines = opts.lines || [];
      return '<h2>下週預告</h2>' +
        '<div class="cols3" style="grid-template-columns:auto 2fr">' +
          '<div class="col3"><h3>今晚全場平均</h3>' +
            '<div class="who" style="font-size:calc(56px * var(--u))">' + (opts.avg == null ? '—' : opts.avg) + '</div></div>' +
          '<div class="col3" style="border-color:var(--gold)">' +
            '<h3 class="next">下一關 · ' + esc(opts.week || '') + '</h3>' +
            lines.map(function (l) {
              return '<p style="margin:8px 0 0;font-size:calc(18px * var(--u));color:var(--ink-2)">' + esc(l) + '</p>';
            }).join('') +
          '</div>' +
        '</div>';
    },
  };
})();
