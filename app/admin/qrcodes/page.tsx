'use client'

import { FormEvent, useEffect, useState } from 'react'
import type { ScanStats } from '@/lib/qr/types'
import { QrPrint } from '@/components/qr/QrPrint'
import { QrStats } from '@/components/qr/QrStats'

interface CodeRow {
  id: string
  code: string
  url: string
  kind: 'site' | 'card' | 'extra'
  label: string
  destination: string
  scanCount: number
  lastScannedAt: string | null
  ownerName: string
}

export default function AdminQrCodesPage() {
  const [codes, setCodes] = useState<CodeRow[]>([])
  const [stats, setStats] = useState<ScanStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [label, setLabel] = useState('')
  const [destination, setDestination] = useState('https://')
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const load = () => {
    fetch('/api/admin/qrcodes', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setCodes(data.codes ?? [])
        setStats(data.stats)
        const next: Record<string, string> = {}
        for (const row of data.codes ?? []) next[row.id] = row.destination
        setDrafts(next)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load QR codes'))
  }

  useEffect(() => {
    load()
  }, [])

  const post = async (body: Record<string, string>) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/qrcodes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')
      setLabel('')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const saveLink = async (id: string) => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/qrcodes', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, destination: drafts[id] ?? '' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not save')
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
    } finally {
      setBusy(false)
    }
  }

  const site = codes.find((row) => row.kind === 'site') ?? null

  const onCreate = (event: FormEvent) => {
    event.preventDefault()
    void post({ label, destination })
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">QR code system</h1>
        <p className="text-sm text-gray-700 mt-1">
          Print the code. It always opens the short link, then we send the phone to the page you set. Change that page any time. The printed mark does not change, and every scan is counted.
        </p>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {stats ? <QrStats stats={stats} /> : <p className="text-sm text-gray-600">Loading…</p>}

      {site ? (
        <section className="border-2 border-black rounded-lg p-4 space-y-4">
          <h2 className="font-semibold">House Pros Hub card</h2>
          <QrPrint url={site.url} fileName="houseproshub-qr.png" />
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              value={drafts[site.id] ?? ''}
              onChange={(event) => setDrafts((current) => ({ ...current, [site.id]: event.target.value }))}
              className="flex-1 px-3 py-2 border-2 border-black rounded-lg text-sm"
              aria-label="House Pros Hub link"
            />
            <button type="button" disabled={busy} onClick={() => void saveLink(site.id)} className="px-4 py-2 rounded-lg border-2 border-black bg-black text-white text-sm">
              Save link
            </button>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void post({ action: 'sync' })}
          className="px-4 py-2 rounded-lg border-2 border-black text-sm font-medium"
        >
          Create cards for professionals and installers
        </button>
      </div>

      <div className="overflow-x-auto border-2 border-black rounded-lg">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="p-2">Name</th>
              <th className="p-2">Who</th>
              <th className="p-2">Scans</th>
              <th className="p-2">Last scan</th>
              <th className="p-2">Opens</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((row) => (
              <tr key={row.id} className="border-t border-gray-200 align-top">
                <td className="p-2">
                  <span className="font-medium">{row.label}</span>
                  <span className="block text-xs text-gray-600 break-all">{row.url.replace(/^https?:\/\//, '')}</span>
                </td>
                <td className="p-2">{row.ownerName}</td>
                <td className="p-2">{row.scanCount}</td>
                <td className="p-2 whitespace-nowrap">{row.lastScannedAt ? new Date(row.lastScannedAt).toLocaleString() : '—'}</td>
                <td className="p-2">
                  <div className="flex gap-2 min-w-[240px]">
                    <input
                      value={drafts[row.id] ?? ''}
                      onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: event.target.value }))}
                      className="flex-1 px-2 py-1 border-2 border-black rounded-lg text-xs"
                    />
                    <button type="button" disabled={busy} onClick={() => void saveLink(row.id)} className="px-2 py-1 border-2 border-black rounded-lg text-xs">
                      Save
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={onCreate} className="border-2 border-black rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Another code</h2>
        <p className="text-sm text-gray-700">Use this for a second printed piece, such as a flyer. It gets its own scan count.</p>
        <input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Name"
          className="w-full px-3 py-2 border-2 border-black rounded-lg text-sm"
        />
        <input
          value={destination}
          onChange={(event) => setDestination(event.target.value)}
          placeholder="https://houseproshub.com/"
          className="w-full px-3 py-2 border-2 border-black rounded-lg text-sm"
        />
        <button type="submit" disabled={busy} className="px-4 py-2 rounded-lg border-2 border-black bg-black text-white text-sm">
          Create code
        </button>
      </form>
    </div>
  )
}
