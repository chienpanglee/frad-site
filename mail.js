// The address is put together here, not written in the page (fewer scrapers): every
// [data-mail-text] shows it as plain text, a [data-mail-copy] button copies it.
(function () {
  var to = 'lee.chienpang' + '@' + 'gmail.com';
  document.querySelectorAll('[data-mail-text]').forEach(function (e) { e.textContent = to; });
  document.querySelectorAll('[data-mail-copy]').forEach(function (b) {
    var label = b.textContent;
    b.addEventListener('click', function () {
      navigator.clipboard.writeText(to).then(function () {
        b.textContent = 'Copied'; setTimeout(function () { b.textContent = label; }, 2000);
      }, function () { b.textContent = 'Select the address to copy it'; });
    });
  });
})();
