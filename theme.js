// The header's light/dark toggle (#2129). A first visit follows the system (prefers-color-scheme, site.css);
// a click sets data-theme on <html> and keeps the choice in localStorage "frad-theme", which the inline
// script in each page's head applies before the first paint. Without storage the choice lasts the page.
(function () {
  var root = document.documentElement, b = document.querySelector('.theme-toggle');
  if (!b) return;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  function cur() { return root.dataset.theme || (mq && mq.matches ? 'dark' : 'light'); }
  function show() {
    var next = cur() === 'dark' ? 'light' : 'dark';
    b.textContent = next === 'dark' ? 'Dark' : 'Light';
    b.setAttribute('aria-label', 'Switch to ' + next + ' mode');
  }
  b.addEventListener('click', function () {
    var t = cur() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = t;
    try { localStorage.setItem('frad-theme', t); } catch (e) { /* no storage: this page only */ }
    show();
  });
  if (mq && mq.addEventListener) mq.addEventListener('change', show);
  show();
  b.hidden = false;
})();
