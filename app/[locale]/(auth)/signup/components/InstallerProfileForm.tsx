'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale } from 'next-intl'
import { SignupHeader } from './SignupHeader'

export function InstallerProfileForm({ variant = 'installer' }: { variant?: 'installer' | 'handyman' }) {
  const locale = useLocale()
  const isHandyman = variant === 'handyman'
  const [trades, setTrades] = useState('')
  const [serviceArea, setServiceArea] = useState('')
  const [bio, setBio] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [savedPath, setSavedPath] = useState('')

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch(isHandyman ? '/api/handyman/profile' : '/api/installer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trades, serviceArea, bio }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not save your profile')
        return
      }
      setSavedPath(`/${locale}/${isHandyman ? 'handymen' : 'installers'}/${data.slug}`)
    } catch {
      setError('Could not save your profile')
    } finally {
      setSaving(false)
    }
  }

  if (savedPath) {
    return (
      <>
        <SignupHeader isLoading={false} />
        <div className="mx-auto flex w-full max-w-md flex-col gap-3 text-black">
          <h2 className="text-2xl font-semibold">Your details page is ready</h2>
          <p className="text-sm text-gray-600">Share this link. It is not listed with the public pro cards.</p>
          <Link href={savedPath} className="rounded-lg border-2 border-black bg-black px-4 py-2.5 text-center font-medium text-white">
            Open my page
          </Link>
        </div>
      </>
    )
  }

  return (
    <>
      <SignupHeader isLoading={saving} />
      <form onSubmit={onSubmit} className="mx-auto flex w-full max-w-md flex-col gap-4 text-black">
        <div>
          <h2 className="text-2xl font-semibold">{isHandyman ? 'Your handyman profile' : 'Your installer profile'}</h2>
          <p className="mt-1 text-sm text-gray-600">
            {isHandyman
              ? 'This page is shareable. It does not appear as a public card. It is for small repairs and projects under $1,000, including labor and materials.'
              : 'This page is shareable. It does not appear as a public card in the House Pros list.'}
          </p>
        </div>
        <label className="block text-sm font-medium">
          {isHandyman ? 'What you repair' : 'What you install'}
          <input
            value={trades}
            onChange={(event) => setTrades(event.target.value)}
            placeholder={isHandyman ? 'Drywall, doors, fixtures' : 'Pavers, tile, irrigation'}
            required
            className="mt-1 w-full rounded-lg border-2 border-black px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium">
          Service area
          <input
            value={serviceArea}
            onChange={(event) => setServiceArea(event.target.value)}
            placeholder="Las Vegas"
            className="mt-1 w-full rounded-lg border-2 border-black px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium">
          About you
          <textarea
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            rows={4}
            className="mt-1 w-full rounded-lg border-2 border-black px-3 py-2 text-sm"
          />
        </label>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border-2 border-black bg-black px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save and get my page'}
        </button>
      </form>
    </>
  )
}
