/* Wires the store buttons to the two links at the top of each page.
   [data-store] is the App Store, [data-play] is Google Play. While a link is
   empty its button keeps the "coming" tag and points at the page's own
   "Get it" section, so no visitor is ever sent to a placeholder listing. */
(function () {
  var cfg = window.LAYLA || {};
  var stores = [
    { attr: 'data-store', url: (cfg.STORE_URL || '').trim(), name: 'App Store' },
    { attr: 'data-play', url: (cfg.PLAY_URL || '').trim(), name: 'Google Play' }
  ];
  var liveNames = [];
  for (var s = 0; s < stores.length; s++) {
    var store = stores[s];
    var btns = document.querySelectorAll('[' + store.attr + ']');
    if (store.url) liveNames.push(store.name);
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (store.url) {
        b.href = store.url;
        b.setAttribute(store.attr, 'live');
        b.setAttribute('rel', 'noopener');
        b.removeAttribute('aria-describedby');
      } else {
        b.setAttribute(store.attr, 'soon');
        b.setAttribute('aria-label', store.name + ', link coming');
      }
    }
  }
  var note = document.getElementById('get-note');
  if (note && liveNames.length) {
    note.textContent = 'Layla Pro is on ' + liveNames.join(' and ') +
      '. Install it, tell it where you are, and tonight\u2019s window is already drawn.';
  }
  var contact = document.getElementById('contact-link');
  if (contact && cfg.CONTACT) contact.href = cfg.CONTACT;
})();
