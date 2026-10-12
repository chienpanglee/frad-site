/* FRAD stage engine: plays recipes (see VOCABULARY.md) on the SVG stage, the terminal strip and the narrator.
   Three levels: the tour (all chapters, looping), a chapter (its steps, looping), a feature (once). */
(function () {
  'use strict';
  var C = window.FRAD_CONTENT, X = window.FRAD_EXAMPLES || {};
  if (!C || !C.chapters) { console.error('FRAD_CONTENT missing'); return; }
  var NODE_W = 130, NODE_H = 190, NODE_Y = 170, GAP = 150, X0 = 40;
  var PERIOD = 5000, OUT_DELAY = 650, OUT_GAP = 160, TYPE_MS = 26, TYPE_CAP = 1800, TOUR_PAUSE = 450;
  var NS = 'http://www.w3.org/2000/svg';
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var ACCENT = { zfs: 'var(--zfs)', ceph: 'var(--ceph)', ctl: 'var(--ctl)', ok: 'var(--ok)', warn: 'var(--warn)' };

  // ---------- state and scene verbs
  function blank() { return { nodes: [], screen: null, svc: false, bus: false, vip: false, inside: null, verify: null }; }
  function mkNode(id) { return { id: id, control: false, disks: ['free', 'free', 'free', 'free'], installing: false, down: false }; }
  function findNode(s, id) { for (var i = 0; i < s.nodes.length; i++) if (s.nodes[i].id === id) return s.nodes[i]; return null; }
  function withNode(s, id, fn) { var n = findNode(s, id); if (n) fn(n); else console.warn('recipe: no node ' + id); }
  var SCENE = {
    node: function (s, op) { if (!findNode(s, op[1])) s.nodes.push(mkNode(op[1])); withNode(s, op[1], function (n) { n.installing = op[2] === 'installing'; }); },
    ready: function (s, op) { withNode(s, op[1], function (n) { n.installing = false; }); },
    drop: function (s, op) { s.nodes = s.nodes.filter(function (n) { return n.id !== op[1]; }); },
    disks: function (s, op) { withNode(s, op[1], function (n) { n.disks = op[2].slice(0, 4); while (n.disks.length < 4) n.disks.push('free'); }); },
    disk: function (s, op) { withNode(s, op[1], function (n) { n.disks[op[2]] = op[3]; }); },
    control: function (s, op) { s.nodes.forEach(function (n) { n.control = op[1].indexOf(n.id) >= 0; }); },
    vip: function (s, op) { s.vip = op[1] === 'on'; },
    bus: function (s, op) { s.bus = op[1] === 'on'; },
    services: function (s, op) { s.svc = op[1] === 'on'; },
    screen: function (s, op) { s.screen = op[1] ? { node: op[1], ex: op[2] || null } : null; },
    inside: function (s, op) { s.inside = op[1] || null; },
    verify: function (s, op) { s.verify = op[1] ? { subject: op[1], mode: op[2] || 'online' } : null; },
    down: function (s, op) { withNode(s, op[1], function (n) { n.down = true; }); },
    up: function (s, op) { withNode(s, op[1], function (n) { n.down = false; }); }
  };
  var TERM = { type: 1, note: 1, out: 1, err: 1 };
  function example(t) {
    if (typeof t !== 'string' || t.charAt(0) !== '@') return t;
    var ex = X[t.slice(1)];
    if (!ex) { console.error('recipe: no example ' + t); return t; }
    return ex.lines.join('\n');
  }

  // A recipe compiles to steps: narration, terminal items and the scene verbs that run on Enter.
  function compile(recipe, c) {
    var steps = [], cur = null;
    (recipe || []).forEach(function (op) {
      var v = op[0];
      if (v === 'step') { cur = { title: op[1], text: op[2], flag: op[3] || null, term: [], scene: [], hold: 0, c: c }; steps.push(cur); return; }
      if (!cur) { console.error('recipe: verb before the first step', op); return; }
      if (TERM[v]) cur.term.push({ k: v, s: example(op[1]), node: op[2] || null });
      else if (v === 'hold') cur.hold = op[1] | 0;
      else if (SCENE[v]) cur.scene.push(op);
      else console.error('recipe: unknown verb', op);
    });
    return steps;
  }

  // ---------- sequences: the tour, a chapter, a feature
  var tour = [], chStart = [], chEnd = [];
  C.chapters.forEach(function (ch, c) {
    var st = compile(ch.tour, c);
    chStart[c] = tour.length; tour = tour.concat(st); chEnd[c] = tour.length - 1;
  });
  function replay(s, steps, upto) {
    for (var j = 0; j <= upto && j < steps.length; j++) steps[j].scene.forEach(function (op) { SCENE[op[0]](s, op); });
    return s;
  }
  function tourState(upto) { return replay(blank(), tour, upto); }
  function seqTour() { return { kind: 'tour', steps: tour, base: blank, loop: true }; }
  function seqChapter(c) {
    return { kind: 'chapter', c: c, steps: tour.slice(chStart[c], chEnd[c] + 1), base: function () { return tourState(chStart[c] - 1); }, loop: true };
  }
  function seqFeature(c, f) {
    var ft = C.chapters[c].features[f];
    var steps = ft.recipe ? compile(ft.recipe, c) : [];
    if (!steps.length) steps = [{ title: ft.title, text: ft.summary, flag: null, term: [], scene: [], hold: 0, c: c }];
    // a feature starts from the chapter's start state with the transient overlays cleared
    return { kind: 'feature', c: c, f: f, steps: steps, base: function () { var b = tourState(chStart[c] - 1); b.verify = null; b.screen = null; b.inside = null; return b; }, loop: false };
  }
  function stateAt(seq, k) { return replay(seq.base(), seq.steps, k); }
  function diskDiff(a, b) {
    var hot = {};
    b.nodes.forEach(function (n) {
      var o = findNode(a, n.id);
      for (var d = 0; d < 4; d++) if (o && o.disks[d] !== n.disks[d]) hot[n.id + ':' + d] = true;
    });
    return hot;
  }

  // ---------- SVG helpers
  var gNodes = document.getElementById('nodes'), gTicks = document.getElementById('ticks');
  var gVip = document.getElementById('vip'), gFb = document.getElementById('fb'), gUpd = document.getElementById('upd'), gVer = document.getElementById('ver');
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function txt(parent, x, y, s, attrs) { var t = el('text', attrs || {}, parent); t.setAttribute('x', x); t.setAttribute('y', y); t.textContent = s; return t; }
  function nodeX(idx) { return X0 + idx * GAP; }
  function settle(g, cls) { void g.getBoundingClientRect(); g.classList.remove(cls); }   // a style flush, rAF does not run in hidden tabs
  function retire(g, ms) { g.classList.add('leaving'); setTimeout(function () { if (g.parentNode) g.parentNode.removeChild(g); }, reduced ? 0 : ms); }

  function miniMark(parent, x, y, sc) {
    var g = el('g', { transform: 'translate(' + x + ' ' + y + ') scale(' + sc + ')' }, parent);
    el('circle', { cx: 50, cy: 50, r: 37, fill: 'none', stroke: 'var(--ceph)', 'stroke-width': 9 }, g);
    for (var k = 0; k < 5; k++) {
      var a = (-90 + k * 72) * Math.PI / 180, px = 50 + 37 * Math.cos(a), py = 50 + 37 * Math.sin(a);
      el('line', { x1: 50, y1: 50, x2: px.toFixed(1), y2: py.toFixed(1), stroke: 'var(--ceph)', 'stroke-width': 6, 'stroke-linecap': 'round' }, g);
      el('circle', { cx: px.toFixed(1), cy: py.toFixed(1), r: 9, fill: 'var(--ceph)' }, g);
    }
    el('circle', { cx: 50, cy: 50, r: 14, fill: 'var(--zfs)' }, g);
  }
  function buildNode(n) {
    var g = el('g', { 'class': 'node enter', 'data-id': n.id }, gNodes);
    var in_ = el('g', { 'class': 'inner' }, g);
    el('rect', { 'class': 'box', x: 0, y: 0, width: NODE_W, height: NODE_H, rx: 10 }, in_);
    el('path', { 'class': 'cap', d: 'M10 0.75H' + (NODE_W - 10) + 'a9.25 9.25 0 0 1 9.25 9.25V34H0.75V10A9.25 9.25 0 0 1 10 0.75Z' }, in_);
    miniMark(in_, 11, 10, 0.14);
    txt(in_, 30, 24, n.id, { 'class': 'mono', 'font-size': 15, 'font-weight': 600 });
    var mon = el('g', { 'class': 'mon' }, in_);
    el('rect', { x: 76, y: 9, width: 44, height: 18, rx: 9, fill: 'var(--ctl)' }, mon);
    txt(mon, 98, 22, 'control', { 'font-size': 10, 'text-anchor': 'middle', fill: '#fff', 'font-weight': 600 });
    txt(in_, 12, 52, 'FRAD OS · root on ZFS', { 'class': 'muted', 'font-size': 10.5 });
    txt(in_, 12, 76, 'disks', { 'class': 'muted', 'font-size': 10.5 });
    for (var i = 0; i < 4; i++) {
      el('rect', { 'class': 'disk', 'data-i': i, x: 12 + i * 27, y: 86, width: 22, height: 56, rx: 4 }, in_);
      el('rect', { 'class': 'hl', 'data-i': i, x: 16 + i * 27, y: 92, width: 5, height: 44, rx: 2.5 }, in_);
    }
    txt(in_, 12, 164, 'sda  sdb  sdc  sdd', { 'class': 'mono muted', 'font-size': 9.5 });
    txt(in_, 12, 180, '', { 'class': 'muted lbl', 'font-size': 10.5 });
    var off = el('g', { 'class': 'off' }, in_);
    el('rect', { x: 36, y: 100, width: 58, height: 22, rx: 11, fill: 'var(--warn)' }, off);
    txt(off, 65, 115, 'no power', { 'font-size': 10, 'text-anchor': 'middle', fill: '#fff', 'font-weight': 600 });
    return g;
  }

  var curInside = null, curVerify = '', curScreen = '';
  function render(s, hot) {
    var inUpdate = !!s.inside;
    document.getElementById('empty').style.opacity = s.nodes.length ? 0 : 1;

    var want = {};
    s.nodes.forEach(function (n, idx) { want[n.id] = idx; });
    Array.prototype.slice.call(gNodes.children).forEach(function (g) {
      var id = g.getAttribute('data-id');
      if (!(id in want) && !g.classList.contains('leaving')) retire(g, 750);
    });
    s.nodes.forEach(function (n, idx) {
      var g = gNodes.querySelector('[data-id="' + n.id + '"]:not(.leaving)');
      var fresh = false;
      if (!g) { g = buildNode(n); fresh = true; }
      g.style.transform = 'translate(' + nodeX(idx) + 'px, ' + NODE_Y + 'px)';
      g.classList.toggle('ctl', n.control && !n.down);
      g.classList.toggle('down', !!n.down);
      g.classList.toggle('dimmed', n.installing || (inUpdate && n.id !== 'h1'));
      var disks = g.querySelectorAll('.disk'), hls = g.querySelectorAll('.hl');
      for (var d = 0; d < 4; d++) {
        var cls = 'disk ' + (n.disks[d] === 'free' ? '' : n.disks[d]) + (hot[n.id + ':' + d] ? ' hot' : '');
        if (disks[d].getAttribute('class') !== cls) disks[d].setAttribute('class', cls);
        hls[d].classList.toggle('on', n.disks[d] !== 'free');
      }
      var zfs = n.disks.filter(function (k) { return k === 'zfs'; }).length;
      var ceph = n.disks.filter(function (k) { return k === 'ceph'; }).length;
      g.querySelector('.lbl').textContent = n.installing ? 'installing…' : n.down ? 'unreachable'
        : (ceph ? ceph + ' OSD' : '') + (zfs ? (ceph ? ' · ' : '') + 'dpool ' + zfs + ' disk' + (zfs > 1 ? 's' : '') : '') || 'no storage yet';
      if (fresh) settle(g, 'enter');
    });

    // cluster bus: one path whose d is transitioned, a flowing dash overlay, ticks keyed by node
    var bus = document.getElementById('bus'), flow = document.getElementById('flow'), busLabel = document.getElementById('busLabel');
    var showBus = s.bus && !inUpdate;
    var d0 = 'M ' + (nodeX(0) + NODE_W / 2) + ' 130 H ' + (nodeX(Math.max(0, s.nodes.length - 1)) + NODE_W / 2);
    if (showBus) { bus.setAttribute('d', d0); flow.setAttribute('d', d0); }
    document.getElementById('busg').classList.toggle('on', showBus);
    busLabel.classList.toggle('on', showBus);
    var tickWant = {};
    if (showBus) s.nodes.forEach(function (n, idx) { tickWant[n.id] = idx; });
    Array.prototype.slice.call(gTicks.children).forEach(function (t) {
      var id = t.getAttribute('data-id');
      if (!(id in tickWant) && !t.classList.contains('leaving')) retire(t, 500);
    });
    Object.keys(tickWant).forEach(function (id) {
      var t = gTicks.querySelector('[data-id="' + id + '"]:not(.leaving)');
      var x = nodeX(tickWant[id]) + NODE_W / 2;
      if (!t) { t = el('line', { 'class': 'tick enter', 'data-id': id, x1: x, y1: 130, x2: x, y2: NODE_Y }, gTicks); settle(t, 'enter'); }
      t.classList.toggle('dead', !!findNode(s, id).down);
    });

    document.getElementById('svc').classList.toggle('on', s.svc && !inUpdate);

    // VIP badge over the live control nodes: built once, moved by transform
    var ctl = s.nodes.map(function (n, idx) { return n.control && !n.down ? idx : -1; }).filter(function (v) { return v >= 0; });
    var showVip = s.vip && ctl.length && !inUpdate;
    if (showVip) {
      var cx = (nodeX(ctl[0]) + nodeX(ctl[ctl.length - 1]) + NODE_W) / 2;
      if (!gVip.firstChild) {
        el('rect', { 'class': 'halo', x: -132, y: 68, width: 264, height: 30, rx: 15 }, gVip);
        el('rect', { 'class': 'pill', x: -132, y: 68, width: 264, height: 30, rx: 15 }, gVip);
        txt(gVip, 0, 88, '', { 'class': 'viptext', 'font-size': 12, 'text-anchor': 'middle', 'font-weight': 600 });
        el('g', { 'class': 'legs' }, gVip);
      }
      gVip.querySelector('.viptext').textContent = 'virtual IP · quorum ' + ctl.length + ' of ' + s.nodes.filter(function (n) { return n.control; }).length + ' · dashboard · S3';
      var legs = gVip.querySelector('.legs');
      while (legs.firstChild) legs.removeChild(legs.firstChild);
      ctl.forEach(function (idx) { var lx = nodeX(idx) + NODE_W / 2 - cx; el('line', { x1: lx, y1: 98, x2: lx, y2: 128 }, legs); });
      gVip.style.transform = 'translateX(' + cx + 'px)';
    }
    gVip.classList.toggle('on', !!showVip);

    // a screen from a real log, beside its node: panes crossfade
    var skey = s.screen ? s.screen.node + '/' + s.screen.ex : '';
    if (skey !== curScreen) {
      Array.prototype.slice.call(gFb.children).forEach(function (pg) {
        pg.classList.add('out');
        setTimeout(function () { if (pg.parentNode) pg.parentNode.removeChild(pg); }, reduced ? 0 : 500);
      });
      if (s.screen) { var sg = el('g', { 'class': 'pane-g enter' }, gFb); drawScreen(s, sg); settle(sg, 'enter'); }
      curScreen = skey;
    }

    // "inside h1" inlay: panes crossfade
    if (s.inside !== curInside) {
      Array.prototype.slice.call(gUpd.children).forEach(function (pg) {
        pg.classList.add('out');
        setTimeout(function () { if (pg.parentNode) pg.parentNode.removeChild(pg); }, reduced ? 0 : 500);
      });
      if (s.inside) { var pg = el('g', { 'class': 'pane-g enter' }, gUpd); drawInside(s.inside, pg); settle(pg, 'enter'); }
      curInside = s.inside;
    }

    // verification card beside the subject: image checks at install, a node's proof to its peers at join
    var vkey = s.verify ? s.verify.subject + '/' + s.verify.mode : '';
    if (vkey !== curVerify) {
      Array.prototype.slice.call(gVer.children).forEach(function (pg) {
        pg.classList.add('out');
        setTimeout(function () { if (pg.parentNode) pg.parentNode.removeChild(pg); }, reduced ? 0 : 500);
      });
      if (s.verify) { var vg = el('g', { 'class': 'pane-g enter' }, gVer); drawVerify(s, vg); settle(vg, 'enter'); }
      curVerify = vkey;
    }
  }

  function drawVerify(s, P) {
    var v = s.verify, isImage = v.subject === 'image';
    var idx = 0; s.nodes.forEach(function (n, i) { if (n.id === v.subject) idx = i; });
    var w = 372, h = 168, x = nodeX(idx) + NODE_W + 24, y = NODE_Y + 8;
    if (x + w > 950) x = nodeX(idx) - 24 - w;
    el('line', { 'class': 'lead', x1: x < nodeX(idx) ? x + w : nodeX(idx) + NODE_W, y1: NODE_Y + 30, x2: x < nodeX(idx) ? nodeX(idx) : x, y2: y + 22 }, P);
    el('rect', { 'class': 'card', x: x, y: y, width: w, height: h, rx: 8 }, P);
    txt(P, x + 16, y + 26, isImage ? 'Verifying the image' : 'Verifying ' + v.subject + ' before it is trusted', { 'font-size': 13, 'font-weight': 600 });
    txt(P, x + w - 16, y + 26, isImage ? (v.mode === 'offline' ? 'offline · bundled key' : 'online · attested') : 'by its peers', { 'class': 'muted', 'font-size': 10.5, 'text-anchor': 'end' });
    var rows = isImage
      ? [['signature', 'signed by the release key'], ['attestation', v.mode === 'offline' ? 'checked against the key on the appliance' : 'recorded with the transparency log'], ['bill of materials', 'present, matches the build'], ['vulnerabilities', 'report present, no critical finding']]
      : [['image signature', 'the booted image is a signed release'], ['measured boot', 'PCR baseline matches the fleet'], ['audit trail', 'forwarded to the peers from now on']];
    rows.forEach(function (r, k) {
      var ry = y + 52 + k * 26;
      var R = el('g', { 'class': 'row', style: 'animation-delay: ' + (300 + k * 420) + 'ms' }, P);
      el('circle', { 'class': 'tick', cx: x + 24, cy: ry - 4, r: 7 }, R);
      el('path', { 'class': 'tickmark', d: 'M' + (x + 20.5) + ' ' + (ry - 4) + ' l2.5 2.5 l4.5 -5' }, R);
      txt(R, x + 40, ry, r[0], { 'class': 'mono', 'font-size': 11.5, 'font-weight': 600 });
      txt(R, x + 162, ry, r[1], { 'font-size': 11.5 });
    });
    var F = el('g', { 'class': 'row', style: 'animation-delay: ' + (300 + rows.length * 420 + 200) + 'ms' }, P);
    txt(F, x + 16, y + h - 14, isImage ? 'trusted: the image may be written' : 'trusted: the node may join', { 'class': 'verdict', 'font-size': 11.5, 'font-weight': 600 });
  }

  function drawScreen(s, P) {
    var idx = 0; s.nodes.forEach(function (n, i) { if (n.id === s.screen.node) idx = i; });
    var ex = X[s.screen.ex], lines = ex ? ex.lines : ['(no example ' + s.screen.ex + ')'];
    var cols = 40; lines.forEach(function (l) { cols = Math.max(cols, l.length); });
    var x = nodeX(idx) + NODE_W + 24, w = 940 - x, top = 56, maxH = 460 - top;
    var fs = Math.min(11, (w - 24) / (cols * 0.62), (maxH - 46) / (lines.length * 1.3));
    var lh = fs * 1.3, h = Math.ceil(lines.length * lh + 46), y = Math.max(top, Math.min(NODE_Y - 10, 460 - h));
    el('line', { 'class': 'lead', x1: nodeX(idx) + NODE_W, y1: NODE_Y + 30, x2: x, y2: Math.min(y + h - 10, Math.max(y + 10, NODE_Y + 30)) }, P);
    el('rect', { 'class': 'screen', x: x, y: y, width: w, height: h, rx: 8 }, P);
    el('path', { 'class': 'bar', d: 'M' + (x + 8) + ' ' + y + 'H' + (x + w - 8) + 'a8 8 0 0 1 8 8v14H' + x + 'V' + (y + 8) + 'a8 8 0 0 1 8-8Z' }, P);
    [['#ff5f57', 0], ['#febc2e', 1], ['#28c840', 2]].forEach(function (c) { el('circle', { cx: x + 16 + c[1] * 14, cy: y + 11, r: 4, fill: c[0] }, P); });
    txt(P, x + w / 2, y + 15, s.screen.node + ' · console', { 'class': 'mono src', 'font-size': 10, 'text-anchor': 'middle' });
    if (ex) txt(P, x + w - 12, y + 15, ex.source + ' · ' + ex.date, { 'class': 'mono src', 'font-size': 9, 'text-anchor': 'end' });
    lines.forEach(function (l, k) {
      var t = txt(P, x + 12, y + 36 + k * lh, l, { 'class': 'mono', 'font-size': fs.toFixed(2), 'xml:space': 'preserve' });
      t.setAttribute('xml:space', 'preserve'); t.style.whiteSpace = 'pre';
    });
    var last = lines[lines.length - 1] || '';
    el('rect', { 'class': 'cursor', x: x + 12 + last.length * fs * 0.62 + 2, y: y + 36 + (lines.length - 1) * lh - fs * 0.85, width: fs * 0.6, height: fs * 1.05 }, P);
  }

  function drawInside(mode, P) {
    var px = nodeX(1) + 10, py = 60, pw = 940 - px, ph = 390;
    el('rect', { 'class': 'pane', x: px, y: py, width: pw, height: ph, rx: 8 }, P);
    txt(P, px + 18, py + 26, 'Inside h1', { 'font-size': 13, 'font-weight': 600 });
    el('line', { 'class': 'lane', x1: nodeX(0) + NODE_W, y1: NODE_Y + 30, x2: px, y2: py + 30 }, P);
    if (mode === 'channels') {
      var rows = [
        ['apt', 'base OS: kernel, systemd, OpenSSH, ZFS, podman', 'Ubuntu security cadence', 'previous boot environment', 'var(--ctl)'],
        ['/frbe fixpack', 'FRAD’s own code and bundled images', 'whenever a fix ships, no reboot', 'snapshot before every change', 'var(--zfs)'],
        ['PPU image', 'the whole firmware', 'rare: air-gapped sites, major versions', 'boot environment switch', 'var(--ceph)']
      ];
      ['channel', 'carries', 'cadence', 'rollback'].forEach(function (h, k) { txt(P, px + [18, 150, 430, 640][k], py + 56, h, { 'class': 'muted', 'font-size': 10.5 }); });
      rows.forEach(function (r, k) {
        var y = py + 90 + k * 92;
        var R = el('g', { 'class': 'row', style: 'animation-delay: ' + (120 + k * 140) + 'ms' }, P);
        el('rect', { x: px + 18, y: y - 26, width: pw - 36, height: 72, rx: 6, fill: 'color-mix(in srgb, ' + r[4] + ' 6%, var(--panel))', stroke: r[4], 'stroke-width': 1.5 }, R);
        el('rect', { x: px + 18, y: y - 26, width: 6, height: 72, rx: 2, fill: r[4] }, R);
        txt(R, px + 36, y, r[0], { 'class': 'mono', 'font-size': 13, 'font-weight': 600 });
        txt(R, px + 150, y, r[1], { 'font-size': 12 });
        txt(R, px + 430, y, r[2], { 'font-size': 12 });
        txt(R, px + 640, y, r[3], { 'font-size': 12 });
        txt(R, px + 36, y + 26, k === 0 ? 'a kernel CVE never waits for a firmware release' : k === 1 ? 'a FRAD fix never re-images the base OS' : 'one file, verified, for sites with no network', { 'class': 'muted', 'font-size': 11 });
      });
      return;
    }
    if (mode === 'frbe') {
      el('rect', { 'class': 'be run', x: px + 30, y: py + 60, width: 300, height: 150, rx: 6 }, P);
      txt(P, px + 46, py + 86, 'rpool/ROOT/be-2   (running)', { 'class': 'mono', 'font-size': 12, 'font-weight': 600 });
      txt(P, px + 46, py + 110, 'base OS: kernel, systemd, ZFS, podman', { 'font-size': 12 });
      txt(P, px + 46, py + 130, 'changed only by apt', { 'class': 'muted', 'font-size': 11 });
      txt(P, px + 46, py + 170, 'cannot write into /frbe', { 'font-size': 11, fill: 'var(--ok)', 'font-weight': 600 });
      el('rect', { 'class': 'frbe', x: px + 370, y: py + 60, width: 300, height: 150, rx: 6 }, P);
      txt(P, px + 386, py + 86, 'rpool/frbe   (read-only)', { 'class': 'mono', 'font-size': 12, 'font-weight': 600 });
      txt(P, px + 386, py + 110, 'frad_cli, frad_config, frad_sdk, Ceph image', { 'font-size': 12 });
      txt(P, px + 386, py + 130, 'unlocked only for a fixpack or hotfix', { 'class': 'muted', 'font-size': 11 });
      txt(P, px + 386, py + 170, 'snapshot before every change', { 'font-size': 11, fill: 'var(--zfs)', 'font-weight': 600 });
      el('line', { 'class': 'lane', x1: px + 330, y1: py + 135, x2: px + 370, y2: py + 135, 'stroke-dasharray': '4 3' }, P);
      txt(P, px + 30, py + 260, 'Two fast channels, two datasets, no way to collide.', { 'font-size': 14, 'font-weight': 600 });
      txt(P, px + 30, py + 284, 'Ceph daemons are containers; cluster ceph_upgrade moves them to a new image in place.', { 'class': 'muted', 'font-size': 12 });
      return;
    }
    var clone = mode === 'clone';
    el('rect', { 'class': 'be run', x: px + 30, y: py + 70, width: 280, height: 120, rx: 6 }, P);
    txt(P, px + 46, py + 96, 'be-1   ' + (clone ? '(running)' : '(running again)'), { 'class': 'mono', 'font-size': 12, 'font-weight': 600 });
    txt(P, px + 46, py + 120, 'kernel 6.x · ZFS · podman', { 'font-size': 12 });
    txt(P, px + 46, py + 142, clone ? 'serving storage the whole time' : 'untouched, so it simply boots', { 'class': 'muted', 'font-size': 11 });
    el('rect', { 'class': 'be ' + (clone ? '' : 'bad'), x: px + 380, y: py + 70, width: 280, height: 120, rx: 6 }, P);
    txt(P, px + 396, py + 96, 'be-2   ' + (clone ? '(clone)' : '(failed validation)'), { 'class': 'mono', 'font-size': 12, 'font-weight': 600 });
    txt(P, px + 396, py + 120, clone ? 'apt upgrade applied here' : 'left in place for diagnosis', { 'font-size': 12 });
    txt(P, px + 396, py + 142, clone ? 'checked against what /frbe was validated with' : 'never became the boot target', { 'class': 'muted', 'font-size': 11 });
    el('line', { 'class': 'lane', x1: px + 310, y1: py + 130, x2: px + 380, y2: py + 130 }, P);
    txt(P, px + 345, py + 122, clone ? 'clone' : 'back', { 'class': 'muted', 'font-size': 10.5, 'text-anchor': 'middle' });
    var seq = clone
      ? [['1', 'clone the running boot environment'], ['2', 'apply the upgrade to the clone'], ['3', 'validate: kernel, ZFS, podman within what /frbe supports'], ['4', 'make the clone the boot target; reboot']]
      : [['1', 'the new environment misbehaves'], ['2', 'reboot, ZFSBootMenu lists both environments'], ['3', 'pick be-1; it was never modified'], ['4', 'storage is back; be-2 waits for a fix']];
    seq.forEach(function (r, k) {
      txt(P, px + 36, py + 240 + k * 26, r[0], { 'class': 'mono', 'font-size': 12, fill: 'var(--ctl)', 'font-weight': 600 });
      txt(P, px + 58, py + 240 + k * 26, r[1], { 'font-size': 12.5 });
    });
    txt(P, px + 36, py + ph - 18, 'designed, in progress', { 'class': 'muted', 'font-size': 11 });
  }

  // ---------- terminal strip (term.js)
  var T = window.FRADTerm(document.getElementById('term'));
  function withPrompt(items) { return items.map(function (it) { return { k: it.k, s: it.s, prompt: (it.node || 'h1') + '> ' }; }); }
  function termClear() { T.clear(); }
  function flushItems(items) { T.flush(withPrompt(items)); }
  function playTerminal(seq, k, apply) { return T.play(withPrompt(seq.steps[k].term), apply, seq.kind === 'tour'); }

  // ---------- narrator and modes
  var narr = document.getElementById('narr'), tabs = document.getElementById('tabs');
  var seq = null, cur = 0, playing = false, timer = null, barTimer = null;
  var E = {};
  ['stepno', 'chapname', 'title', 'text', 'chno', 'chtitle', 'chintro', 'ftitle', 'fsummary', 'features', 'details', 'evidence', 'bar', 'play', 'prev', 'next', 'open', 'totour', 'upchapter', 'legendDown'].forEach(function (id) { E[id] = document.getElementById(id); });

  C.chapters.forEach(function (ch, c) {
    var b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'tab-' + c;
    b.innerHTML = '<i>' + (c + 1) + '</i>' + ch.label;
    b.addEventListener('click', function () { touched = true; location.hash = ch.slug; });
    tabs.appendChild(b);
  });

  function chip(status) { var c = document.createElement('span'); c.className = 'chip ' + status; c.textContent = status; return c; }
  function fade(e) { e.classList.remove('fade'); void e.offsetWidth; e.classList.add('fade'); }

  function buildNarr() {
    var ch = C.chapters[seq.c === undefined ? 0 : seq.c];
    narr.setAttribute('data-mode', seq.kind); stage.setAttribute('data-mode', seq.kind);
    document.getElementById('story').style.setProperty('--accent', ACCENT[ch.accent] || 'var(--ctl)');
    if (seq.kind === 'chapter') {
      E.chno.textContent = 'Chapter ' + (seq.c + 1) + ' of ' + C.chapters.length;
      E.chtitle.textContent = ch.title; E.chintro.textContent = ch.intro;
      E.features.textContent = '';
      ch.features.forEach(function (ft, f) {
        var li = document.createElement('li'), b = document.createElement('button');
        b.type = 'button'; b.appendChild(document.createTextNode(ft.title)); b.appendChild(chip(ft.status));
        b.addEventListener('click', function () { location.hash = ch.slug + '/' + ft.slug; });
        li.appendChild(b); E.features.appendChild(li);
      });
    }
    if (seq.kind === 'feature') {
      var ft = ch.features[seq.f];
      E.upchapter.textContent = '‹ ' + ch.title;
      E.ftitle.textContent = ft.title; E.ftitle.appendChild(chip(ft.status));
      E.fsummary.textContent = ft.summary;
      E.details.textContent = '';
      (ft.details || []).forEach(function (p) { var e = document.createElement('p'); e.textContent = p; E.details.appendChild(e); });
      var ev = [];
      if (ft.adr) ev.push('ADR ' + ft.adr);
      if (ft.tests) ev.push('covered by ' + ft.tests + ' end-to-end test' + (ft.tests > 1 ? 's' : ''));
      if (ft.status === 'designed') ev.push('designed, not yet shipped');
      E.evidence.textContent = ev.join(' · ');
    }
  }

  function go(k) {
    cur = Math.max(0, Math.min(seq.steps.length - 1, k));
    var st = seq.steps[cur], s = stateAt(seq, cur), prev = cur ? stateAt(seq, cur - 1) : seq.base();
    var hot = diskDiff(prev, s);
    E.stepno.textContent = (cur + 1) + ' / ' + seq.steps.length;
    E.chapname.textContent = C.chapters[st.c].title;
    E.title.textContent = st.title;
    if (st.flag === 'designed') E.title.appendChild(chip('designed'));
    E.text.textContent = st.text;
    fade(E.title); fade(E.text);
    if (seq.kind === 'tour') document.getElementById('story').style.setProperty('--accent', ACCENT[C.chapters[st.c].accent] || 'var(--ctl)');
    Array.prototype.forEach.call(tabs.children, function (b, c) { b.setAttribute('aria-selected', c === st.c ? 'true' : 'false'); });
    E.prev.disabled = cur === 0 && !seq.loop;
    E.next.disabled = cur === seq.steps.length - 1 && !seq.loop;
    termClear();                                  // the transcript is rebuilt from the steps before this one, so jumps are exact
    for (var j = 0; j < cur; j++) flushItems(seq.steps[j].term);
    var typeMs = playTerminal(seq, cur, function () { render(s, hot); });
    if (playing) arm(typeMs + PERIOD + st.hold); else showBar(0);
    playLabel();
  }
  function showBar(ms) {
    var bar = E.bar; clearTimeout(barTimer);
    bar.style.transition = 'none'; bar.style.width = '0';
    if (ms) barTimer = setTimeout(function () { bar.style.transition = 'width ' + ms + 'ms linear'; bar.style.width = '100%'; }, 30);
  }
  function arm(ms) { clearTimeout(timer); showBar(ms); timer = setTimeout(tick, ms); }
  function tick() {
    if (!playing) return;
    if (cur >= seq.steps.length - 1) { if (seq.loop) { termClear(); go(0); } else stop(); }
    else go(cur + 1);
  }
  function playLabel() { E.play.textContent = playing ? 'Pause' : (!seq.loop && cur >= seq.steps.length - 1 ? 'Replay' : 'Play'); }
  function play() {
    playing = true; playLabel();
    if (cur >= seq.steps.length - 1 && !seq.loop) { termClear(); go(0); return; }
    arm(PERIOD);
  }
  function stop() {   // a paused step shows its command, its output and its picture complete
    playing = false; clearTimeout(timer); showBar(0); T.cancel();
    termClear(); for (var j = 0; j <= cur; j++) flushItems(seq.steps[j].term);
    render(stateAt(seq, cur), diskDiff(cur ? stateAt(seq, cur - 1) : seq.base(), stateAt(seq, cur)));
    playLabel();
  }
  function enter(newSeq, k, autoplayIt) {
    clearTimeout(timer); T.cancel();
    seq = newSeq; buildNarr();
    playing = !!autoplayIt; go(k);
  }
  function prevStep() { if (cur > 0) go(cur - 1); else if (seq.loop) go(seq.steps.length - 1); }
  function nextStep() { if (cur < seq.steps.length - 1) go(cur + 1); else if (seq.loop) { termClear(); go(0); } }

  // ---------- routing: #tour, #step-N, #<chapter>, #<chapter>/<feature>
  var touched = false, suspended = false, autoDone = false;
  function findChapter(slug) { for (var c = 0; c < C.chapters.length; c++) if (C.chapters[c].slug === slug) return c; return -1; }
  function route(initial) {
    var h = decodeURIComponent(location.hash.slice(1)), m = /^step-(\d+)$/.exec(h);
    var parts = h.split('/'), c = findChapter(parts[0]);
    if (c >= 0 && parts.length > 1) {
      var f = -1; C.chapters[c].features.forEach(function (ft, i) { if (ft.slug === parts[1]) f = i; });
      if (f >= 0) { enter(seqFeature(c, f), 0, false); return scrollTo(); }
    }
    if (c >= 0) { enter(seqChapter(c), 0, false); return scrollTo(); }   // a chapter or a feature never autoplays
    var k = m ? Math.max(0, Math.min(tour.length - 1, parseInt(m[1], 10) - 1)) : (seq && seq.kind !== 'tour' && seq.c !== undefined ? chStart[seq.c] : 0);
    enter(seqTour(), k, !initial || !!m);
    if (!initial || m) scrollTo();
  }
  var stage = document.getElementById('story');
  function scrollTo() { setTimeout(function () { stage.scrollIntoView({ block: 'start' }); }, 0); }

  E.play.addEventListener('click', function () { touched = true; suspended = false; playing ? stop() : play(); });
  E.prev.addEventListener('click', function () { touched = true; stop(); prevStep(); });
  E.next.addEventListener('click', function () { touched = true; stop(); nextStep(); });
  E.open.addEventListener('click', function () { touched = true; location.hash = C.chapters[seq.steps[cur].c].slug; });
  E.totour.addEventListener('click', function () { location.hash = 'tour'; });
  E.upchapter.addEventListener('click', function () { location.hash = C.chapters[seq.c].slug; });
  document.addEventListener('keydown', function (e) {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') { touched = true; stop(); nextStep(); }
    if (e.key === 'ArrowLeft') { touched = true; stop(); prevStep(); }
    if (e.key === ' ' && seq && !(e.target && e.target.tagName === 'BUTTON')) { e.preventDefault(); touched = true; playing ? stop() : play(); }
    if (e.key === 'Escape') { if (seq.kind === 'feature') location.hash = C.chapters[seq.c].slug; else if (seq.kind === 'chapter') location.hash = 'tour'; }
  });
  function suspend() { if (playing) { suspended = true; stop(); } }
  function resume() { if (suspended && !document.hidden) { suspended = false; play(); } }
  document.addEventListener('visibilitychange', function () { document.hidden ? suspend() : resume(); });
  if ('IntersectionObserver' in window && !reduced) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { if (!autoDone && !touched && !playing && seq.kind === 'tour') { autoDone = true; play(); } else resume(); }
        else suspend();
      });
    }, { threshold: 0.45 }).observe(stage);
  }
  window.addEventListener('hashchange', function () { route(false); });
  route(true);
})();
