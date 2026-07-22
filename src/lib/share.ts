import type { Recommendation, ScorePriority, ScoredBlock, SeatMap } from './types'

export interface BuildShareMessageOptions {
  rec: Recommendation
  selected: number
  partySize: number
  priorities?: readonly ScorePriority[]
  baseUrl?: string
  t: (key: string, options?: Record<string, unknown>) => string
}

export interface ShareImageOptions {
  map: SeatMap
  active: ScoredBlock
  priorities?: readonly ScorePriority[]
  t: (key: string, options?: Record<string, unknown>) => string
}

export type ShareResult =
  | 'shared'
  | 'insecure-context'
  | 'unavailable'
  | 'file-unsupported'
  | 'capability-check-failed'
  | 'cancelled'
  | 'failed'

export function shareStatusKey(result: ShareResult): string | null {
  if (result === 'insecure-context') return 'results.share.insecureContext'
  if (result === 'unavailable') return 'results.share.unavailable'
  if (result === 'file-unsupported') return 'results.share.fileUnsupported'
  if (result === 'capability-check-failed') return 'results.share.capabilityCheckFailed'
  return result === 'failed' ? 'results.share.failed' : null
}

export function createShareImageFile(image: Blob): File {
  return new File([image], 'magic-screen-recommendation.png', { type: 'image/png' })
}

export async function shareImage(file: File, text: string, title: string): Promise<ShareResult> {
  if (typeof window !== 'undefined' && window.isSecureContext === false) return 'insecure-context'
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') return 'unavailable'

  if (typeof navigator.canShare === 'function') {
    try {
      if (!navigator.canShare({ files: [file] })) return 'file-unsupported'
    } catch {
      return 'capability-check-failed'
    }
  }

  try {
    await navigator.share({ files: [file], text, title })
    return 'shared'
  } catch (error) {
    return error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'failed'
  }
}

export function seatRange(block: ScoredBlock): string {
  const seats = block.seats
  if (!seats || seats.length === 0) return ''
  if (seats.length === 1) return seats[0].id
  return `${seats[0].id} – ${seats[seats.length - 1].id}`
}

export function buildShareMessage({ rec, selected, partySize, priorities = [], baseUrl, t }: BuildShareMessageOptions): string {
  const options = [rec.best, ...rec.alternatives]
  const normalizedSelected = selected >= 0 && selected < options.length ? selected : 0
  const active = options[normalizedSelected]
  const isTopPickSelected = normalizedSelected === 0
  const lines = ['🎬 Magic Screen', '', t('results.share.partySize', { count: partySize })]

  if (priorities.length) lines.push(t('results.share.priority', { priority: priorities.map((priority) => t(`preferences.${priority}`)).join(', ') }))
  if (isTopPickSelected) lines.push(t('results.share.topPick', { row: active.rowLabel, seats: seatRange(active), score: active.score }))
  else {
    lines.push(t('results.share.selectedChoice', { row: active.rowLabel, seats: seatRange(active), score: active.score }))
    lines.push(t('results.share.topPick', { row: rec.best.rowLabel, seats: seatRange(rec.best), score: rec.best.score }))
  }

  const alternatives = options
    .map((block, index) => ({ block, index }))
    .filter(({ index }) => index > 0 && (isTopPickSelected || index !== normalizedSelected))
    .slice(0, 2)
  if (alternatives.length) {
    lines.push('', t('results.share.alternativesHeader'))
    alternatives.forEach(({ block, index }) => lines.push(t('results.share.altRow', { number: index, row: block.rowLabel, seats: seatRange(block), score: block.score })))
  }

  lines.push('', t('results.share.appLink'), baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://magicscreen.app'))
  return lines.join('\n')
}

/** Render the recommendation directly so the shared image works without DOM screenshot libraries. */
export async function buildShareImage({ map, active, priorities = [], t }: ShareImageOptions): Promise<Blob> {
  const columns = map.rows.flatMap((row) => row.seats.map((seat) => seat.col))
  const minCol = Math.min(...columns)
  const maxCol = Math.max(...columns)
  const unit = Math.max(18, Math.min(30, Math.floor(720 / Math.max(maxCol - minCol + 1, 1))))
  const width = Math.max(360, (maxCol - minCol + 3) * unit)
  const header = priorities.length ? 92 : 70
  const height = header + (map.rows.length + 2) * unit
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable')

  ctx.fillStyle = '#14141c'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 20px system-ui, sans-serif'
  ctx.fillText('Magic Screen', unit, 28)
  ctx.font = '600 14px system-ui, sans-serif'
  ctx.fillText(t('results.share.imageScore', { score: active.score, row: active.rowLabel, seats: seatRange(active) }), unit, 50)
  if (priorities.length) ctx.fillText(t('results.share.priority', { priority: priorities.map((priority) => t(`preferences.${priority}`)).join(', ') }), unit, 72)

  const screenY = header
  ctx.fillStyle = '#30303a'
  ctx.fillRect(unit, screenY, width - unit * 2, 8)
  ctx.fillStyle = '#b7b7c2'
  ctx.font = '700 10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(t('results.screen'), width / 2, screenY - 6)
  ctx.textAlign = 'left'

  const highlighted = new Set(active.seats.map((seat) => `${active.rowLabel}:${seat.col}`))
  const visualRows = map.screenPosition === 'top' ? map.rows : [...map.rows].reverse()
  visualRows.forEach((row, index) => {
    const y = screenY + unit + index * unit
    ctx.fillStyle = '#b7b7c2'
    ctx.font = '600 11px system-ui, sans-serif'
    ctx.fillText(row.label, 6, y + unit * 0.65)
    row.seats.forEach((seat) => {
      const isPick = highlighted.has(`${row.label}:${seat.col}`)
      ctx.fillStyle = isPick ? '#f6c343' : seat.status === 'available' ? '#55b98a' : '#626270'
      ctx.fillRect(unit + (seat.col - minCol) * unit, y, unit - 4, unit - 4)
    })
  })

  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create share image'))), 'image/png'))
}

