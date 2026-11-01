'use client'

import { useState } from 'react'

export function InstallerShare({ path }: { path: string }) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = `${window.location.origin}${path}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="mt-8 w-full rounded-lg border-2 border-black bg-black px-4 py-2.5 font-medium text-white"
    >
      {copied ? 'Link copied' : 'Share this page'}
    </button>
  )
}
