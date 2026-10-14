/* The booth page: looks for a frad-booth container on this machine (localhost:8080) and, when
   it answers, shows the node's console, the nodes and the Ceph dashboard from it. */
(function () {
  var BASE = 'http://localhost:8080';
  var absent = document.getElementById('absent');
  var panes = document.getElementById('panes'), con = document.getElementById('console'), frame = document.getElementById('dashframe');
  var open = document.getElementById('open'), state = document.getElementById('state'), nodesEl = document.getElementById('nodes'), err = document.getElementById('err');
  var booth = false, ready = false, misses = 0, current = 'h1';
  var embed = false, probeFrame = null, probeTimer = null;   // can the dashboard live in a frame here? (frad #423)
  var IMAGE = 'ghcr.io/chienpanglee/frad-booth', TAG = '', CMD = '';   // booth.json names the current image; the run line pins its tag
  function setImage(image, tag) {
    IMAGE = image || IMAGE; TAG = tag || '';
    CMD = 'docker run --rm --pull always --device /dev/kvm --device /dev/net/tun --cap-add NET_ADMIN -p 8080:8080 ' + IMAGE + (TAG ? ':' + TAG : '');
  }
  setImage(IMAGE, '');
  var boot = document.getElementById('boot'), T = window.FRADTerm(boot, { keep: 20 }), copy = document.getElementById('copy');
  var login = document.getElementById('login'), paneTitle = document.getElementById('paneTitle');
  function waiting(text) { T.clear(); T.play([{ k: 'type', prompt: '$ ', s: CMD }, { k: 'note', s: '# ' + text }], null, true); }
  waiting('paste this into a terminal on this machine; this box becomes the console once the booth answers');
  timed('booth.json').then(function (r) { return r.json(); }).then(function (j) {
    setImage(j.image, j.tag);
    if (!booth) waiting('paste this into a terminal on this machine; this box becomes the console once the booth answers');
  }).catch(function () {});
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
  function split(on) {
    panes.classList.toggle('split', on);
    if (on && !frame.getAttribute('src')) frame.src = BASE + '/ceph/';
    if (!on) frame.removeAttribute('src');
  }
  // The dashboard's cookies are cross-site from this page. The booth's probe sets one with the
  // same attributes in a hidden frame and says whether the browser sent it back; no answer
  // (an older booth has no probe) means a tab.
  function setEmbed(v) { embed = v; open.title = v ? '' : 'Opens in a new tab: user admin, password admin'; }
  function unprobe() { if (probeTimer) clearTimeout(probeTimer); probeTimer = null; if (probeFrame) probeFrame.remove(); probeFrame = null; }
  function probe() {
    unprobe(); setEmbed(false);
    probeFrame = document.createElement('iframe'); probeFrame.hidden = true; probeFrame.title = 'cookie probe'; probeFrame.src = BASE + '/probe.html';
    document.body.appendChild(probeFrame);
    probeTimer = setTimeout(unprobe, 5000);
  }
  window.addEventListener('message', function (ev) {
    if (ev.origin !== BASE || !ev.data || ev.data.fradBooth !== 'probe') return;
    setEmbed(!!ev.data.cookies); unprobe();
  });
  function setBooth(on) {                     // the one box: the command to run, then the console it starts
    if (on === booth) return;
    booth = on;
    absent.hidden = on;
    boot.hidden = on; con.hidden = !on; copy.hidden = on && !stale; login.hidden = !on;
    ['reset', 'stop'].forEach(function (id) { document.getElementById(id).hidden = !on; });
    paneTitle.textContent = on ? 'Console' : 'Start the booth';
    if (on) { T.cancel(); con.src = BASE + '/console/'; probe(); }
    else { con.removeAttribute('src'); split(false); unprobe(); setEmbed(false); ready = false; stale = ''; resetting = 0; open.hidden = true; nodesEl.textContent = ''; state.textContent = 'no booth answered at localhost:8080 yet; this page keeps looking'; waiting('the booth went away; run it again and this box is its console'); }
  }
  var stale = '';                               // the running booth's image when it is not the one the site names
  function setStale(version) {                 // an image that reports no version predates this check: no verdict on it
    var v = version && TAG && version !== TAG ? version : '';
    if (v === stale) return;
    stale = v; copy.hidden = !v && booth;
    if (v) state.textContent = 'this booth runs an older image (' + v + '); End booth, then paste the line again';
  }
  function setReady(up) {
    if (up === ready) return;
    ready = up;
    open.hidden = !up;
    if (!stale && !resetting) state.textContent = up ? '' : 'the node is not reachable';
    if (!up) split(false);
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
      b.dataset.armed = '1'; b.textContent = label + '? press again'; setTimeout(function () { delete b.dataset.armed; b.textContent = label; }, 5000);
    });
  }
  twice(document.getElementById('remove'), 'Remove node', function () { api('DELETE', '/api/nodes/' + current).then(function () { current = 'h1'; }).catch(function (e) { err.textContent = e.message; }); });
  var resetting = 0, gone = false;             // after Reset: the console goes until the old h1 is gone and a new one answers
  twice(document.getElementById('reset'), 'Reset', function () {
    split(false); con.removeAttribute('src'); con.hidden = true; boot.hidden = false; resetting = Date.now(); gone = false;
    state.textContent = 'the booth is resetting'; waiting('every node goes, h1 comes back fresh from the gold; this box is its console again');
    api('POST', '/api/reset').then(function () { current = 'h1'; }).catch(function (e) { err.textContent = e.message; showConsole(''); });
  });
  function showConsole(text) { resetting = 0; ready = false; open.hidden = true; T.cancel(); boot.hidden = true; con.hidden = false; con.src = BASE + '/console/'; probe(); state.textContent = text; }
  function resetDone(j) {                       // the old h1 was seen gone (or 90 s passed) and an h1 is alive again
    var h1 = j.nodes.filter(function (n) { return n.name === 'h1' && n.alive; }).length;
    if (!h1) gone = true;
    if ((gone && h1) || Date.now() - resetting > 90000) showConsole('the node is booting');
  }
  var stopping = 0;                            // after Stop: the console goes at once, the booth is ignored until it is gone
  twice(document.getElementById('stop'), 'End booth', function () {
    api('POST', '/api/stop').catch(function () {});
    stopping = Date.now(); setBooth(false);
    state.textContent = 'the booth is stopping'; waiting('the booth is stopping; run it again and this box is its console');
  });
  (function poll() {
    timed(BASE + '/health').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json().catch(function () { return {}; }); })
      .then(function (h) {
        if (stopping && Date.now() - stopping < 90000) return;   // still the booth being stopped (or one that would not stop: 90 s)
        stopping = 0; setBooth(true); misses = 0; setStale(h.version);
      })
      .catch(function () { stopping = 0; if (++misses >= 2) setBooth(false); })
      .then(function () {
        if (!booth) return;
        return timed(BASE + '/ready', { method: 'HEAD' }).then(function (r) { setReady(r.ok); }, function () { setReady(false); })
          .then(function () { return api('GET', '/api/nodes').then(function (j) { drawNodes(j); if (resetting) resetDone(j); }).catch(function () {}); });
      })
      .then(function () { setTimeout(poll, 3000); }, function () { setTimeout(poll, 3000); });
  })();
  open.addEventListener('click', function () { if (embed) split(true); else window.open(BASE + '/ceph/', '_blank', 'noopener'); });
  document.getElementById('close').addEventListener('click', function () { split(false); });
  document.getElementById('tab').addEventListener('click', function () { window.open(BASE + '/ceph/', '_blank', 'noopener'); split(false); });
})();
