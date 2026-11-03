'use client'

import { FormEvent, useEffect, useState } from 'react'
import type { ScanStats } from '@/lib/qr/types'
import { QrPrint } from '@/components/qr/QrPrint'
import { QrStats } from '@/components/qr/QrStats'

interface Mine {
  id: string
  url: string
  label: string
  destination: string
  scanCount: number
  lastScannedAt: string | null
}

export function MyQrCode() {
  const [code, setCode] = useState<Mine | null>(null)
  const [stats, setStats] = useState<ScanStats | null>(null)
  const [destination, setDestination] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/qr', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setCode(data.code)
        setStats(data.stats)
        setDestination(data.code.destination)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the QR code'))
  }, [])

  const onSave = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const res = await fetch('/api/qr', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')
      setCode((current) => (current ? { ...current, destination } : current))
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  if (error && !code) return <p className="text-sm text-red-600">{error}</p>
  if (!code || !stats) return <p className="text-sm text-gray-600">Loading…</p>

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Your QR code</h1>
        <p className="text-sm text-gray-700 mt-1">
          Print this on the back of your card. The mark stays the same if you change the link later. Each phone scan is counted here.
        </p>
      </div>
      <QrPrint url={code.url} fileName="my-card-qr.png" />
      <QrStats stats={stats} />
      <form onSubmit={onSave} className="border-2 border-black rounded-lg p-4 space-y-3">
        <label className="block text-sm font-medium" htmlFor="qr-destination">
          Opens this link
        </label>
        <input
          id="qr-destination"
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          className="w-full px-3 py-2 border-2 border-black rounded-lg text-sm"
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {saved ? <p className="text-sm">Saved. Cards already printed use the new link.</p> : null}
        <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg border-2 border-black bg-black text-white text-sm">
          {saving ? 'Saving…' : 'Save link'}
        </button>
      </form>
    </div>
  )
}
