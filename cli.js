/* The CLI manual: the frad_cli command tree (cli-tree.js), one page per path, each with a replay of a recorded
   session (examples.js) when one exists. URL: #node/disks/zfs_add. */
(function () {
  'use strict';
  var CLI = window.FRAD_CLI, X = window.FRAD_EXAMPLES || {}, C = window.FRAD_CONTENT || { chapters: [] };
  if (!CLI) { console.error('FRAD_CLI missing'); return; }
  var T = window.FRADTerm(document.getElementById('term'), { keep: 2000 });   // a run is read whole, nothing scrolls off
  var byPath = {}, children = { '': [] };
  CLI.commands.forEach(function (c) {
    byPath[c.path] = c;
    var parent = c.kind === 'global' ? '' : c.path.split(' ').slice(0, -1).join(' ');
    (children[parent] = children[parent] || []).push(c);
  });
  var EFFECT = { readonly: 'reads, changes nothing', mutating: 'changes the node or the cluster', destructive: 'asks for confirmation; stops, removes or replaces something', '-': '' };
  var E = {};
  ['tree', 'cpath', 'cname', 'cforms', 'cusage', 'cmeta', 'csubs', 'cprov', 'cseen', 'replay'].forEach(function (id) { E[id] = document.getElementById(id); });

  function name(c) { return c.path.split(' ').slice(-1)[0]; }
  function hashOf(path) { return '#' + path.split(' ').join('/'); }
  function pathOf(hash) { return decodeURIComponent(hash.slice(1)).split('/').filter(Boolean).join(' '); }

  // The prompt as cli_main.cpp composes it: host, then ":scope [mode]", no host in cluster scope.
  function promptAt(modes) {
    if (!modes.length) return 'h1> ';
    var scope = modes[0], p = scope === 'cluster' ? '' : 'h1:';
    p += scope; if (modes.length > 1) p += ' ' + modes[modes.length - 1];
    return p + '> ';
  }
  function forms(c) {
    var toks = c.path.split(' '), out = [];
    if (c.kind === 'global') return [['h1> ', c.usage]];
    out.push(['h1> ', toks.slice(0, -1).concat([c.usage]).join(' ')]);
    if (toks.length > 1) {
      var step = [];
      toks.forEach(function (t, i) { step.push([promptAt(toks.slice(0, i)), i === toks.length - 1 ? c.usage : t]); });
      out.push(step);
    }
    return out;
  }

  // ----- the rail
  function buildTree() {
    var ul = document.createElement('ul');
    var root = document.createElement('li'); var a0 = document.createElement('a'); a0.href = '#'; a0.textContent = 'The prompt'; a0.dataset.path = ''; root.appendChild(a0); ul.appendChild(root);
    function add(parentUl, list) {
      list.forEach(function (c) {
        var li = document.createElement('li'); li.className = c.kind;
        var a = document.createElement('a'); a.href = hashOf(c.path); a.textContent = name(c); a.dataset.path = c.path;
        if (c.effect === 'destructive') a.className = 'destructive';
        li.appendChild(a);
        if (children[c.path]) { var sub = document.createElement('ul'); add(sub, children[c.path]); li.appendChild(sub); }
        parentUl.appendChild(li);
      });
    }
    var globals = children[''].filter(function (c) { return c.kind === 'global'; }), modes = children[''].filter(function (c) { return c.kind !== 'global'; });
    add(ul, modes); add(ul, globals);
    E.tree.appendChild(ul);
  }

  function chip(text, cls) { var s = document.createElement('span'); s.className = 'chip ' + (cls || ''); s.textContent = text; return s; }
  function code(text) { var c = document.createElement('code'); c.textContent = text; return c; }
  function clearEl(e) { e.textContent = ''; }

  function seenIn(path) {
    var hits = [];
    C.chapters.forEach(function (ch) {
      function scan(recipe, label, hash) {
        (recipe || []).forEach(function (op) {
          if (op[0] === 'type' && (op[1] === path || op[1].indexOf(path + ' ') === 0)) hits.push([label, hash]);
        });
      }
      scan(ch.tour, ch.title, 'index.html#' + ch.slug);
      ch.features.forEach(function (ft) { scan(ft.recipe, ch.title + ' › ' + ft.title, 'index.html#' + ch.slug + '/' + ft.slug); });
    });
    var seen = {}; return hits.filter(function (h) { if (seen[h[1]]) return false; seen[h[1]] = true; return true; });
  }

  // ----- one command
  var current = null;
  function show(path) {
    current = path;
    Array.prototype.forEach.call(E.tree.querySelectorAll('a'), function (a) { a.classList.toggle('on', a.dataset.path === path); });
    var on = E.tree.querySelector('a.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
    ['cpath', 'cname', 'cforms', 'cusage', 'cmeta', 'csubs', 'cprov', 'cseen'].forEach(function (k) { clearEl(E[k]); });
    T.cancel(); T.clear();
    var c = byPath[path];
    if (!c) { showRoot(); return; }
    var toks = c.path.split(' ');
    E.cpath.textContent = c.kind === 'global' ? 'global' : toks.slice(0, -1).join(' › ') || 'top level';
    E.cname.textContent = name(c);
    if (c.kind === 'mode') E.cname.appendChild(chip('mode', 'mode')); else E.cname.appendChild(chip(c.effect, c.effect));
    forms(c).forEach(function (f) {
      var d = document.createElement('div'); d.className = 'form';
      if (typeof f[0] === 'string') { var ps = document.createElement('span'); ps.className = 'ps'; ps.textContent = f[0]; d.appendChild(ps); d.appendChild(document.createTextNode(f[1])); }
      else f.forEach(function (l, i) { if (i) d.appendChild(document.createTextNode('\n')); var p = document.createElement('span'); p.className = 'ps'; p.textContent = l[0]; d.appendChild(p); d.appendChild(document.createTextNode(l[1])); });
      E.cforms.appendChild(d);
    });
    E.cusage.appendChild(code(c.usage));
    var meta = c.kind === 'mode' ? 'A mode: enter it and the prompt changes; its commands are typed without the prefix.' : EFFECT[c.effect] || '';
    E.cmeta.textContent = meta;
    if (children[c.path]) {
      children[c.path].forEach(function (s) {
        var li = document.createElement('li'), a = document.createElement('a'); a.href = hashOf(s.path); a.appendChild(code(s.usage)); li.appendChild(a);
        var t = document.createElement('span'); t.className = 'muted'; t.textContent = s.kind === 'mode' ? 'mode' : s.effect; li.appendChild(t);
        E.csubs.appendChild(li);
      });
    }
    var ex = X['cli-' + toks.join('-')];
    if (ex) E.cprov.textContent = 'recorded run: ' + ex.source + ' · ' + ex.date;
    else E.cprov.textContent = 'no recorded run on this page yet; the replay shows the prompt only';
    seenIn(c.path).forEach(function (h) { var a = document.createElement('a'); a.href = h[1]; a.textContent = h[0]; E.cseen.appendChild(a); });
    if (E.cseen.firstChild) { var lbl = document.createElement('span'); lbl.className = 'muted'; lbl.textContent = 'Shown in: '; E.cseen.insertBefore(lbl, E.cseen.firstChild); }
    replay();
  }
  function showRoot() {
    E.cpath.textContent = 'frad_cli';
    E.cname.textContent = 'The prompt';
    E.cmeta.textContent = 'frad_cli is the login shell. The prompt names the node, then the mode once one is entered: h1> at the top, h1:node disks> inside node disks, cluster> in the cluster scope, which acts on every member. Every command names its scope first.';
    var ex = X['cli-login'];
    if (ex) E.cprov.textContent = 'recorded run: ' + ex.source + ' · ' + ex.date;
    children[''].forEach(function (s) {
      var li = document.createElement('li'), a = document.createElement('a'); a.href = hashOf(s.path); a.appendChild(code(s.usage)); li.appendChild(a);
      var t = document.createElement('span'); t.className = 'muted'; t.textContent = s.kind === 'mode' ? 'mode' : s.effect; li.appendChild(t);
      E.csubs.appendChild(li);
    });
    replay();
  }
  function replay() {
    T.cancel(); T.clear();
    var c = byPath[current], ex = X['cli-' + (current ? current.split(' ').join('-') : 'login')];
    if (ex) { T.play(T.session(ex.lines), null, false); return; }
    if (!c) return;
    var items = [], toks = c.path.split(' ');
    if (c.kind === 'global') items.push({ k: 'type', prompt: 'h1> ', s: c.path });
    else toks.forEach(function (t, i) { items.push({ k: 'type', prompt: promptAt(toks.slice(0, i)), s: t }); });
    items.push({ k: 'note', s: c.kind === 'mode' ? '# the prompt is now ' + promptAt(toks).trim() : '# output not recorded on this page yet' });
    T.play(items, null, false);
  }

  buildTree();
  E.replay.addEventListener('click', replay);
  window.addEventListener('hashchange', function () { show(pathOf(location.hash)); });
  show(pathOf(location.hash));
})();
