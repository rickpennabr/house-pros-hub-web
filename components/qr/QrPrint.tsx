'use client'

import { useRef } from 'react'
import { Download } from 'lucide-react'
import { HphQrCode, type HphQrCodeHandle } from '@/components/qr/HphQrCode'

interface QrPrintProps {
  url: string
  fileName: string
}

/** HPH mark in the center. Corner eyes stay solid so a phone can lock on. */
export function QrPrint({ url, fileName }: QrPrintProps) {
  const ref = useRef<HphQrCodeHandle>(null)

  const download = async () => {
    const blob = await ref.current?.toPngBlob()
    if (!blob) return
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    link.click()
    URL.revokeObjectURL(objectUrl)
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-lg border-2 border-black bg-white p-3">
        <HphQrCode ref={ref} value={url} displaySize={240} />
      </div>
      <p className="text-sm text-center break-all">{url}</p>
      <button
        type="button"
        onClick={() => void download()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-black bg-black text-white text-sm font-medium"
      >
        <Download className="w-4 h-4" />
        Download PNG
      </button>
    </div>
  )
}
