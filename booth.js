/* The booth page: looks for a frad-booth container on this machine (localhost:8080) and, when
   it answers, shows the node's console, the nodes and the Ceph dashboard from it. */
(function () {
  var BASE = 'http://localhost:8080';
  var absent = document.getElementById('absent');
  var con = document.getElementById('console');
  var open = document.getElementById('open'), state = document.getElementById('state'), nodesEl = document.getElementById('nodes'), err = document.getElementById('err');
  var booth = false, ready = false, misses = 0, current = 'h1';
  var CMD = 'docker run --rm --device /dev/kvm --device /dev/net/tun --cap-add NET_ADMIN -p 8080:8080 ghcr.io/chienpanglee/frad-booth';
  var boot = document.getElementById('boot'), T = window.FRADTerm(boot, { keep: 20 }), copy = document.getElementById('copy');
  var login = document.getElementById('login'), paneTitle = document.getElementById('paneTitle');
  function waiting(text) { T.clear(); T.play([{ k: 'type', prompt: '$ ', s: CMD }, { k: 'note', s: '# ' + text }], null, true); }
  waiting('paste this into a terminal on this machine; this box becomes the console once the booth answers');
  copy.addEventListener('click', function () {
    navigator.clipboard.writeText(CMD).then(function () { copy.textContent = 'Copied'; setTimeout(function () { copy.textContent = 'Copy the command'; }, 2000); }, function () { copy.textContent = 'Select it and copy'; });
  });

  function timed(url, opts) {                   // a request that hangs is a failure too
    var ac = new AbortController(), t = setTimeout(function () { ac.abort(); }, 4000);
    opts = opts || {}; opts.signal = ac.signal; opts.cache = 'no-store';
    return fetch(url, opts).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }
  function api(method, path) {
    return timed(BASE + path, { method: method }).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); });
  }
  function setBooth(on) {                     // the one box: the command to run, then the console it starts
    if (on === booth) return;
    booth = on;
    absent.hidden = on;
    boot.hidden = on; con.hidden = !on; copy.hidden = on; login.hidden = !on;
    ['reset', 'stop'].forEach(function (id) { document.getElementById(id).hidden = !on; });
    paneTitle.textContent = on ? 'Console' : 'Start the booth';
    if (on) { T.cancel(); con.src = BASE + '/console/'; }
    else { con.removeAttribute('src'); ready = false; open.hidden = true; nodesEl.textContent = ''; state.textContent = 'no booth answered at localhost:8080 yet; this page keeps looking'; waiting('the booth went away; run it again and this box is its console'); }
  }
  function setReady(up) {
    if (up === ready) return;
    ready = up;
    open.hidden = !up;
    state.textContent = up ? 'the node is up' : 'the node is not reachable';
  }
  function drawNodes(j) {
    if (j.current) current = j.current;          // the console is shared: what it shows is what the booth says
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
    document.getElementById('remove').hidden = current === 'h1';
  }
  // Clean-up: a node away, the session over from the gold, or the booth gone. Each asks twice.
  function twice(b, label, go) {
    b.addEventListener('click', function () {
      if (b.dataset.armed) { delete b.dataset.armed; b.textContent = label; go(); return; }
      b.dataset.armed = '1'; b.textContent = label + '?'; setTimeout(function () { delete b.dataset.armed; b.textContent = label; }, 5000);
    });
  }
  twice(document.getElementById('remove'), 'Remove node', function () { api('DELETE', '/api/nodes/' + current).then(function () { current = 'h1'; }).catch(function (e) { err.textContent = e.message; }); });
  twice(document.getElementById('reset'), 'Reset', function () { api('POST', '/api/reset').then(function () { current = 'h1'; }).catch(function (e) { err.textContent = e.message; }); });
  twice(document.getElementById('stop'), 'Stop the booth', function () { api('POST', '/api/stop').catch(function () {}); state.textContent = 'the booth is stopping'; });
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
  // Its own tab, not a pane: from this site an iframe is cross-site and the dashboard's SameSite
  // cookies are not sent after the login (frad #423).
  open.addEventListener('click', function () { window.open(BASE + '/ceph/', '_blank', 'noopener'); });
})();
