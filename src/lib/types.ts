export type ScorePriority = 'distance' | 'sound' | 'angle'

export type SeatStatus =
  | 'available'
  | 'occupied'
  | 'blocked'
  | 'wheelchair'
  | 'companion'
  | 'reduced-mobility'
  | 'aisle'

export interface Seat {
  id: string
  col: number
  status: SeatStatus
}

export interface SeatRow {
  label: string
  seats: Seat[]
}

export interface SeatMap {
  screenPosition: 'top' | 'bottom'
  /** Rows ordered from closest-to-screen to farthest. */
  rows: SeatRow[]
}

export interface ScoreBreakdown {
  distance: number
  centering: number
  sound: number
}

export interface ScoredBlock {
  rowLabel: string
  seats: Seat[]
  /** Overall 0–100. */
  score: number
  /** Sub-scores, each 0–100. */
  breakdown: ScoreBreakdown
  /** True when the block is split across an aisle (fallback when no contiguous run fits). */
  split: boolean
}

export interface Recommendation {
  best: ScoredBlock
  alternatives: ScoredBlock[]
}
