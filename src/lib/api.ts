import { detectSeatRegion } from './detectSeatRegion'
import type { SeatMap } from './types'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string

const MAX_EDGE = 2400

/**
 * Decode any picked image (including HEIC on iOS, which Safari decodes
 * natively) via canvas, crop to just the seat grid when we can find it,
 * downscale, and re-encode as JPEG. Cropping locally removes the surrounding
 * app chrome (status bar, title, legend, buttons) so the vision API processes
 * far fewer image tokens — cheaper and faster — with no loss of seat detail.
 */
export async function fileToJpegBase64(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not read that image.'))
      el.src = url
    })

    const nw = img.naturalWidth
    const nh = img.naturalHeight

    // Source rectangle: the detected seat region, or the full image if
    // detection isn't confident or barely shrinks anything.
    let sx = 0
    let sy = 0
    let sw = nw
    let sh = nh
    const region = detectSeatRegion(img)
    if (region && region.confidence >= 0.5) {
      const r = region.rect
      if ((r.width * r.height) / (nw * nh) < 0.85) {
        sx = r.x
        sy = r.y
        sw = r.width
        sh = r.height
      }
    }

    const scale = Math.min(1, MAX_EDGE / Math.max(sw, sh))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(sw * scale)
    canvas.height = Math.round(sh * scale)
    canvas
      .getContext('2d')!
      .drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.92).split(',')[1]
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function parseSeatMap(base64Jpeg: string): Promise<SeatMap> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/parse-seat-map`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ image: base64Jpeg, mediaType: 'image/jpeg' }),
  })
  if (!res.ok) {
    let message = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (body.error) message = body.error
    } catch {
      /* keep the generic message */
    }
    throw new Error(message)
  }
  const map = (await res.json()) as SeatMap
  if (!map.rows || map.rows.length === 0) {
    throw new Error("Couldn't find a seat map in that image.")
  }
  return map
}
