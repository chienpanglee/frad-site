/* The tire of the logo rolls along the header: from its place at the top left to the left of the
   link that is clicked, then the link is followed. On a page whose link is current, the tire starts
   there. */
(function () {
  var home = document.querySelector('header.top .mark-svg');
  var links = Array.prototype.slice.call(document.querySelectorAll('header.top nav a'));
  if (!home) return;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ROLL = 900, SIZE = 28;
  var w = home.cloneNode(true), target = home, rot = 0, lastX = null, busy = null;
  w.removeAttribute('class'); w.id = 'wheel'; w.setAttribute('aria-hidden', 'true');
  document.body.appendChild(w); home.style.visibility = 'hidden';

  function spot(el) {                                   // where the tire sits: the mark's place, or the room a docked link makes at its left
    var r = el.getBoundingClientRect();
    return { x: r.left + SIZE / 2, y: r.top + r.height / 2 };
  }
  function place(animate) {
    links.forEach(function (a) { a.classList.toggle('docked', a === target); });   // the room first, then the measure
    var s = spot(target);
    if (lastX !== null && animate) {                   // one or two turns the way it travels, the F upright at rest
      var d = (s.x - lastX) / (Math.PI * SIZE);
      rot += (d < 0 ? -1 : 1) * Math.max(1, Math.min(2, Math.round(Math.abs(d)))) * 360;
    }
    lastX = s.x;
    w.style.transition = animate && !reduced ? 'transform ' + ROLL + 'ms cubic-bezier(.45, 0, .2, 1)' : 'none';
    w.style.transform = 'translate(' + (s.x - 14).toFixed(1) + 'px,' + (s.y - 14).toFixed(1) + 'px) rotate(' + rot + 'deg)';
  }
  function to(el, animate) { if (el !== target) { target = el; place(animate); } }
  function slotFor(url) {                             // the link whose target is this page and hash
    var here = location.pathname.replace(/^.*\//, '') || 'index.html';
    for (var i = 0; i < links.length; i++) {
      var u = new URL(links[i].getAttribute('href'), location.href), page = u.pathname.replace(/^.*\//, '') || 'index.html';
      if (page === here && (u.hash === url.hash || (!u.hash && !url.hash))) return links[i];
    }
    for (i = 0; i < links.length; i++) if (links[i].getAttribute('aria-current') === 'page' && !url.hash) return links[i];
    return home;
  }
  links.forEach(function (a) {
    a.addEventListener('click', function (ev) {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button) return;
      ev.preventDefault();
      var href = a.href;
      if (busy) clearTimeout(busy);
      to(a, true);
      busy = setTimeout(function () { busy = null; location.href = href; }, reduced ? 0 : ROLL + 80);
    });
  });
  var mark = home.closest('a');                        // the wordmark: back to the main page, the tire back to its place
  if (mark) mark.addEventListener('click', function (ev) {
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button) return;
    ev.preventDefault();
    var href = mark.href, same = new URL(href).pathname === location.pathname;
    if (busy) clearTimeout(busy);
    to(home, true);
    busy = setTimeout(function () {
      busy = null;
      if (!same) { location.href = href; return; }
      history.replaceState(null, '', location.pathname);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    }, reduced ? 0 : ROLL + 80);
  });
  window.addEventListener('hashchange', function () { if (!busy) to(slotFor(location), true); });
  window.addEventListener('scroll', function () { place(false); }, { passive: true });
  window.addEventListener('resize', function () { place(false); });
  target = slotFor(location);
  place(false);
})();
