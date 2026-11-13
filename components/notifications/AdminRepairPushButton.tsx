'use client'

import { useEffect, useState } from 'react'
import { hasPushSubscription } from '@/lib/push/has-subscription'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i)
  return output
}

/** Subscribe only. The permission prompt must come from a click, or iOS ignores it. */
async function saveAdminPush(vapidPublicKey: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return false
  if (Notification.permission !== 'granted') return false

  const registration = await navigator.serviceWorker.register('/sw.js')
  let subscription = await registration.pushManager.getSubscription()
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    })
  }
  const payload = subscription.toJSON()
  const res = await fetch('/api/chat/admin/push-subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ endpoint: payload.endpoint, keys: payload.keys }),
  })
  return res.ok
}

/**
 * Admin repair and chat pushes share one subscription.
 * If permission is already granted, refresh it quietly.
 * If it has never been asked, wait for a tap. iOS will not show the sheet from a timer.
 */
export function AdminRepairPushButton() {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const [needsTap, setNeedsTap] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!vapidPublicKey || typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'granted') {
      void saveAdminPush(vapidPublicKey).catch(() => undefined)
      return
    }
    if (Notification.permission === 'default') setNeedsTap(true)
  }, [vapidPublicKey])

  if (!needsTap || !vapidPublicKey) return null

  return (
    <div className="flex items-center justify-between gap-3 border-b-2 border-black bg-white px-3 py-2">
      <p className="text-sm text-black">Turn on alerts for new repairs and messages.</p>
      <button
        type="button"
        disabled={saving}
        onClick={() => {
          setSaving(true)
          void Notification.requestPermission()
            .then((permission) => {
              if (permission !== 'granted') return false
              return saveAdminPush(vapidPublicKey)
            })
            .then((saved) => {
              if (saved) setNeedsTap(false)
            })
            .catch(() => undefined)
            .finally(() => setSaving(false))
        }}
        className="shrink-0 rounded-lg bg-black px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
      >
        {saving ? '…' : 'Enable'}
      </button>
    </div>
  )
}
