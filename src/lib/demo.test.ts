import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./api', () => {
  throw new Error('The demo must not import fileToJpegBase64 or parseSeatMap.')
})

import { DEMO_SEAT_MAP, getDemoResultsState } from './demo'

describe('local demo map', () => {
  const fetchSpy = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy)
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('builds the App results state from the local fixture without fileToJpegBase64, parseSeatMap, upload, Supabase, or Gemini', () => {
    const priorities = ['distance', 'sound'] as const
    const demo = getDemoResultsState(2, [...priorities])

    expect(demo?.map).toBe(DEMO_SEAT_MAP)
    expect(demo?.rec.best.seats).toHaveLength(2)
    expect(demo).toMatchObject({ name: 'results', partySize: 2, priorities })
    expect(DEMO_SEAT_MAP.rows.flatMap((row) => row.seats).map((seat) => seat.status)).toEqual(
      expect.arrayContaining(['available', 'occupied', 'aisle']),
    )
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
