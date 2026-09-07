// 淺／深色切換。大螢幕、玩家手機、主持人備忘錄共用這一支。
//
// 這支要放在 <head> 早一點跑：晚一步的話畫面會先閃一下另一個顏色，
// 投影出來的時候那一下很明顯。
//
// 沒選過就跟系統走（CSS 的 prefers-color-scheme）；選過之後就記在這支手機／
// 這台電腦上，之後每一關都照他的選擇來。
(function () {
  'use strict';
  var KEY = 'happiness_theme';
  var root = document.documentElement;

  function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function systemDark() {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }
  // 現在實際上是哪一個：自己選過就看 data-theme，沒選過就看系統
  function current() { return root.getAttribute('data-theme') || (systemDark() ? 'dark' : 'light'); }

  var saved = stored();
  if (saved === 'light' || saved === 'dark') root.setAttribute('data-theme', saved);

  // 鈕上寫的是「按下去會變成什麼」，不是現在是什麼
  function paint() {
    var next = current() === 'dark' ? 'light' : 'dark';
    var txt = next === 'dark' ? '☾ 深色' : '☀ 淺色';
    [].forEach.call(document.querySelectorAll('[data-theme-toggle]'), function (b) {
      b.textContent = txt;
      b.title = '切換成' + (next === 'dark' ? '深色' : '淺色') + '模式';
      b.setAttribute('aria-label', b.title);
    });
  }

  function toggle() {
    var next = current() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(KEY, next); } catch (e) {}
    paint();
  }

  window.Theme = { toggle: toggle, current: current };

  function wire() {
    [].forEach.call(document.querySelectorAll('[data-theme-toggle]'), function (b) {
      b.onclick = toggle;
    });
    paint();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire);
  else wire();

  // 還沒自己選過的話，系統換色它要跟著換
  var mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
  if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (!stored()) paint(); });
})();
