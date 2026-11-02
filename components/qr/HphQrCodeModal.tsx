'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { Download } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { HPH_QR_LOGO_SRC } from '@/lib/qr/draw-hph-qr'
import { HphQrCode, type HphQrCodeHandle } from '@/components/qr/HphQrCode'

interface HphQrCodeModalProps {
  isOpen: boolean
  onClose: () => void
  url: string
  /** Name shown under the code, such as the business name. */
  label?: string
  /** Business logo drawn in the center of the code. */
  logoSrc?: string | null
  fileName?: string
}

export function HphQrCodeModal({
  isOpen,
  onClose,
  url,
  label,
  logoSrc,
  fileName = 'hph-qr.png',
}: HphQrCodeModalProps) {
  const qrRef = useRef<HphQrCodeHandle>(null)
  const shortUrl = url.replace(/^https?:\/\/(www\.)?/, '')

  const handleDownload = async () => {
    const blob = await qrRef.current?.toPngBlob()
    if (!blob) return
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = fileName
    link.click()
    URL.revokeObjectURL(objectUrl)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="sm"
      showHeader
      contentClassName="px-4 pb-6"
      title={
        <span className="flex items-center gap-2 min-w-0">
          <Image
            src={HPH_QR_LOGO_SRC}
            alt=""
            width={32}
            height={32}
            className="w-8 h-8 shrink-0"
          />
          <span className="truncate">HPH QRcode</span>
        </span>
      }
    >
      <div className="flex flex-col items-center gap-4 pt-2">
        <div className="rounded-lg border-2 border-black bg-white p-3">
          <HphQrCode ref={qrRef} value={url} logoSrc={logoSrc} displaySize={240} />
        </div>
        {label ? (
          <p className="text-sm font-medium text-black text-center">{label}</p>
        ) : null}
        <p className="text-sm text-black text-center break-all">{shortUrl}</p>
        <Button
          type="button"
          onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download PNG
        </Button>
      </div>
    </Modal>
  )
}
