import { recommend } from './scoring'
import type { Recommendation, ScorePriority, SeatMap, SeatStatus } from './types'

const DEMO_ROW_STATUSES: Record<string, Partial<Record<number, SeatStatus>>> = {
  A: { 2: 'occupied', 9: 'occupied' },
  B: { 4: 'occupied', 7: 'occupied' },
  C: { 5: 'occupied', 6: 'occupied' },
  D: { 5: 'aisle' },
  E: { 1: 'occupied', 10: 'occupied' },
  F: { 3: 'occupied', 8: 'occupied' },
}

export const DEMO_SEAT_MAP: SeatMap = {
  screenPosition: 'top',
  rows: Object.entries(DEMO_ROW_STATUSES).map(([label, statuses]) => ({
    label,
    seats: Array.from({ length: 12 }, (_, col) => ({
      id: `${label}${col + 1}`,
      col,
      status: statuses[col] ?? 'available',
    })),
  })),
}

export function getDemoResultsState(
  partySize: number,
  priorities: ScorePriority[] = [],
): { name: 'results'; map: SeatMap; rec: Recommendation; partySize: number; priorities: ScorePriority[] } | null {
  const rec = recommend(DEMO_SEAT_MAP, partySize, priorities)
  return rec ? { name: 'results', map: DEMO_SEAT_MAP, rec, partySize, priorities } : null
}
