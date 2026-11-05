// The Scan page (#597): renders scan.json, which make -C core/main site-scan writes from the
// release's grype reports. Every report string goes in as text, never as markup.
(function () {
  "use strict";
  var SEV = ["Critical", "High", "Medium", "Low", "Negligible", "Unknown"];
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  function metaLine(m) {
    var parts = [];
    if (m.grype) parts.push("grype " + m.grype);
    if (m.db_schema) parts.push("DB " + m.db_schema + (m.db_built ? ", built " + m.db_built.slice(0, 10) : ""));
    if (m.syft) parts.push("syft " + m.syft);
    if (m.sbom_format) parts.push(m.sbom_format + (m.components ? ", " + m.components + " components" : ""));
    Object.keys(m).forEach(function (k) {
      if (["grype", "db_schema", "db_built", "syft", "sbom_format", "components"].indexOf(k) < 0) parts.push(k + " " + m[k]);
    });
    return parts.join(" · ");
  }
  function report(r) {
    var box = el("section", "report");
    box.appendChild(el("h2", "", r.name));
    var t = el("div", "totals");
    SEV.forEach(function (s) { if (r.totals[s]) t.appendChild(el("span", s, r.totals[s] + " " + s)); });
    box.appendChild(t);
    box.appendChild(el("p", "meta", metaLine(r.metadata || {})));
    if (!r.findings.length) { box.appendChild(el("p", "meta", "No Critical or High finding.")); return box; }
    var d = el("details"); d.appendChild(el("summary", "", r.findings.length + " Critical and High findings"));
    var wrap = el("div", "tablewrap"), tb = el("table", "findings"), head = el("tr");
    ["Severity", "ID", "Package", "Installed", "Fixed in", "State"].forEach(function (h) { head.appendChild(el("th", "", h)); });
    tb.appendChild(head);
    r.findings.forEach(function (f) {
      var tr = el("tr");
      tr.appendChild(el("td", "", f.severity));
      tr.appendChild(el("td", "mono", f.id));
      tr.appendChild(el("td", "mono", f.package));
      tr.appendChild(el("td", "mono", f.installed));
      tr.appendChild(el("td", "mono", (f.fixed_in || []).join(", ")));
      tr.appendChild(el("td", "", f.state + (f.accepted ? ": " + f.accepted : "")));
      tb.appendChild(tr);
    });
    wrap.appendChild(tb); d.appendChild(wrap); box.appendChild(d);
    return box;
  }
  function show(rel) {
    var m = "Commit " + rel.commit + ", built " + rel.built + (rel.production ? ", production build" : ", development build");
    if (rel.change) m += ". Since " + rel.change.previous + ": " + rel.change.added + " Critical/High added, " + rel.change.gone + " gone";
    document.getElementById("relmeta").textContent = m + ".";
    var box = document.getElementById("reports");
    box.textContent = "";
    rel.reports.forEach(function (r) { box.appendChild(report(r)); });
  }
  fetch("scan.json").then(function (r) { return r.json(); }).then(function (scan) {
    var sel = document.getElementById("release");
    scan.releases.forEach(function (rel, i) { var o = el("option", "", rel.release); o.value = i; sel.appendChild(o); });
    sel.addEventListener("change", function () { show(scan.releases[sel.value]); });
    if (scan.releases.length) show(scan.releases[0]);
  }).catch(function () {
    document.getElementById("reports").textContent = "No scan reports published yet.";
  });
})();
