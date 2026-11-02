import { create as createQrCode } from 'qrcode'

/** Square HPH mark used in the three finder eyes. */
export const HPH_QR_LOGO_SRC = '/hph-logo-simble-sq-white-bg-2.2.png'

/** Public site encoded by the admin QR. */
export const HPH_SITE_QR_URL = 'https://houseproshub.com/'

const FINDER = 7
const QUIET = 4
/**
 * Modules of padding inside each finder before the mark.
 * 2 keeps the black ring and white separator. ~2.18 still scans and leaves the
 * mark large enough to read. A full-size logo over the finder does not scan.
 */
const LOGO_INSET_MODULES = 2.18
const MODULE_PX = 12

const cropCache = new WeakMap<HTMLImageElement, HTMLCanvasElement>()

function cropAndRecolor(logo: HTMLImageElement): HTMLCanvasElement {
  const cached = cropCache.get(logo)
  if (cached) return cached

  const src = document.createElement('canvas')
  src.width = logo.naturalWidth
  src.height = logo.naturalHeight
  const srcCtx = src.getContext('2d')
  if (!srcCtx) return src
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
      if (a < 20 || (r > 245 && g > 245 && b > 245)) {
        data[i + 3] = 0
        continue
      }
      const red = r > g + 40 && r > b + 40 && r > 80
      if (!red) {
        data[i] = 255
        data[i + 1] = 255
        data[i + 2] = 255
      }
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }

  srcCtx.putImageData(image, 0, 0)
  const crop = document.createElement('canvas')
  const cropW = Math.max(1, maxX - minX + 1)
  const cropH = Math.max(1, maxY - minY + 1)
  crop.width = cropW
  crop.height = cropH
  const cropCtx = crop.getContext('2d')
  if (!cropCtx) return src
  cropCtx.drawImage(src, minX, minY, cropW, cropH, 0, 0, cropW, cropH)
  cropCache.set(logo, crop)
  return crop
}

/** Draw a scannable QR with the HPH mark in the three corner eyes and the business logo in the center. */
export function drawHphQr(
  canvas: HTMLCanvasElement,
  value: string,
  logo: HTMLImageElement | null,
  businessLogo: HTMLImageElement | null = null
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

  if (logo && logo.naturalWidth >= 1) {
    const mark = cropAndRecolor(logo)
    const inset = Math.round(LOGO_INSET_MODULES * MODULE_PX)
    const box = FINDER * MODULE_PX
    const markSize = box - inset * 2
    const origins: Array<[number, number]> = [
      [0, 0],
      [count - FINDER, 0],
      [0, count - FINDER],
    ]
    // A thin finder cross stays readable through the mark so phones can locate the code.
    const mid = Math.floor(box / 2)
    const half = 1

    for (const [col, row] of origins) {
      const originX = (col + QUIET) * MODULE_PX
      const originY = (row + QUIET) * MODULE_PX
      ctx.drawImage(mark, originX + inset, originY + inset, markSize, markSize)
      for (let t = 0; t < box; t++) {
        for (let band = -half; band <= half; band++) {
          paintFinderPixel(ctx, originX, originY, t, mid + band)
          paintFinderPixel(ctx, originX, originY, mid + band, t)
        }
      }
    }
  }

  if (businessLogo && businessLogo.naturalWidth > 0) {
    drawCenterLogo(ctx, size, businessLogo)
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

/** White pad in the middle so the logo does not cover data modules, then the business logo. */
function drawCenterLogo(
  ctx: CanvasRenderingContext2D,
  canvasSize: number,
  logo: HTMLImageElement
): void {
  const logoPx = Math.round(canvasSize * 0.18)
  const pad = Math.max(8, Math.round(MODULE_PX * 0.85))
  const box = logoPx + pad * 2
  const x = Math.round((canvasSize - box) / 2)
  const y = Math.round((canvasSize - box) / 2)
  const radius = Math.round(box * 0.16)

  ctx.save()
  roundRect(ctx, x, y, box, box, radius)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.lineWidth = Math.max(3, Math.round(MODULE_PX * 0.35))
  ctx.strokeStyle = '#111111'
  ctx.stroke()

  const ix = x + pad
  const iy = y + pad
  const innerRadius = Math.max(4, radius - Math.round(pad * 0.35))
  roundRect(ctx, ix, iy, logoPx, logoPx, innerRadius)
  ctx.clip()
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(ix, iy, logoPx, logoPx)

  const sw = logo.naturalWidth
  const sh = logo.naturalHeight
  const scale = Math.max(logoPx / sw, logoPx / sh)
  const dw = sw * scale
  const dh = sh * scale
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(logo, ix + (logoPx - dw) / 2, iy + (logoPx - dh) / 2, dw, dh)
  ctx.restore()
}

function paintFinderPixel(
  ctx: CanvasRenderingContext2D,
  originX: number,
  originY: number,
  localX: number,
  localY: number
): void {
  const box = FINDER * MODULE_PX
  if (localX < 0 || localY < 0 || localX >= box || localY >= box) return
  const modCol = Math.floor(localX / MODULE_PX)
  const modRow = Math.floor(localY / MODULE_PX)
  const black =
    modCol === 0 ||
    modCol === 6 ||
    modRow === 0 ||
    modRow === 6 ||
    (modCol >= 2 && modCol <= 4 && modRow >= 2 && modRow <= 4)
  ctx.fillStyle = black ? '#111111' : '#ffffff'
  ctx.fillRect(originX + localX, originY + localY, 1, 1)
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
