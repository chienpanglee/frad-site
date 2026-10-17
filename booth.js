/* The booth page: looks for a frad-booth container on this machine (localhost:8080) and, when
   it answers, shows the node's console, the nodes and the Ceph dashboard from it. */
(function () {
  var BASE = 'http://localhost:8080';
  var absent = document.getElementById('absent');
  var panes = document.getElementById('panes'), con = document.getElementById('console'), frame = document.getElementById('dashframe');
  var open = document.getElementById('open'), state = document.getElementById('state'), nodesEl = document.getElementById('nodes'), err = document.getElementById('err');
  var booth = false, ready = false, misses = 0, current = 'h1', kvm = true, installed = false;
  var dl = document.getElementById('downloads'), dlist = document.getElementById('dlist'), dlnote = document.getElementById('dlnote'), dlrel = document.getElementById('dlrel');
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
  function api(method, path, body) {
    var o = { method: method };
    if (body) o.body = JSON.stringify(body);   // text/plain: a simple request, no preflight (booths up to 6de500a allow no Content-Type)
    return timed(BASE + path, o).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; }); });
  }
  // The flip: the dashboard fills the frame, or the console does. Flipping back keeps the
  // dashboard loaded (its login stays); a node going down or the booth going away unloads it.
  function split(on, keep) {
    panes.classList.toggle('split', on);
    if (on && !frame.getAttribute('src')) frame.src = BASE + '/ceph/';
    if (!on && !keep) frame.removeAttribute('src');
    paneTitle.textContent = on ? 'Dashboard' : booth ? 'Console' : 'Start the booth';
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
  // A fresh, empty console frame: removing only its src keeps the old ttyd page loaded, and an
  // older booth's ttyd then still asks "Leave site?" when the visitor leaves this page.
  function dropConsole() {
    var n = con.cloneNode(false); n.removeAttribute('src'); con.parentNode.replaceChild(n, con); con = n;
  }
  function setBooth(on) {                     // the one box: the command to run, then the console it starts
    if (on === booth) return;
    booth = on;
    absent.hidden = on;
    boot.hidden = on; con.hidden = !on; copy.hidden = on && !stale; login.hidden = !on;
    ['reset', 'stop'].forEach(function (id) { document.getElementById(id).hidden = !on; });
    paneTitle.textContent = on ? 'Console' : 'Start the booth';
    if (on) { T.cancel(); con.src = BASE + '/console/'; probe(); loadMedia(); state.textContent = ''; }
    else { dropConsole(); document.getElementById('remove').hidden = true; split(false); unprobe(); setEmbed(false); ready = false; stale = ''; resetting = 0; open.hidden = true; nodesEl.textContent = ''; state.textContent = 'no booth answered at localhost:8080 yet; this page keeps looking'; waiting('the booth went away; run it again and this box is its console'); dl.hidden = true; dlist.textContent = ''; }
  }
  // Without KVM the booth is a download server: the console pane goes, the downloads stay.
  function setKvm(on) {
    if (on === kvm) return;
    kvm = on; panes.hidden = !on;
    if (!on) state.textContent = '';
  }
  // What the image carries (/api/media): the ISO and, on a signed build, its evidence, as links to /dl/.
  function mb(n) { return n >= 1 << 30 ? (n / (1 << 30)).toFixed(2) + ' GB' : n >= 1 << 20 ? (n / (1 << 20)).toFixed(1) + ' MB' : (n / 1024).toFixed(0) + ' kB'; }
  function loadMedia() {
    api('GET', '/api/media').then(function (m) {
      dlist.textContent = '';
      m.files.forEach(function (f) {
        var li = document.createElement('li'), a = document.createElement('a'), s = document.createElement('span');
        a.href = BASE + '/dl/' + encodeURIComponent(f.name); a.textContent = f.name; a.setAttribute('download', f.name);
        s.className = 'muted'; s.textContent = mb(f.size) + (f.sha256 ? '  sha256 ' + f.sha256.slice(0, 12) + '…' : '');
        if (f.sha256) s.title = f.sha256;
        li.appendChild(a); li.appendChild(s); dlist.appendChild(li);
      });
      dlrel.textContent = m.release + (m.version ? ' (' + m.version + ')' : '');
      dlnote.innerHTML = m.signed
        ? 'The image is signed: check the ISO with <code>cosign verify-blob --key ' + m.release + '.cosign.pub --insecure-ignore-tlog --bundle ' + m.iso + '.bundle ' + m.iso + '</code>' + (m.howto ? ', or follow <a href="' + BASE + '/dl/' + m.howto + '">' + m.howto + '</a>' : '') + '. The same ISO installs from a CD or a USB stick.'
        : 'An unsigned development build (' + (m.version || m.release) + '): no bundle, no SBOM; the sha256 is what the image says it is. The same ISO installs from a CD or a USB stick.';
      dl.hidden = false;
    }).catch(function () { dl.hidden = true; });
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
    if (!stale && !resetting && installed) state.textContent = up ? '' : 'the node is not reachable';
    if (!up) split(false);
  }
  function button(label, on, go) {
    var b = document.createElement('button'); b.className = on ? 'on' : ''; b.textContent = label; b.addEventListener('click', go); nodesEl.appendChild(b); return b;
  }
  // Before the install: two buttons boot the image's ISO as a CD or a USB stick and the install runs
  // unattended in the console; the disk it writes is then booted by h1. After it: the nodes.
  function drawNodes(j) {
    if (j.current) current = j.current;          // the console is shared: what it shows is what the booth says
    var st = (j.install || {}).state || 'installed', cur = j.nodes.filter(function (n) { return n.name === current; })[0];
    nodeNames = j.nodes.map(function (n) { return n.name; });
    installed = st === 'installed';
    login.hidden = !cur;
    nodesEl.textContent = '';
    document.getElementById('remove').hidden = !cur;
    if (st !== 'installed') {
      if (st === 'installing' || st === 'booting') {
        if (!stale && !resetting) state.textContent = st === 'installing' ? 'installing from the ' + (j.install.media === 'usb' ? 'USB stick' : 'CD') + '; the node powers off when done' : 'h1 boots the installed disk for the first time';
      } else {
        ['iso', 'usb'].forEach(function (m) {
          button(m === 'iso' ? 'Install via CDROM' : 'Install via USB', false, function () {
            err.textContent = '';
            api('POST', '/api/install', { media: m }).then(function () { return api('GET', '/api/nodes'); }).then(drawNodes).catch(function (e) { err.textContent = e.message; });
          });
        });
        if (!stale && !resetting) state.textContent = st === 'failed' ? 'the install failed: ' + j.install.error : 'no node yet: install one from the image (' + (j.h1_mb || 6144) + ' MB of memory, a few minutes)';
      }
      return;
    }
    j.nodes.forEach(function (n) {
      var b = document.createElement('button'); b.className = n.name === current ? 'on' : ''; b.textContent = n.name + (n.alive ? '' : ' (off)');
      b.addEventListener('click', function () { api('POST', '/api/console/' + n.name).then(function () { current = n.name; drawNodes(j); }); });
      nodesEl.appendChild(b);
    });
    var add = button('Add node', false, function () {
      add.disabled = true; err.textContent = '';
      api('POST', '/api/nodes').then(function (r) { current = r.name; return api('GET', '/api/nodes'); }).then(drawNodes)
        .catch(function (e) { err.textContent = e.message; add.disabled = false; });
    });
    add.title = j.free_mb + ' MB free on this machine; a node takes ' + j.node_mb + ' MB';
    if (!stale && !resetting) state.textContent = '';   // installed: the install and boot notes go
  }
  // Clean-up: a node away, the session over from the gold, or the booth gone. Each asks twice.
  function twice(b, label, go, warn) {
    b.addEventListener('click', function () {
      if (b.dataset.armed) { delete b.dataset.armed; b.textContent = label; err.textContent = ''; go(); return; }
      var w = warn ? warn() : '';
      b.dataset.armed = '1'; b.textContent = label + '? press again'; err.textContent = w;
      setTimeout(function () { delete b.dataset.armed; b.textContent = label; if (w && err.textContent === w) err.textContent = ''; }, 5000);
    });
  }
  // h1 started the cluster: its only control node, monitor and VIP. Removing it while others run
  // leaves them without a cluster (no monitor, no dashboard); say so before the second press.
  var nodeNames = [];
  function removeWarning() {
    var others = nodeNames.filter(function (n) { return n !== current; });
    return current === 'h1' && others.length ? 'h1 holds the cluster (monitor, VIP, dashboard): ' + others.join(', ') + ' lose it; Reset starts over' : '';
  }
  twice(document.getElementById('remove'), 'Remove node', function () { api('DELETE', '/api/nodes/' + current).then(function () { current = 'h1'; }).catch(function (e) { err.textContent = e.message; }); }, removeWarning);
  var resetting = 0, gone = false;             // after Reset: the console goes until the old h1 is gone and a new one answers
  twice(document.getElementById('reset'), 'Reset', function () {
    split(false); dropConsole(); con.hidden = true; boot.hidden = false; resetting = Date.now(); gone = false;
    state.textContent = 'the booth is resetting'; waiting('every node goes, h1 comes back fresh from the installed disk; this box is its console again');
    api('POST', '/api/reset').then(function () { current = 'h1'; }).catch(function (e) { err.textContent = e.message; showConsole(''); });
  });
  function showConsole(text) { resetting = 0; ready = false; open.hidden = true; T.cancel(); boot.hidden = true; con.hidden = false; con.src = BASE + '/console/'; probe(); state.textContent = text; }
  function resetDone(j) {                       // the old h1 was seen gone (or 90 s passed) and an h1 is alive again
    if (j.install && j.install.state !== 'installed') return showConsole('');   // no disk: the install buttons are back
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
        stopping = 0; setBooth(true); misses = 0; setStale(h.version); setKvm(h.kvm !== false);
      })
      .catch(function () { stopping = 0; if (++misses >= 2) setBooth(false); })
      .then(function () {
        if (!booth || !kvm) return;
        return timed(BASE + '/ready', { method: 'HEAD' }).then(function (r) { setReady(r.ok); }, function () { setReady(false); })
          .then(function () { return api('GET', '/api/nodes').then(function (j) { drawNodes(j); if (resetting) resetDone(j); }).catch(function () {}); });
      })
      .then(function () { setTimeout(poll, 3000); }, function () { setTimeout(poll, 3000); });
  })();
  open.addEventListener('click', function () { if (embed) split(true); else window.open(BASE + '/ceph/', '_blank', 'noopener'); });
  document.getElementById('back').addEventListener('click', function () { split(false, true); });
  document.getElementById('tab').addEventListener('click', function () { window.open(BASE + '/ceph/', '_blank', 'noopener'); split(false); });
})();
