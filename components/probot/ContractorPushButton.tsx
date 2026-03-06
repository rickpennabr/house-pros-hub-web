'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff } from 'lucide-react';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

/**
 * Bell button for contractors to enable Web Push when visitors message their business.
 * Shown in ProBot layout when user has a business (contractor).
 */
export default function ContractorPushButton() {
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushRegistering, setPushRegistering] = useState(false);

  const vapidPublicKey = typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY : null;

  const registerPush = useCallback(async () => {
    if (!vapidPublicKey || pushRegistering || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
    setPushRegistering(true);
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      await reg.update();
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushEnabled(false);
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      const payload = sub.toJSON();
      const res = await fetch('/api/chat/contractor/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: payload.endpoint, keys: payload.keys }),
      });
      setPushEnabled(res.ok);
    } catch {
      setPushEnabled(false);
    } finally {
      setPushRegistering(false);
    }
  }, [vapidPublicKey, pushRegistering]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPushEnabled(Notification.permission === 'granted');
  }, []);

  if (!vapidPublicKey) return null;

  return (
    <button
      type="button"
      onClick={registerPush}
      disabled={pushRegistering || pushEnabled === true}
      className="w-10 h-10 rounded-lg border-2 border-black flex items-center justify-center bg-white shrink-0 hover:bg-gray-50 transition-colors disabled:opacity-60 cursor-pointer"
      title={pushEnabled ? 'Push notifications enabled' : 'Enable push when visitors message your business'}
      aria-label={pushEnabled ? 'Push enabled' : 'Enable push'}
    >
      {pushEnabled ? <Bell className="w-5 h-5 text-green-600" /> : <BellOff className="w-5 h-5 text-black" />}
    </button>
  );
}
