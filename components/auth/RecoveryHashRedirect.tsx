'use client';

import { useSyncExternalStore } from 'react';

/**
 * Password-recovery links can land on any page with the session in the URL hash.
 * This runs while the document is parsing so the browser leaves for the
 * reset-password page before React hydrates. GlobalHashHandler covers the
 * same case after the app is already running.
 *
 * The script is included only for the server render and the matching hydration
 * render. React 19 warns (and will not execute) an inline script created during
 * a later client render.
 */
const RECOVERY_REDIRECT_SCRIPT = `(function() {
  var pathname = window.location.pathname || '';
  if (pathname.indexOf('reset-password') !== -1) return;
  var hash = window.location.hash || '';
  if (hash.length < 10) return;
  try {
    var p = new URLSearchParams(hash.substring(1));
    if (p.get('access_token') && p.get('refresh_token') && p.get('type') === 'recovery') {
      var seg = pathname.split('/')[1];
      var locale = (seg === 'es' || seg === 'en' || seg === 'pt') ? seg : 'en';
      window.location.replace('/' + locale + '/reset-password' + hash);
    }
  } catch (e) {}
})();`;

function subscribe(): () => void {
  return () => {};
}

export function RecoveryHashRedirect() {
  const includeScript = useSyncExternalStore(
    subscribe,
    () => false,
    () => true
  );

  if (!includeScript) return null;

  return (
    <script
      id="hash-fragment-recovery-redirect"
      dangerouslySetInnerHTML={{ __html: RECOVERY_REDIRECT_SCRIPT }}
    />
  );
}
