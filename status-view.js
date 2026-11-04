/* status.html (#537): one row per gate of each commit from window.FRAD_STATUS (status.js, rendered
   by site-status); a commit without a gate gets one row, every stage not run. */
(function () {
  var d = window.FRAD_STATUS, table = document.getElementById('status-table');
  var note = document.getElementById('status-note');
  if (!d) { note.textContent = 'No status data was published with this site.'; return; }
  note.textContent = d.read ? 'Newest first, ' + d.commits.length + ' commits.' : 'Not known: ' + d.note + '.';
  function cell(tr, text, cls) {
    var td = document.createElement('td'); td.textContent = text; if (cls) td.className = cls; tr.appendChild(td);
  }
  var head = document.createElement('tr');
  ['Commit', 'Date', 'Gate', 'Result', 'Tests', 'Suites', 'Duration', 'Gold'].concat(d.stages).forEach(function (h) {
    var th = document.createElement('th'); th.textContent = h; head.appendChild(th);
  });
  table.appendChild(head);
  d.commits.forEach(function (c) {
    var gates = c.gates.length ? c.gates : [null];
    gates.forEach(function (g, n) {
      var tr = document.createElement('tr');
      if (!n) tr.id = 'c-' + c.commit;   // cli.html links here: status.html#c-<tree commit> (#1178)
      cell(tr, c.commit); cell(tr, g ? g.date : c.date);
      if (!g) {
        cell(tr, d.read ? 'no gate ran' : 'not known'); for (var i = 0; i < 5; i++) cell(tr, '');
      } else {
        cell(tr, g.level + (g.full ? ' full' : '') + (g.top ? ' on ' + g.top : ''));
        cell(tr, g.result, g.state === 'success' ? 'pass' : 'fail');
        cell(tr, g.tests === null ? '' : String(g.tests)); cell(tr, g.suites === null ? '' : String(g.suites));
        cell(tr, g.duration || ''); cell(tr, g.gold || '');
      }
      d.stages.forEach(function (s) {
        var ran = g && g.stages[s];
        cell(tr, !ran ? 'not run' : g.state === 'success' ? 'passed' : 'ran', ran ? 'ran' : 'notrun');
      });
      table.appendChild(tr);
    });
  });
})();
