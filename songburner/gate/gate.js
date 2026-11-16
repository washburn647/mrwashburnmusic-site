/* Signed out of Song Burner. A tester who signed in before the app needed sign-in has the
   session only for the API: asking who we are hands it to the app's pages too (worker/index.js,
   /api/songburner/me), so try once and reload. Otherwise offer Sign in and Apply for beta. */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var TRIED = 'sb-gate-tried';

  function signedOut() {
    $('checking').hidden = true;
    $('out').hidden = false;
  }

  var tried = 0;
  try { tried = Number(sessionStorage.getItem(TRIED) || 0); } catch (e) {}
  if (Date.now() - tried < 60000) {
    signedOut();
  } else {
    fetch('/api/songburner/me', { credentials: 'same-origin', cache: 'no-store', redirect: 'manual' })
      .then(function (r) {
        if (!r.ok) return signedOut();
        try { sessionStorage.setItem(TRIED, String(Date.now())); } catch (e) {}
        try { localStorage.setItem('sb-account-signin', String(Date.now())); } catch (e) {}
        location.reload();
      })
      .catch(signedOut);
  }

  var form = $('apply'), mail = $('mail'), age = $('age'), send = $('send'), msg = $('msg');
  $('ask').addEventListener('click', function () {
    form.hidden = !form.hidden;
    if (!form.hidden) mail.focus();
  });
  age.addEventListener('change', function () { send.disabled = !age.checked; });
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!age.checked) return;
    send.disabled = true;
    send.textContent = 'Sending…';
    fetch('/api/songburner/apply', {
      method: 'POST', credentials: 'omit', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: mail.value.trim(), age13: true })
    }).then(function (res) {
      if (res.ok) {
        form.hidden = true;
        $('ask').disabled = true;
        msg.textContent = 'Request sent.';
        return;
      }
      return res.json().catch(function () { return {}; }).then(function (j) {
        send.disabled = false;
        send.textContent = 'Send';
        msg.textContent = j.error === 'email' ? 'That email doesn’t look right.'
          : j.error === 'busy' ? 'Too many requests. Try again tomorrow.'
          : 'Could not send (' + res.status + ').';
      });
    }).catch(function () {
      send.disabled = false;
      send.textContent = 'Send';
      msg.textContent = 'Could not send. Check the connection.';
    });
  });
})();
