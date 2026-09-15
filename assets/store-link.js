/* Wires every [data-store] button to window.LAYLA.STORE_URL (set at the
   top of each page). While STORE_URL is empty the buttons keep their
   "coming" tag and point at the page's own "Get it" section, so no visitor
   is ever sent to a placeholder listing. */
(function () {
  var cfg = window.LAYLA || {}, url = (cfg.STORE_URL || '').trim();
  var btns = document.querySelectorAll('[data-store]');
  for (var i = 0; i < btns.length; i++) {
    var b = btns[i];
    if (url) {
      b.href = url;
      b.setAttribute('data-store', 'live');
      b.setAttribute('rel', 'noopener');
      b.removeAttribute('aria-describedby');
    } else {
      b.setAttribute('data-store', 'soon');
      b.setAttribute('aria-label', 'App Store, link coming');
    }
  }
  var note = document.getElementById('get-note');
  if (note && url) note.textContent = 'Layla Pro is on the App Store for iPhone. Install it, tell it where you are, and tonight’s window is already drawn.';
  var contact = document.getElementById('contact-link');
  if (contact && cfg.CONTACT) contact.href = cfg.CONTACT;
})();
