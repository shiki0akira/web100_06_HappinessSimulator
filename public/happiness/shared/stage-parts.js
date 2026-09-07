// 大螢幕上跨週共用的整頁元件。
//
// 每一關的畫面各寫各的（那是它自己的戲），但有幾頁七關長得一樣 ——
// 這種就放這裡，改一次七關都改到。
window.StageParts = {
  // 見證分享。主持人或組員站起來講自己的故事，畫面上不要有東西跟他搶注意力，
  // 所以只有一個標題、一句話、一張圖。
  testimony: function (opts) {
    opts = opts || {};
    var esc = function (s) {
      return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
      });
    };
    return '<h2>' + esc(opts.title || '見證分享') + '</h2>' +
      (opts.lede ? '<p class="lede">' + esc(opts.lede) + '</p>' : '') +
      '<div class="stageart"><img src="/happiness/shared/art/testimony.svg" alt=""></div>';
  },
};
