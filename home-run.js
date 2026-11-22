/* The homepage's recorded run (#2127): the head and tail of one recorded CLI run from
   examples-cli.js, prompts and NG marked, no replay. */
(function () {
  var pre = document.getElementById('home-run'), X = window.FRAD_EXAMPLES || {};
  var ex = pre && X[pre.dataset.example];
  if (!ex) return;
  var head = +pre.dataset.head, tail = +pre.dataset.tail, L = ex.lines;
  var lines = L.length > head + tail ? L.slice(0, head).concat(L.slice(-tail)) : L;
  lines.forEach(function (l, i) {
    if (i) pre.appendChild(document.createTextNode('\n'));
    var m = /^(\S+> )(.*)$/.exec(l);
    if (m) {
      var ps = document.createElement('span'); ps.className = 'ps'; ps.textContent = m[1]; pre.appendChild(ps);
      var b = document.createElement('b'); b.textContent = m[2]; pre.appendChild(b); return;
    }
    l.split(/(\bNG\b)/).forEach(function (t, j) {
      if (j % 2) { var ng = document.createElement('span'); ng.className = 'ng'; ng.textContent = t; pre.appendChild(ng); }
      else pre.appendChild(document.createTextNode(t));
    });
  });
  document.getElementById('home-run-date').textContent = ex.date;
})();
