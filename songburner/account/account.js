/* Signed in. Before going back, check the site's own session took: ask this page
   again (which also sets the session cookie, in case the browser dropped it on the
   way in) and then ask the cloud who we are. If that works, tell the app to sync
   when it opens and go back to it. If not, stay here and say why, as a short code. */
(function () {
  var msg = document.getElementById('msg');
  function fail(code) {
    if (msg) msg.textContent = 'Sign-in didn’t finish (' + code + '). Try again from Settings.';
  }
  var code = 'network';
  fetch(location.pathname + '?check=' + Date.now(), { credentials: 'same-origin', cache: 'no-store', redirect: 'manual' })
    .then(function (r) {
      code = r.type === 'opaqueredirect' ? 'access' : (r.headers.get('X-SB-Signin') || 'no-worker');
      return fetch('/api/songburner/me', { credentials: 'same-origin', cache: 'no-store', redirect: 'manual' });
    })
    .then(function (r) {
      if (!r.ok) { fail(code + ', ' + r.status); return; }
      try { localStorage.setItem('sb-account-signin', String(Date.now())); } catch (e) {}
      location.replace('../');
    })
    .catch(function () { fail(code); });
})();
