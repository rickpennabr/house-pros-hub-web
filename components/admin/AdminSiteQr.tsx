'use client'

import { useRef } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { HphQrCode, type HphQrCodeHandle } from '@/components/qr/HphQrCode'
import { HPH_SITE_QR_URL } from '@/lib/qr/draw-hph-qr'

export function AdminSiteQr() {
  const qrRef = useRef<HphQrCodeHandle>(null)

  const handleDownload = async () => {
    const blob = await qrRef.current?.toPngBlob()
    if (!blob) return
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = 'houseproshub-qr.png'
    link.click()
    URL.revokeObjectURL(objectUrl)
  }

  return (
    <div className="p-6 border-2 border-black rounded-lg bg-white flex flex-col sm:flex-row items-center gap-6">
      <div className="rounded-lg border-2 border-black bg-white p-3 shrink-0">
        <HphQrCode ref={qrRef} value={HPH_SITE_QR_URL} displaySize={200} />
      </div>
      <div className="text-center sm:text-left min-w-0">
        <h2 className="text-xl font-semibold mb-2">HPH QRcode</h2>
        <p className="text-gray-600 mb-3">
          QR code for the House Pros Hub home page. Download the PNG to print or share.
        </p>
        <p className="text-sm text-black mb-4 break-all">houseproshub.com/</p>
        <Button
          type="button"
          size="sm"
          onClick={handleDownload}
          className="inline-flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download PNG
        </Button>
      </div>
    </div>
  )
}
