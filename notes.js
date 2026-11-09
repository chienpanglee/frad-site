// Engineering notes (#1493): every post of the blog, newest first, from its posts.json at each load.
// The static content of [data-notes] stays when the script, the fetch or the list fails.
(function () {
  var BLOG = 'https://chienpanglee.github.io/';

  // A usable list, sorted by date descending, or null: nothing to show, keep the static content.
  function posts(data) {
    if (!Array.isArray(data)) return null;
    var ok = data.filter(function (p) {
      return p && typeof p.title === 'string' && p.title !== '' &&
        typeof p.url === 'string' && p.url.indexOf(BLOG) === 0 &&
        typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date);
    });
    if (!ok.length) return null;
    return ok.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  }

  function render(box, list) {
    var ol = document.createElement('ol');
    ol.className = 'notes';
    list.forEach(function (p) {
      var li = document.createElement('li'), time = document.createElement('time'),
        h = document.createElement('h3'), a = document.createElement('a');
      time.dateTime = p.date;
      time.textContent = p.date;
      a.href = p.url;
      a.textContent = p.title;
      h.appendChild(a);
      li.appendChild(time);
      li.appendChild(h);
      if (typeof p.summary === 'string' && p.summary !== '') {
        var s = document.createElement('p');
        s.textContent = p.summary;
        li.appendChild(s);
      }
      ol.appendChild(li);
    });
    box.classList.remove('cols');
    box.replaceChildren(ol);
  }

  function load(box) {
    return fetch(BLOG + 'posts.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('posts.json: ' + r.status); return r.json(); })
      .then(function (d) { var l = posts(d); if (l) render(box, l); return !!l; })
      .catch(function () { return false; });
  }

  window.FRAD_NOTES = { posts: posts, load: load };
  var box = document.querySelector('[data-notes]');
  if (box && window.fetch) load(box);
})();
