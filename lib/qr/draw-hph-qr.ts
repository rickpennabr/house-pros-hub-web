import { create as createQrCode } from 'qrcode'

/** Square HPH mark drawn in the center when a code has no business logo. */
export const HPH_QR_LOGO_SRC = '/hph-logo-simble-sq-white-bg-2.2.png'

/** Same mark, drawn large in the middle of the House Pros Hub home QR. */
export const HPH_QR_CENTER_LOGO_SRC = HPH_QR_LOGO_SRC

/** Public site encoded by the admin QR. */
export const HPH_SITE_QR_URL = 'https://houseproshub.com/'

const QUIET = 4
/** Print resolution. The on-screen size is set separately with CSS. */
const MODULE_PX = 18

const trimCache = new WeakMap<HTMLImageElement, CanvasImageSource>()

/** Crop empty margin so the artwork fills its frame. Keeps the original colors. */
function trimLogo(logo: HTMLImageElement): CanvasImageSource {
  const cached = trimCache.get(logo)
  if (cached) return cached

  const finish = (source: CanvasImageSource) => {
    trimCache.set(logo, source)
    return source
  }

  if (logo.naturalWidth < 1 || logo.naturalHeight < 1) return finish(logo)

  try {
    const src = document.createElement('canvas')
    src.width = logo.naturalWidth
    src.height = logo.naturalHeight
    const srcCtx = src.getContext('2d')
    if (!srcCtx) return finish(logo)
    srcCtx.drawImage(logo, 0, 0)
    const image = srcCtx.getImageData(0, 0, src.width, src.height)
    const { data, width, height } = image
    let minX = width
    let minY = height
    let maxX = 0
    let maxY = 0

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        const r = data[i]
        const g = data[i + 1]
        const b = data[i + 2]
        const a = data[i + 3]
        if (a < 16 || (r > 248 && g > 248 && b > 248)) continue
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }

    if (maxX < minX || maxY < minY) return finish(logo)

    const cropW = maxX - minX + 1
    const cropH = maxY - minY + 1
    if (cropW >= width - 2 && cropH >= height - 2) return finish(logo)

    const crop = document.createElement('canvas')
    crop.width = cropW
    crop.height = cropH
    const cropCtx = crop.getContext('2d')
    if (!cropCtx) return finish(logo)
    cropCtx.drawImage(src, minX, minY, cropW, cropH, 0, 0, cropW, cropH)
    return finish(crop)
  } catch {
    return finish(logo)
  }
}

function sourceSize(source: CanvasImageSource): { width: number; height: number } {
  if (source instanceof HTMLCanvasElement) {
    return { width: source.width, height: source.height }
  }
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight }
  }
  return { width: 1, height: 1 }
}

/**
 * Draw a scannable QR. The three corner eyes stay solid black.
 * A phone locks on by seeing black-white-black-white-black there (1:1:3:1:1).
 * A logo in that square breaks the ratio, so the camera never starts a scan.
 * The logo sits in the center instead, inside the error-correction budget.
 */
export function drawHphQr(
  canvas: HTMLCanvasElement,
  value: string,
  centerLogo: HTMLImageElement | null
): void {
  const qr = createQrCode(value, { errorCorrectionLevel: 'H' })
  const count = qr.modules.size
  const size = (count + QUIET * 2) * MODULE_PX
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = '#111111'

  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!qr.modules.get(row, col)) continue
      ctx.fillRect((col + QUIET) * MODULE_PX, (row + QUIET) * MODULE_PX, MODULE_PX, MODULE_PX)
    }
  }

  if (centerLogo && centerLogo.naturalWidth > 0) {
    drawCenterLogo(ctx, size, centerLogo)
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

/** White pad in the middle so the logo does not cover data modules, then the logo. */
function drawCenterLogo(
  ctx: CanvasRenderingContext2D,
  canvasSize: number,
  logo: HTMLImageElement
): void {
  const art = trimLogo(logo)
  const { width: sw, height: sh } = sourceSize(art)
  if (sw < 1 || sh < 1) return

  const logoPx = Math.round(canvasSize * 0.22)
  const pad = Math.max(10, Math.round(MODULE_PX * 0.9))
  const box = logoPx + pad * 2
  const x = Math.round((canvasSize - box) / 2)
  const y = Math.round((canvasSize - box) / 2)
  const radius = Math.round(box * 0.22)

  ctx.save()
  roundRect(ctx, x, y, box, box, radius)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.lineWidth = Math.max(4, Math.round(MODULE_PX * 0.4))
  ctx.strokeStyle = '#111111'
  ctx.stroke()

  const ix = x + pad
  const iy = y + pad
  const innerRadius = Math.max(8, Math.round(logoPx * 0.06))
  roundRect(ctx, ix, iy, logoPx, logoPx, innerRadius)
  ctx.clip()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(ix, iy, logoPx, logoPx)

  const fit = logoPx * 0.92
  const scale = Math.min(fit / sw, fit / sh)
  const dw = sw * scale
  const dh = sh * scale
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(art, ix + (logoPx - dw) / 2, iy + (logoPx - dh) / 2, dw, dh)
  ctx.restore()
  ctx.imageSmoothingEnabled = false
}

let logoPromise: Promise<HTMLImageElement> | null = null

export function loadHphQrLogo(): Promise<HTMLImageElement> {
  if (!logoPromise) {
    logoPromise = new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error('HPH logo failed to load'))
      img.src = HPH_QR_LOGO_SRC
    })
  }
  return logoPromise
}

const imageCache = new Map<string, Promise<HTMLImageElement>>()

export function loadQrImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src)
  if (cached) return cached
  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => {
      imageCache.delete(src)
      reject(new Error('QR image failed to load'))
    }
    img.src = src
  })
  imageCache.set(src, promise)
  return promise
}
