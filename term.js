/* A terminal strip that replays what an operator typed at the frad_cli prompt and what came back.
   Shared by the stage (index.html) and the CLI tree (cli.html). Items: {k: 'type'|'note'|'out'|'err', s, prompt?}. */
window.FRADTerm = function (el, opts) {
  'use strict';
  opts = opts || {};
  var TYPE_MS = 26, TYPE_CAP = 1800, OUT_DELAY = 650, OUT_GAP = 160, PASTE_PAUSE = 450, KEEP = opts.keep || 40;
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var token = 0;
  var PROMPT = /^((?:h\d|[a-z][\w-]*)(?::[\w ]+)?> ?)(.*)$/;   // "h1> status", "h1:node disks> zfs_add …", "cluster> …"

  function clear() { el.textContent = ''; }
  function line(kind, prompt, text) {
    var ln = document.createElement('div'); ln.className = 'ln ' + kind;
    if (kind === 'cmd') { var ps = document.createElement('span'); ps.className = 'ps'; ps.textContent = prompt || 'h1> '; ln.appendChild(ps); }
    var body = document.createElement('span'); body.className = 'body'; body.textContent = text; ln.appendChild(body);
    el.appendChild(ln);
    while (el.children.length > KEEP) el.removeChild(el.firstChild);
    el.scrollTop = el.scrollHeight;
    return body;
  }
  function flush(items) { items.forEach(function (it) { line(it.k === 'type' ? 'cmd' : it.k, it.prompt, it.s); }); }
  function cancel() { token++; }

  // Plays the items; `apply` runs once, on the first Enter (or at once when nothing is typed); `paste` skips the typing.
  // Returns the time the replay needs.
  function play(items, apply, paste) {
    var my = ++token, t = 0, applied = false, sinceEnter = -1;
    var rate = paste || reduced ? 0 : TYPE_MS, pause = rate ? 300 : PASTE_PAUSE;
    function at(ms, fn) { setTimeout(function () { if (my === token) fn(); }, reduced ? 0 : ms); }
    function doApply() { if (!applied) { applied = true; if (apply) apply(); } }
    items.forEach(function (it) {
      if (it.k === 'type') {
        var dur = Math.min(TYPE_CAP, it.s.length * rate);
        at(t, function () {
          var body = line('cmd', it.prompt, rate ? '' : it.s); body.classList.add('typing');
          if (rate && it.s.length) {   // typed by elapsed time, so a throttled timer still lands the whole line by Enter
            var start = Date.now();
            (function tick() {
              if (my !== token) return;
              var i = Math.min(it.s.length, Math.ceil((Date.now() - start) / dur * it.s.length));
              body.textContent = it.s.slice(0, i);
              if (i < it.s.length) setTimeout(tick, TYPE_MS); else body.classList.remove('typing');
            })();
          } else setTimeout(function () { if (my === token) body.classList.remove('typing'); }, reduced ? 0 : pause);
        });
        t += dur + pause;
        at(t, doApply);
        sinceEnter = 0;
      } else if (it.k === 'note') {
        at(t, function () { line('note', null, it.s); });
      } else {   // out, err: the first line waits for the stage to react, the next ones follow in a row
        t += sinceEnter === 1 ? OUT_GAP : OUT_DELAY; sinceEnter = 1;
        at(t, function () { doApply(); line(it.k, null, it.s); });
      }
    });
    if (!items.some(function (it) { return it.k === 'type'; })) doApply();
    return t;
  }

  // A recorded session (raw log lines) becomes items: a line at a prompt is typed, the rest is printed.
  function session(lines) {
    return lines.map(function (l) {
      var m = PROMPT.exec(l);
      return m ? { k: 'type', prompt: m[1], s: m[2] } : { k: 'out', s: l };
    });
  }
  return { clear: clear, line: line, flush: flush, play: play, cancel: cancel, session: session, el: el };
};
