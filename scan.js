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
  // #2163: one row per CVE with its packages inside; the VEX status per package, the row shows the
  // one that needs most attention. Releases before #2163 (unit "row") render as they were written.
  var STATUS = [["affected", "Affected"], ["under_investigation", "Under investigation"], ["", "no statement"],
                ["fixed", "Fixed"], ["not_affected", "Not affected"]];
  var SHOWN = { affected: 1, under_investigation: 1, "": 1 };  // the default view; the rest one click away
  function statusName(s) {
    for (var i = 0; i < STATUS.length; i++) if (STATUS[i][0] === (s || "")) return STATUS[i][1];
    return s;
  }
  function cveTotals(r) {
    var t = el("div", "totals");
    ["Critical", "High"].forEach(function (s) {
      var n = r.totals[s] || 0, st = (r.status_totals || {})[s] || {}, b = [st.affected + " affected"];
      if (st.not_assessed) b.push(st.not_assessed + " not assessed");
      t.appendChild(el("span", n ? s : "", n + " " + s + " (" + b.join(", ") + ")"));
    });
    SEV.slice(2).forEach(function (s) { if (r.totals[s]) t.appendChild(el("span", "", r.totals[s] + " " + s)); });
    return t;
  }
  function cveTable(r) {
    var box = el("div", "cves"), chips = el("div", "statuses"), wrap = el("div", "tablewrap");
    var tb = el("table", "findings"), head = el("tr"), shown = {};
    Object.keys(SHOWN).forEach(function (k) { shown[k] = 1; });
    ["Severity", "CVE", "Status", "Packages", "Rated by"].forEach(function (h) { head.appendChild(el("th", "", h)); });
    tb.appendChild(head);
    var rows = r.findings.map(function (f) {
      var tr = el("tr"), more = el("tr", "pkgs"), cell = el("td"), b = el("button", "expand", f.id);
      b.type = "button"; b.setAttribute("aria-expanded", "false");
      b.addEventListener("click", function () {
        more.hidden = !more.hidden; b.setAttribute("aria-expanded", String(!more.hidden));
      });
      tr.appendChild(el("td", "", f.severity));
      var idc = el("td", "mono"); idc.appendChild(b);
      if (f.refs) idc.appendChild(el("div", "meta", f.refs.join(", ")));
      tr.appendChild(idc);
      tr.appendChild(el("td", "", statusName(f.status)));
      var n = f.packages.length;
      tr.appendChild(el("td", "mono", f.packages[0].package + (n > 1 ? " +" + (n - 1) : "")));
      tr.appendChild(el("td", "", f.rated_by || ""));
      cell.colSpan = 5; more.hidden = true;
      cell.appendChild(table(["Package", "Installed", "Fixed in", "State", "Status"], f.packages.map(function (p) {
        var st = statusName(p.status);
        if (p.justification) st += ": " + p.justification.replace(/_/g, " ");
        if (p.statement) st += ". " + p.statement;
        return [[p.package, "mono"], [p.installed, "mono"], [(p.fixed_in || []).join(", "), "mono"],
                [p.state + (p.accepted ? ": " + p.accepted : "")], [st]];
      })));
      more.appendChild(cell);
      tb.appendChild(tr); tb.appendChild(more);
      return { f: f, tr: tr, more: more, b: b };
    });
    function apply() {
      rows.forEach(function (x) {
        var on = shown[x.f.status || ""];
        x.tr.hidden = !on;
        if (!on) { x.more.hidden = true; x.b.setAttribute("aria-expanded", "false"); }
      });
    }
    STATUS.forEach(function (s) {
      var n = r.findings.filter(function (f) { return (f.status || "") === s[0]; }).length;
      var c = el("button", "chip", s[1] + " " + n);
      c.type = "button"; c.setAttribute("aria-pressed", String(!!shown[s[0]]));
      c.addEventListener("click", function () {
        if (shown[s[0]]) delete shown[s[0]]; else shown[s[0]] = 1;
        c.setAttribute("aria-pressed", String(!!shown[s[0]])); apply();
      });
      chips.appendChild(c);
    });
    apply();
    wrap.appendChild(tb);
    box.appendChild(chips); box.appendChild(wrap);
    return box;
  }
  function report(r) {
    var box = el("section", "report");
    box.appendChild(el("h2", "", r.name));
    if (r.unit === "cve") {
      box.appendChild(cveTotals(r));
      if (r.no_cve) box.appendChild(el("p", "meta", "Counted by CVE; " + r.no_cve + " without a CVE id kept under their own id."));
    } else {
      var t = el("div", "totals");
      SEV.forEach(function (s) { if (r.totals[s]) t.appendChild(el("span", s, r.totals[s] + " " + s)); });
      if (!("Medium" in r.totals)) t.appendChild(el("span", "", "Medium and lower not counted for this release"));
      box.appendChild(t);
      box.appendChild(el("p", "meta", "Counted by row (one per id, package and version), before the count by CVE."));
    }
    box.appendChild(el("p", "meta", metaLine(r.metadata || {})));
    if (!r.findings.length) box.appendChild(el("p", "meta", "No Critical or High finding."));
    else if (r.unit === "cve") box.appendChild(cveTable(r));
    else {
      var d = el("details"); d.appendChild(el("summary", "", r.findings.length + " Critical and High findings"));
      d.appendChild(table(["Severity", "ID", "Package", "Installed", "Fixed in", "State"], r.findings.map(function (f) {
        return [[f.severity], [f.id, "mono"], [f.package, "mono"], [f.installed, "mono"],
                [(f.fixed_in || []).join(", "), "mono"], [f.state + (f.accepted ? ": " + f.accepted : "")]];
      })));
      box.appendChild(d);
    }
    if (r.upstream_matches) box.appendChild(upstream(r.upstream_matches));
    return box;
  }
  function table(heads, rows) {
    var wrap = el("div", "tablewrap"), tb = el("table", "findings"), head = el("tr");
    heads.forEach(function (h) { head.appendChild(el("th", "", h)); });
    tb.appendChild(head);
    rows.forEach(function (row) {
      var tr = el("tr");
      row.forEach(function (c) { tr.appendChild(el("td", c[1] || "", c[0])); });
      tb.appendChild(tr);
    });
    wrap.appendChild(tb);
    return wrap;
  }
  function counts(t) {
    return SEV.filter(function (s) { return t[s]; }).map(function (s) { return t[s] + " " + s; }).join(", ");
  }
  // #2150: upstream-version matches on files a distro package owns (#2149), apart from the totals.
  function upstream(u) {
    var box = el("div", "upstream"), n = u.packages.length, c = counts(u.totals);
    box.appendChild(el("h3", "", u.label));
    box.appendChild(el("p", "meta", "Not in the totals above. A file that a distribution package owns is judged " +
      "by the distribution's tracking of that package; these matches compare only its upstream version. " +
      "Backport triage stays with the OpenVEX statements."));
    if (!n) { box.appendChild(el("p", "meta", "No upstream match.")); return box; }
    var d = el("details");
    d.appendChild(el("summary", "", n + (n === 1 ? " package" : " packages") + (c ? ": " + c : "")));
    d.appendChild(table(["Package", "Installed", "Owned by", "Matches"], u.packages.map(function (p) {
      return [[p.package, "mono"], [p.installed, "mono"], [p.owner, "mono"], [counts(p.totals) || "none"]];
    })));
    box.appendChild(d);
    return box;
  }
  function show(rel) {
    var m = "Commit " + rel.commit + ", built " + rel.built + (rel.production ? ", production build" : ", development build");
    if (rel.change) m += ". Since " + rel.change.previous + ": " + rel.change.added + " Critical/High " +
      (rel.change.unit === "cve" ? "CVEs " : "") + "added, " + rel.change.gone + " gone" +
      (rel.change.moved ? ", " + rel.change.moved + " moved to the upstream class" : "");
    var rm = document.getElementById("relmeta");
    rm.textContent = m + ".";
    if (rel.vex) {  // one document-level link: the release's OpenVEX, for a reader's own tooling
      var a = el("a", "", "OpenVEX document (" + rel.vex.statements + " statements)");
      a.href = rel.vex.document;
      rm.appendChild(document.createTextNode(" ")); rm.appendChild(a);
    }
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
