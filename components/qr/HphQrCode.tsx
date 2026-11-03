'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { drawHphQr, loadHphQrLogo, loadQrImage } from '@/lib/qr/draw-hph-qr'

/** Same-origin copy of the logo so the canvas can draw it and still download. */
function loadBusinessLogo(src: string): Promise<HTMLImageElement | null> {
  const optimized =
    src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://')
      ? `/_next/image?url=${encodeURIComponent(src)}&w=640&q=90`
      : null
  // Local files are already sharp. Remote files go through the image proxy first so the canvas stays downloadable.
  const attempts = optimized ? (src.startsWith('/') ? [src, optimized] : [optimized, src]) : [src]
  return attempts.reduce<Promise<HTMLImageElement | null>>(
    (pending, url) => pending.catch(() => loadQrImage(url)),
    Promise.reject(new Error('start'))
  ).catch(() => null)
}

export interface HphQrCodeHandle {
  toPngBlob: () => Promise<Blob | null>
}

interface HphQrCodeProps {
  value: string
  /** Business logo drawn in the center. The HPH mark stays in the corners. */
  logoSrc?: string | null
  /** CSS size. The canvas itself is drawn at module resolution. */
  displaySize?: number
  className?: string
}

export const HphQrCode = forwardRef<HphQrCodeHandle, HphQrCodeProps>(function HphQrCode(
  { value, logoSrc, displaySize = 240, className },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useImperativeHandle(ref, () => ({
    toPngBlob: () =>
      new Promise((resolve) => {
        const canvas = canvasRef.current
        if (!canvas || canvas.width === 0) {
          resolve(null)
          return
        }
        canvas.toBlob((blob) => resolve(blob), 'image/png')
      }),
  }))

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !value) return
    let cancelled = false

    Promise.all([
      loadHphQrLogo().catch(() => null),
      logoSrc ? loadBusinessLogo(logoSrc) : Promise.resolve(null),
    ]).then(([mark, businessLogo]) => {
      if (!cancelled) drawHphQr(canvas, value, mark, businessLogo)
    })

    return () => {
      cancelled = true
    }
  }, [value, logoSrc])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="HPH QRcode"
      className={className}
      style={{ width: displaySize, height: displaySize }}
    />
  )
})
