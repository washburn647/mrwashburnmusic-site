/* Signed in: tell the app to sync when it opens, and go back to it. */
try { localStorage.setItem('sb-account-signin', String(Date.now())); } catch (e) {}
location.replace('../');
