/**
 * Local, dependency-free detection of *where* the seat grid sits inside a
 * screenshot or photo — not what the seats are. Finding the region is the
 * tractable slice of computer vision (reading the printed codes is not), and
 * cropping to it before the vision API call cuts image tokens and noise.
 *
 * Pure geometry over pixels: threshold foreground vs. background, label
 * connected blobs, keep the ones that look like the repeated seat glyph, and
 * take the percentile bounding box of that cluster. Returns null (→ caller
 * sends the full image) whenever confidence is low, so a bad crop never hurts.
 */

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface RegionResult {
  /** Crop rectangle in the ORIGINAL image's pixel coordinates. */
  rect: CropRect
  confidence: number
  blobCount: number
}

interface Blob {
  minX: number
  maxX: number
  minY: number
  maxY: number
  area: number
  cx: number
  cy: number
}

interface Gray {
  data: Uint8ClampedArray | Uint8Array
  width: number
  height: number
}

const FG_THRESHOLD = 48 // RGB Euclidean distance from background to count as foreground

function estimateBackground(data: Gray['data'], W: number, H: number) {
  // Average a ring of border pixels — seat maps sit on a solid dark canvas.
  let r = 0
  let g = 0
  let b = 0
  let n = 0
  const sample = (x: number, y: number) => {
    const p = (y * W + x) * 4
    r += data[p]
    g += data[p + 1]
    b += data[p + 2]
    n++
  }
  for (let x = 0; x < W; x += 2) {
    sample(x, 0)
    sample(x, H - 1)
  }
  for (let y = 0; y < H; y += 2) {
    sample(0, y)
    sample(W - 1, y)
  }
  return { r: r / n, g: g / n, b: b / n }
}

function labelBlobs(fg: Uint8Array, W: number, H: number): Blob[] {
  const visited = new Uint8Array(W * H)
  const blobs: Blob[] = []
  const stack: number[] = []

  for (let start = 0; start < W * H; start++) {
    if (!fg[start] || visited[start]) continue
    stack.length = 0
    stack.push(start)
    visited[start] = 1

    let minX = W
    let maxX = 0
    let minY = H
    let maxY = 0
    let area = 0
    let sumX = 0
    let sumY = 0

    while (stack.length) {
      const idx = stack.pop() as number
      const x = idx % W
      const y = (idx - x) / W
      area++
      sumX += x
      sumY += y
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

      // 8-connectivity
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= H) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          if (nx < 0 || nx >= W) continue
          const nIdx = ny * W + nx
          if (fg[nIdx] && !visited[nIdx]) {
            visited[nIdx] = 1
            stack.push(nIdx)
          }
        }
      }
    }

    blobs.push({
      minX,
      maxX,
      minY,
      maxY,
      area,
      cx: sumX / area,
      cy: sumY / area,
    })
  }
  return blobs
}

function percentile(sorted: number[], p: number): number {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))
  return sorted[i]
}

/** Core detection over grayscale/RGBA pixel data. Coordinates are in `img` space. */
export function detectSeatRegionFromImageData(img: Gray): RegionResult | null {
  const { data, width: W, height: H } = img
  if (W < 40 || H < 40) return null

  const bg = estimateBackground(data, W, H)
  const fg = new Uint8Array(W * H)
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    const dr = data[p] - bg.r
    const dg = data[p + 1] - bg.g
    const db = data[p + 2] - bg.b
    if (dr * dr + dg * dg + db * db > FG_THRESHOLD * FG_THRESHOLD) fg[i] = 1
  }

  const blobs = labelBlobs(fg, W, H)

  // Solid, roughly-square blobs are seat candidates. Fill ratio (area over
  // bounding-box area) is the key discriminator: seats are filled discs/squares
  // (~0.6-0.8), while text glyphs and thin icons are sparse strokes (< 0.5).
  const candidates = blobs.filter((b) => {
    const w = b.maxX - b.minX + 1
    const h = b.maxY - b.minY + 1
    if (w < 4 || h < 4) return false
    const aspect = w / h
    if (aspect < 0.5 || aspect > 2) return false
    return b.area / (w * h) > 0.55
  })
  if (candidates.length < 20) return null

  // The seat glyph is the dominant repeated size. Take the median candidate
  // area and keep a tight band around it.
  const areas = candidates.map((b) => b.area).sort((a, b) => a - b)
  const median = areas[Math.floor(areas.length / 2)]
  const seatLike = candidates.filter((b) => b.area >= median * 0.5 && b.area <= median * 2)
  if (seatLike.length < 20) return null

  // Density histogram over Y: a real seat row spikes (~20 aligned blobs at one
  // y); UI chrome (legend circles, format tags, stepper icons) stays a few per
  // row and falls below the threshold. The seat grid is the band of dense bins.
  const seatH = Math.sqrt(median)
  const binH = Math.max(2, Math.round(seatH))
  const nbins = Math.ceil(H / binH)
  const binCount = new Int32Array(nbins)
  for (const b of seatLike) {
    binCount[Math.min(nbins - 1, Math.floor(b.cy / binH))]++
  }
  let maxBin = 0
  for (const c of binCount) if (c > maxBin) maxBin = c
  const rowThreshold = Math.max(8, Math.floor(0.4 * maxBin))

  let firstDense = -1
  let lastDense = -1
  let denseBins = 0
  for (let i = 0; i < nbins; i++) {
    if (binCount[i] >= rowThreshold) {
      if (firstDense < 0) firstDense = i
      lastDense = i
      denseBins++
    }
  }
  if (firstDense < 0 || denseBins < 4) return null

  const yTop = firstDense * binH
  const yBot = (lastDense + 1) * binH
  const inBand = seatLike.filter((b) => b.cy >= yTop && b.cy <= yBot)
  const xs = inBand.map((b) => b.cx).sort((a, b) => a - b)

  // Horizontal margin keeps the row-label letters; a larger vertical margin
  // reaches the "TELA"/"SCREEN" bar just past the grid, so the model can read
  // the screen orientation even though the crop drops the surrounding chrome.
  const marginX = seatH * 2.5
  const marginY = seatH * 4.5
  const x0 = Math.max(0, percentile(xs, 0.02) - marginX)
  const y0 = Math.max(0, yTop - marginY)
  const x1 = Math.min(W - 1, percentile(xs, 0.98) + marginX)
  const y1 = Math.min(H - 1, yBot + marginY)

  const rect: CropRect = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
  // Reject degenerate detections.
  if (rect.width < W * 0.2 || rect.height < H * 0.05) return null

  return {
    rect,
    confidence: Math.min(1, denseBins / 8),
    blobCount: inBand.length,
  }
}

/**
 * Detect the seat region of a loaded image. Downscales to `detectWidth` for
 * speed, then scales the resulting rectangle back to the image's natural size.
 */
export function detectSeatRegion(
  image: HTMLImageElement,
  detectWidth = 760,
): RegionResult | null {
  const nw = image.naturalWidth || image.width
  const nh = image.naturalHeight || image.height
  if (!nw || !nh) return null

  const scale = Math.min(1, detectWidth / nw)
  const dw = Math.max(1, Math.round(nw * scale))
  const dh = Math.max(1, Math.round(nh * scale))

  const canvas = document.createElement('canvas')
  canvas.width = dw
  canvas.height = dh
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(image, 0, 0, dw, dh)
  const imageData = ctx.getImageData(0, 0, dw, dh)

  const result = detectSeatRegionFromImageData(imageData)
  if (!result) return null

  // Scale rect back to original pixels.
  const inv = nw / dw
  return {
    ...result,
    rect: {
      x: Math.round(result.rect.x * inv),
      y: Math.round(result.rect.y * inv),
      width: Math.round(result.rect.width * inv),
      height: Math.round(result.rect.height * inv),
    },
  }
}
