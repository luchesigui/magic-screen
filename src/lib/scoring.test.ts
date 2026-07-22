import { describe, expect, it } from 'vitest'
import { DEFAULT_SCORE_WEIGHTS, getScoreWeights, recommend } from './scoring'
import type { Seat, SeatMap, SeatStatus } from './types'

/**
 * Build a map from string art: one string per row, closest-to-screen first.
 * 'o' available, 'x' occupied, ' ' aisle/gap.
 */
function makeMap(rowsArt: string[]): SeatMap {
  return {
    screenPosition: 'bottom',
    rows: rowsArt.map((art, i) => {
      const label = String.fromCharCode(65 + i)
      const seats: Seat[] = []
      for (let col = 0; col < art.length; col++) {
        const ch = art[col]
        if (ch === ' ') continue
        const status: SeatStatus = ch === 'o' ? 'available' : 'occupied'
        seats.push({ id: `${label}${col + 1}`, col, status })
      }
      return { label, seats }
    }),
  }
}

const openRow = 'ooooooooooooooooooooo' // 21 seats, center col = 10

describe('recommend', () => {
  it('picks a centered block about 2/3 back in a fully open room', () => {
    const map = makeMap(Array(15).fill(openRow))
    const rec = recommend(map, 2)!
    const rowIndex = rec.best.rowLabel.charCodeAt(0) - 65
    const depth = rowIndex / 14
    expect(depth).toBeGreaterThan(0.5)
    expect(depth).toBeLessThan(0.75)
    const meanCol = rec.best.seats.reduce((s, x) => s + x.col, 0) / 2
    expect(Math.abs(meanCol - 10)).toBeLessThanOrEqual(1)
    expect(rec.best.split).toBe(false)
    expect(rec.best.score).toBeGreaterThan(90)
  })

  it('never recommends occupied seats', () => {
    const art = 'ooooxxxxxxxxxooooooo' // center of every row taken
    const map = makeMap(Array(10).fill(art))
    const rec = recommend(map, 3)!
    for (const seat of rec.best.seats) expect(seat.status).toBe('available')
  })

  it('prefers a slightly off-center row over a badly placed one', () => {
    // Ideal-depth rows are fully occupied except far-left; row just behind
    // has centered seats free.
    const rows = Array(10).fill('xxxxxxxxxxxxxxxxxxxxx')
    rows[6] = 'ooxxxxxxxxxxxxxxxxxxx' // ideal depth but far left
    rows[8] = 'xxxxxxxxoooooxxxxxxxx' // a bit far back but centered
    const rec = recommend(makeMap(rows), 2)!
    expect(rec.best.rowLabel).toBe('I') // index 8
  })

  it('respects aisles: seats across a gap are not contiguous', () => {
    // 4 free on the left block, aisle, 4 free in center block; party of 5
    // cannot sit contiguously → split fallback.
    const rows = Array(8).fill('oooo xxxxooooxxxx oooo'.replace(/o/g, 'x'))
    rows[5] = 'oooo xxxxooooxxxx xxxx'
    const rec = recommend(makeMap(rows), 5)!
    expect(rec.best.split).toBe(true)
    expect(rec.best.seats).toHaveLength(5)
    expect(rec.best.rowLabel).toBe('F')
  })

  it('returns alternatives that do not reuse the best seats', () => {
    const map = makeMap(Array(12).fill(openRow))
    const rec = recommend(map, 4)!
    expect(rec.alternatives.length).toBeGreaterThan(0)
    const bestKeys = new Set(rec.best.seats.map((s) => `${rec.best.rowLabel}:${s.col}`))
    for (const alt of rec.alternatives) {
      for (const seat of alt.seats) {
        expect(bestKeys.has(`${alt.rowLabel}:${seat.col}`)).toBe(false)
      }
    }
  })

  it('returns null when no row can seat the party', () => {
    const map = makeMap(['oox', 'xoo', 'oxo'])
    expect(recommend(map, 3)).toBeNull()
  })

  it('handles an off-center room layout', () => {
    // Right block missing entirely; center axis must come from actual extent.
    const map = makeMap(Array(9).fill('oooooooooooo'))
    const rec = recommend(map, 2)!
    const meanCol = rec.best.seats.reduce((s, x) => s + x.col, 0) / 2
    expect(Math.abs(meanCol - 5.5)).toBeLessThanOrEqual(1)
  })

  describe('score priority', () => {
    const competitiveMap = () => {
      const rows = Array(26).fill('xxxxxxxxxxxxxxxxxxxxx')
      rows[9] = 'xxxxxxxxxxooxxxxxxxxx' // centered, but too close to the screen
      rows[16] = 'xxxxooxxxxxxxxxxxxxxx' // ideal distance, deliberately off-center
      rows[20] = 'xxxxxooxxxxxxxxxxxxxx' // best sound balance, slightly farther back
      return makeMap(rows)
    }

    it('preserves the exact default weights and ranking with no priorities', () => {
      const map = competitiveMap()
      const recDefault = recommend(map, 2)!
      const recNoPriorities = recommend(map, 2, [])!

      expect(DEFAULT_SCORE_WEIGHTS).toEqual({ distance: 0.4, angle: 0.35, sound: 0.25 })
      expect(getScoreWeights()).toEqual(DEFAULT_SCORE_WEIGHTS)
      expect(getScoreWeights([])).toEqual(DEFAULT_SCORE_WEIGHTS)
      expect(recNoPriorities).toEqual(recDefault)
    })

    it('gives one chosen pillar the largest weight', () => {
      expect(getScoreWeights(['distance'])).toEqual({ distance: 0.55, angle: 0.225, sound: 0.225 })
      expect(getScoreWeights(['angle'])).toEqual({ distance: 0.225, angle: 0.55, sound: 0.225 })
      expect(getScoreWeights(['sound'])).toEqual({ distance: 0.225, angle: 0.225, sound: 0.55 })
    })

    it('splits the dominant share equally between two chosen pillars', () => {
      expect(getScoreWeights(['distance', 'sound'])).toEqual({ distance: 0.4, angle: 0.2, sound: 0.4 })
      expect(getScoreWeights(['distance', 'angle'])).toEqual({ distance: 0.4, angle: 0.4, sound: 0.2 })
      expect(getScoreWeights(['sound', 'angle'])).toEqual({ distance: 0.2, angle: 0.4, sound: 0.4 })
    })

    it('uses equal thirds when all pillars are chosen', () => {
      const weights = getScoreWeights(['distance', 'sound', 'angle'])
      expect(weights).toEqual({ distance: 1 / 3, angle: 1 / 3, sound: 1 / 3 })
      expect(weights.distance + weights.angle + weights.sound).toBe(1)
    })

    it('changes the competitive recommendation for selected pillars', () => {
      const map = competitiveMap()
      const distance = recommend(map, 2, ['distance'])!.best
      const angle = recommend(map, 2, ['angle'])!.best
      const sound = recommend(map, 2, ['sound'])!.best

      expect(distance.rowLabel).toBe('Q')
      expect(angle.rowLabel).toBe('J')
      expect(sound.rowLabel).toBe('U')
      expect(distance.breakdown.distance).toBeGreaterThan(angle.breakdown.distance)
      expect(angle.breakdown.centering).toBeGreaterThan(distance.breakdown.centering)
      expect(sound.breakdown.sound).toBeGreaterThan(distance.breakdown.sound)
    })
  })

  describe('corridor corrections', () => {
    it('prevents corrected former-seat positions from being recommended when marked as aisle', () => {
      const initialMap = makeMap(Array(15).fill(openRow))
      const initialRec = recommend(initialMap, 2)!
      const targetSeat = initialRec.best.seats[0]

      // Correct the target seat to an aisle
      const correctedMap: SeatMap = {
        ...initialMap,
        rows: initialMap.rows.map((row) => {
          if (row.label !== initialRec.best.rowLabel) return row
          return {
            ...row,
            seats: row.seats.map((s) => (s.col === targetSeat.col ? { ...s, status: 'aisle' } : s)),
          }
        }),
      }

      const correctedRec = recommend(correctedMap, 2)!
      const allRecommended = [correctedRec.best, ...correctedRec.alternatives]
      for (const block of allRecommended) {
        if (block.rowLabel === initialRec.best.rowLabel) {
          for (const seat of block.seats) {
            expect(seat.col).not.toBe(targetSeat.col)
            expect(seat.status).toBe('available')
          }
        }
      }
    })

    it('restores previous recommendation outcome when correction is undone', () => {
      const initialMap = makeMap(Array(15).fill(openRow))
      const initialRec = recommend(initialMap, 2)!

      // Mark best seats as aisles
      const correctedMap: SeatMap = {
        ...initialMap,
        rows: initialMap.rows.map((row) => {
          if (row.label !== initialRec.best.rowLabel) return row
          return {
            ...row,
            seats: row.seats.map((s) =>
              initialRec.best.seats.some((target) => target.col === s.col)
                ? { ...s, status: 'aisle' }
                : s,
            ),
          }
        }),
      }

      const correctedRec = recommend(correctedMap, 2)!
      expect(correctedRec.best.rowLabel).not.toBe(initialRec.best.rowLabel)

      // Undo: restore initial map
      const undoneRec = recommend(initialMap, 2)!
      expect(undoneRec.best.rowLabel).toBe(initialRec.best.rowLabel)
      expect(undoneRec.best.seats.map((s) => s.col)).toEqual(initialRec.best.seats.map((s) => s.col))
      expect(undoneRec.best.score).toBe(initialRec.best.score)
    })
  })
})
