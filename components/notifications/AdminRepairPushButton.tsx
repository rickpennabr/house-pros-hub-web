'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
  return output;
}

/**
 * Saves this browser or installed app as an admin push target.
 * A home-screen install has its own subscription, so enable it from the installed app.
 */
export function AdminRepairPushButton() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const busyRef = useRef(false);

  const registerPush = useCallback(async () => {
    if (!vapidPublicKey || busyRef.current || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await registration.update();
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setEnabled(false);
        return;
      }
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });
      const payload = subscription.toJSON();
      const response = await fetch('/api/chat/admin/push-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint: payload.endpoint, keys: payload.keys }),
      });
      setEnabled(response.ok);
      if (!response.ok) setFailed(true);
    } catch {
      setEnabled(false);
      setFailed(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [vapidPublicKey]);

  useEffect(() => {
    if (!vapidPublicKey || typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') {
      setEnabled(false);
      return;
    }
    void registerPush();
  }, [vapidPublicKey, registerPush]);

  if (!vapidPublicKey) return null;

  return (
    <div className="border-2 border-black rounded-lg p-3 mb-6 max-w-md">
      <p className="text-sm font-medium">Quick Repair alerts</p>
      <p className="text-sm text-gray-600 mt-1">
        This device gets a push when someone drops a quick repair. Turn it on from the installed app if you added House Pros Hub to your home screen.
      </p>
      <Button type="button" className="mt-3" disabled={busy || enabled === true} onClick={() => void registerPush()}>
        {busy ? 'Turning on…' : enabled ? 'Notifications on' : 'Turn on notifications'}
      </Button>
      {failed && <p className="text-sm text-red-600 mt-2">Notifications could not be turned on for this device.</p>}
    </div>
  );
}
