import type {
  Recommendation,
  ScoreBreakdown,
  ScoredBlock,
  Seat,
  SeatMap,
} from './types'

// Weights for the three science-based criteria.
const W_DISTANCE = 0.4
const W_CENTERING = 0.35
const W_SOUND = 0.25

// Optimal normalized depth (0 = screen row, 1 = back row). ~2/3 back matches
// THX's ~36° horizontal viewing-angle recommendation and the Dolby mix position.
const OPTIMAL_DEPTH = 0.62
const SOUND_DEPTH = 0.68

// Sitting too close (steep gaze angle, neck strain) hurts more than sitting
// slightly too far back, so the falloff is asymmetric.
const SIGMA_FRONT = 0.2
const SIGMA_BACK = 0.34

const SOUND_SIGMA_X = 0.5
const SOUND_SIGMA_D = 0.3

interface RoomGeometry {
  minCol: number
  maxCol: number
  centerCol: number
  halfWidth: number
  rowCount: number
}

function roomGeometry(map: SeatMap): RoomGeometry {
  let minCol = Infinity
  let maxCol = -Infinity
  for (const row of map.rows) {
    for (const seat of row.seats) {
      if (seat.col < minCol) minCol = seat.col
      if (seat.col > maxCol) maxCol = seat.col
    }
  }
  const centerCol = (minCol + maxCol) / 2
  return {
    minCol,
    maxCol,
    centerCol,
    halfWidth: Math.max((maxCol - minCol) / 2, 1),
    rowCount: map.rows.length,
  }
}

/** Normalized depth of a row: 0 at the screen, 1 at the back wall. */
function rowDepth(rowIndex: number, rowCount: number): number {
  return rowCount > 1 ? rowIndex / (rowCount - 1) : 0.5
}

function distanceScore(depth: number): number {
  const sigma = depth < OPTIMAL_DEPTH ? SIGMA_FRONT : SIGMA_BACK
  const delta = depth - OPTIMAL_DEPTH
  return Math.exp(-(delta * delta) / (2 * sigma * sigma))
}

function centeringScore(lateral: number): number {
  return Math.max(0, 1 - Math.abs(lateral))
}

function soundScore(lateral: number, depth: number): number {
  const dd = depth - SOUND_DEPTH
  return Math.exp(
    -((lateral * lateral) / (2 * SOUND_SIGMA_X * SOUND_SIGMA_X) +
      (dd * dd) / (2 * SOUND_SIGMA_D * SOUND_SIGMA_D)),
  )
}

function scoreSeats(
  seats: Seat[],
  rowIndex: number,
  geo: RoomGeometry,
  split: boolean,
  rowLabel: string,
): ScoredBlock {
  const depth = rowDepth(rowIndex, geo.rowCount)
  const meanCol = seats.reduce((sum, s) => sum + s.col, 0) / seats.length
  const lateral = (meanCol - geo.centerCol) / geo.halfWidth

  const breakdown: ScoreBreakdown = {
    distance: Math.round(distanceScore(depth) * 100),
    centering: Math.round(centeringScore(lateral) * 100),
    sound: Math.round(soundScore(lateral, depth) * 100),
  }
  let score =
    W_DISTANCE * breakdown.distance +
    W_CENTERING * breakdown.centering +
    W_SOUND * breakdown.sound
  if (split) score *= 0.9

  return {
    rowLabel,
    seats,
    score: Math.round(score),
    breakdown,
    split,
  }
}

/** Runs of seats that are available AND physically adjacent (consecutive cols). */
function contiguousRuns(seats: Seat[]): Seat[][] {
  const sorted = [...seats].sort((a, b) => a.col - b.col)
  const runs: Seat[][] = []
  let run: Seat[] = []
  for (const seat of sorted) {
    const prev = run[run.length - 1]
    if (seat.status === 'available' && (!prev || seat.col === prev.col + 1)) {
      run.push(seat)
    } else {
      if (run.length > 0) runs.push(run)
      run = seat.status === 'available' ? [seat] : []
    }
  }
  if (run.length > 0) runs.push(run)
  return runs
}

function dedupeTop(blocks: ScoredBlock[], count: number): ScoredBlock[] {
  const sorted = [...blocks].sort((a, b) => b.score - a.score)
  const picked: ScoredBlock[] = []
  const used = new Set<string>()
  for (const block of sorted) {
    if (picked.length >= count) break
    if (block.seats.some((s) => used.has(`${block.rowLabel}:${s.col}`))) continue
    picked.push(block)
    for (const s of block.seats) used.add(`${block.rowLabel}:${s.col}`)
  }
  return picked
}

/**
 * Recommend the best block of `partySize` seats in a single row.
 * Prefers contiguous runs; falls back to a same-row block spanning an aisle
 * (marked `split`) when no row has enough adjacent free seats.
 * Returns null only when no single row has `partySize` available seats at all.
 */
export function recommend(map: SeatMap, partySize: number): Recommendation | null {
  if (partySize < 1 || map.rows.length === 0) return null
  const geo = roomGeometry(map)

  const contiguous: ScoredBlock[] = []
  map.rows.forEach((row, rowIndex) => {
    for (const run of contiguousRuns(row.seats)) {
      for (let start = 0; start + partySize <= run.length; start++) {
        contiguous.push(
          scoreSeats(run.slice(start, start + partySize), rowIndex, geo, false, row.label),
        )
      }
    }
  })

  let candidates = contiguous
  if (candidates.length === 0) {
    // Fallback: any window of N available seats in one row, gaps allowed.
    map.rows.forEach((row, rowIndex) => {
      const avail = row.seats
        .filter((s) => s.status === 'available')
        .sort((a, b) => a.col - b.col)
      for (let start = 0; start + partySize <= avail.length; start++) {
        candidates.push(
          scoreSeats(avail.slice(start, start + partySize), rowIndex, geo, true, row.label),
        )
      }
    })
  }
  if (candidates.length === 0) return null

  const top = dedupeTop(candidates, 5)
  return { best: top[0], alternatives: top.slice(1) }
}
