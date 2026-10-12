/* The booth page: looks for a frad-booth container on this machine (localhost:8080) and, when
   it answers, shows the node's console, the nodes and the Ceph dashboard from it. */
(function () {
  var BASE = 'http://localhost:8080';
  var absent = document.getElementById('absent'), present = document.getElementById('present'), absentState = document.getElementById('absentState');
  var panes = document.getElementById('panes'), con = document.getElementById('console'), frame = document.getElementById('dashframe');
  var open = document.getElementById('open'), state = document.getElementById('state'), nodesEl = document.getElementById('nodes'), err = document.getElementById('err');
  var booth = false, ready = false, misses = 0, current = 'h1';

  function timed(url, opts) {                   // a request that hangs is a failure too
    var ac = new AbortController(), t = setTimeout(function () { ac.abort(); }, 4000);
    opts = opts || {}; opts.signal = ac.signal; opts.cache = 'no-store';
    return fetch(url, opts).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }
  function api(method, path) {
    return timed(BASE + path, { method: method }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); });
  }
  function split(on) {
    panes.classList.toggle('split', on);
    if (on && !frame.getAttribute('src')) frame.src = BASE + '/ceph/';
    if (!on) frame.removeAttribute('src');
  }
  function setBooth(on) {
    if (on === booth) return;
    booth = on;
    absent.hidden = on; present.hidden = !on;
    if (on) { con.src = BASE + '/console/'; }
    else { con.removeAttribute('src'); split(false); ready = false; open.hidden = true; }
    absentState.textContent = on ? '' : 'no booth answered at localhost:8080 yet; this page keeps looking';
  }
  function setReady(up) {
    if (up === ready) return;
    ready = up;
    open.hidden = !up;
    state.textContent = up ? 'the node is up' : 'the node is not reachable';
    if (!up) split(false);
  }
  function drawNodes(j) {
    nodesEl.textContent = '';
    j.nodes.forEach(function (n) {
      var b = document.createElement('button'); b.className = n.name === current ? 'on' : ''; b.textContent = n.name + (n.alive ? '' : ' (off)');
      b.addEventListener('click', function () { api('POST', '/api/console/' + n.name).then(function () { current = n.name; drawNodes(j); }); });
      nodesEl.appendChild(b);
    });
    var add = document.createElement('button'); add.textContent = 'Add node';
    add.title = j.free_mb + ' MB free on this machine; a node takes ' + j.node_mb + ' MB';
    add.addEventListener('click', function () {
      add.disabled = true; err.textContent = '';
      api('POST', '/api/nodes').then(function (r) { current = r.name; return api('GET', '/api/nodes'); }).then(drawNodes)
        .catch(function (e) { err.textContent = e.message; add.disabled = false; });
    });
    nodesEl.appendChild(add);
  }
  (function poll() {
    timed(BASE + '/health').then(function (r) { if (!r.ok) throw new Error(r.status); setBooth(true); misses = 0; })
      .catch(function () { if (++misses >= 2) setBooth(false); })
      .then(function () {
        if (!booth) return;
        return timed(BASE + '/ready', { method: 'HEAD' }).then(function (r) { setReady(r.ok); }, function () { setReady(false); })
          .then(function () { return api('GET', '/api/nodes').then(drawNodes).catch(function () {}); });
      })
      .then(function () { setTimeout(poll, 3000); }, function () { setTimeout(poll, 3000); });
  })();
  open.addEventListener('click', function () { split(true); });
  document.getElementById('close').addEventListener('click', function () { split(false); });
})();
