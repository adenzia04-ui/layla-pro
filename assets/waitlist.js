/* The launch waitlist. While a store link at the top of the page is empty,
   its buttons open this form instead of going nowhere: an email address and
   a platform, sent to the waitlist Worker, which mails each person once on
   the day their store listing goes live. store-link.js decides which buttons
   open it; this file only draws and sends the form. */
(function () {
  var cfg = window.LAYLA || {};
  var endpoint = (cfg.WAITLIST_URL || '').replace(/\/+$/, '');
  var STORE = { ios: 'the App Store', android: 'Google Play' };

  var dlg = document.createElement('dialog');
  dlg.className = 'waitlist';
  dlg.setAttribute('aria-labelledby', 'wl-title');
  dlg.innerHTML =
    '<button type="button" class="wl-close" aria-label="Close">' +
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
    '</button>' +
    '<form class="wl-form" novalidate>' +
      '<p class="eyebrow">Waitlist</p>' +
      '<h2 id="wl-title">Be first to get Layla Pro.</h2>' +
      '<p class="wl-lede">Leave your email and I will write once, the day it is on <span data-wl-store>the App Store</span>.</p>' +
      '<fieldset class="wl-platform">' +
        '<legend>Your phone</legend>' +
        '<label><input type="radio" name="platform" value="ios" checked>' +
          '<span><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.8 1.3 10.3.9 1.3 1.9 2.7 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8 2.3-1.3 3.1-2.5c1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.2zM13.9 4.9c.7-.9 1.2-2 1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.2.1 2.4-.6 3.1-1.5z"/></svg>iPhone</span></label>' +
        '<label><input type="radio" name="platform" value="android">' +
          '<span><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.6 9.5l1.7-2.9a.35.35 0 0 0-.6-.35l-1.72 2.98A10.6 10.6 0 0 0 12 8c-1.8 0-3.5.43-5 1.23L5.3 6.25a.35.35 0 1 0-.6.35l1.7 2.9C3.6 11 1.8 13.3 1.5 16h21c-.3-2.7-2.1-5-4.9-6.5zM7 14a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm10 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2z"/></svg>Android</span></label>' +
      '</fieldset>' +
      '<label class="wl-field"><span>Email</span>' +
        '<input type="email" name="email" autocomplete="email" inputmode="email" placeholder="you@gmail.com" required maxlength="254">' +
      '</label>' +
      /* No person sees or fills this; most bots do. */
      '<label class="wl-trap" aria-hidden="true">Company<input type="text" name="company" tabindex="-1" autocomplete="off"></label>' +
      '<button type="submit" class="btn big wl-submit">Join the waitlist</button>' +
      '<p class="wl-status" role="status" aria-live="polite"></p>' +
      '<p class="wl-fine">One email, on launch day. Nothing else, and your address is never shared.</p>' +
    '</form>' +
    '<div class="wl-done" hidden>' +
      '<span class="wl-tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' +
      '<h2 tabindex="-1">You are on the list.</h2>' +
      '<p class="wl-lede">I will email <b data-wl-email></b> the day Layla Pro is on <span data-wl-store>the App Store</span>. In sha Allah, soon.</p>' +
      '<button type="button" class="btn ghost big wl-ok">Done</button>' +
    '</div>';
  document.body.appendChild(dlg);

  var form = dlg.querySelector('form');
  var done = dlg.querySelector('.wl-done');
  var status = dlg.querySelector('.wl-status');
  var submit = dlg.querySelector('.wl-submit');
  var email = form.elements.email;

  function platform() {
    var r = form.querySelector('input[name="platform"]:checked');
    return r ? r.value : 'ios';
  }
  function showStore() {
    var name = STORE[platform()];
    dlg.querySelectorAll('[data-wl-store]').forEach(function (n) { n.textContent = name; });
  }
  function say(text, bad) {
    status.textContent = text || '';
    status.classList.toggle('bad', !!bad);
  }
  function close() { if (dlg.open) dlg.close(); }

  form.addEventListener('change', function (e) { if (e.target.name === 'platform') showStore(); });
  dlg.querySelector('.wl-close').addEventListener('click', close);
  dlg.querySelector('.wl-ok').addEventListener('click', close);
  // A click on the backdrop lands on the dialog itself, not on its contents.
  dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var addr = email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(addr)) {
      say('That email does not look right. Check it and try again.', true);
      email.focus();
      return;
    }
    if (!endpoint) { say('The waitlist is not open yet. Please try again later.', true); return; }
    submit.disabled = true;
    say('Adding you…');
    fetch(endpoint + '/join', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: addr, platform: platform(), company: form.elements.company.value })
    }).then(function (res) {
      if (res.ok) {
        dlg.querySelector('[data-wl-email]').textContent = addr;
        form.hidden = true;
        done.hidden = false;
        say('');
        done.querySelector('h2').focus();
      } else if (res.status === 400) {
        say('That email does not look right. Check it and try again.', true);
      } else {
        say('Something went wrong on my side. Please try again in a minute.', true);
      }
    }).catch(function () {
      say('Could not reach the waitlist. Check your connection and try again.', true);
    }).then(function () { submit.disabled = false; });
  });

  window.LaylaWaitlist = {
    open: function (which) {
      var r = form.querySelector('input[name="platform"][value="' + (which === 'android' ? 'android' : 'ios') + '"]');
      if (r) r.checked = true;
      showStore();
      form.hidden = false;
      done.hidden = true;
      say('');
      if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
      email.focus();
    }
  };
})();
