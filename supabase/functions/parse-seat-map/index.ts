const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Compact per-row token format: ~7x fewer output tokens than per-seat JSON,
// which is what dominates latency. Printed seat labels are preserved.
const SEAT_MAP_SCHEMA = {
  type: 'OBJECT',
  required: ['screenPosition', 'rows'],
  properties: {
    screenPosition: { type: 'STRING', enum: ['top', 'bottom'] },
    rows: {
      type: 'ARRAY',
      description: 'All rows ordered from closest-to-screen to farthest',
      items: {
        type: 'OBJECT',
        required: ['label', 'seats'],
        properties: {
          label: { type: 'STRING', description: 'Row letter exactly as printed' },
          seats: {
            type: 'STRING',
            description:
              "Space-separated tokens, one per grid column, aligned across rows. Each seat token is its printed label plus a status suffix only when NOT available: x=occupied, b=blocked, w=wheelchair, c=companion, r=reduced mobility (e.g. 'F2x'). Available seats are just the label (e.g. 'F5'). Use '.' for a column with no seat (aisle/gap).",
          },
        },
      },
    },
  },
}

const PROMPT = `This image is a cinema seat-selection map. Transcribe the full seat grid, row by row.

- Order rows from CLOSEST to the screen ("TELA"/"SCREEN" bar) to FARTHEST.
- One token per grid column so vertically aligned seats sit at the same token position in every row; use "." for aisles/gaps.
- Each seat token is its printed label (e.g. "K10"). Occupied seats hide their number behind a person icon, so append "x" (e.g. "K10x").
- To label a hidden seat, anchor on the CLOSEST PRINTED number in the same row and count outward from it, one step per seat. Never carry a count across a gap: a row's numbering often skips at an aisle (e.g. ... 11 12 [gap] 16 17 ...), so a seat right after a gap is NOT the previous number plus one. Always re-anchor on the nearest printed number on the far side of the gap.
- Other non-available markers: b=blocked, w=wheelchair, c=companion, r=reduced mobility.
- Check the legend to map icons correctly. Most seats are usually available — only suffix seats clearly drawn as non-available.
- Include EVERY seat in EVERY row.`

const STATUS_BY_SUFFIX: Record<string, string> = {
  x: 'occupied',
  b: 'blocked',
  w: 'wheelchair',
  c: 'companion',
  r: 'reduced-mobility',
}

// How many status disagreements two runs may have and still "converge".
const CONVERGE_TOLERANCE = 2

// How many seats may exist in one run's grid but not the other's and still
// "converge". Runs occasionally disagree by a seat or two around a wide aisle
// (numbering skips there, e.g. ...11 12 [gap] 16 17...). Telemetry showed that
// was triggering a 3rd vote on most analyses, and the tie-break did not fix it:
// the extra call doubled cost and latency for the same wrong answer. Below this
// threshold the two runs are close enough to merge.
const GRID_TOLERANCE = 4

interface Seat {
  id: string
  col: number
  status: string
}
interface SeatMap {
  screenPosition: string
  rows: { label: string; seats: Seat[] }[]
}

function expand(raw: {
  screenPosition: string
  rows: { label: string; seats: string }[]
}): SeatMap {
  return {
    screenPosition: raw.screenPosition,
    rows: raw.rows.map((row) => {
      const seats: Seat[] = []
      row.seats.split(/\s+/).forEach((token, col) => {
        if (!token || token === '.') return
        const suffix = token[token.length - 1]
        const status = /\d/.test(suffix) ? 'available' : (STATUS_BY_SUFFIX[suffix] ?? 'available')
        const id = status === 'available' ? token : token.slice(0, -1)
        seats.push({ id, col, status })
      })
      return { label: row.label, seats }
    }),
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Per-attempt cap so a slow/overloaded model can't hang the function up to the
// edge gateway limit (~150s). Two attempts × this stays well under it.
const CALL_TIMEOUT_MS = 45000
const MAX_ATTEMPTS = 2

async function callGemini(
  apiKey: string,
  model: string,
  image: string,
  mediaType: string,
  attempt = 0,
): Promise<SeatMap> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { inline_data: { mime_type: mediaType, data: image } },
                { text: PROMPT },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: SEAT_MAP_SCHEMA,
            maxOutputTokens: 16384,
            thinkingConfig: { thinkingLevel: 'minimal' },
            mediaResolution: 'MEDIA_RESOLUTION_HIGH',
          },
        }),
      },
    )
    if (!res.ok) {
      // 429/5xx (incl. 503 demand spikes) are transient — retry with backoff.
      if ((res.status === 429 || res.status >= 500) && attempt + 1 < MAX_ATTEMPTS) {
        await sleep(800)
        return callGemini(apiKey, model, image, mediaType, attempt + 1)
      }
      throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`)
    }
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? '')
      .join('')
    if (!text) throw new Error('empty response')
    return expand(JSON.parse(text))
  } catch (err) {
    // Timeout / network error — retry once before giving up.
    const name = (err as { name?: string })?.name
    if ((name === 'TimeoutError' || name === 'AbortError') && attempt + 1 < MAX_ATTEMPTS) {
      return callGemini(apiKey, model, image, mediaType, attempt + 1)
    }
    throw err
  }
}

/**
 * Merge key for a seat. Case-folded on purpose: some cinemas print a row in
 * lowercase (e.g. row "k"), and runs disagree on the casing they echo back.
 * Keying case-sensitively made the same row read as two disjoint sets of seats,
 * which forced a 3rd vote and split the votes so real occupied seats fell below
 * the majority and were reported as free. Display still uses the printed id.
 */
const seatKey = (rowLabel: string, seatId: string) => `${rowLabel}:${seatId}`.toUpperCase()

function statusById(map: SeatMap): Map<string, string> {
  const m = new Map<string, string>()
  for (const row of map.rows) {
    for (const seat of row.seats) m.set(seatKey(row.label, seat.id), seat.status)
  }
  return m
}

/**
 * How far apart two runs are: `gridDiff` counts seats present in one grid but
 * not the other, `disagreements` counts status conflicts among the seats both
 * saw. Small values on both → close enough to merge without a 3rd vote.
 */
function compare(a: SeatMap, b: SeatMap): { gridDiff: number; disagreements: number } {
  const ma = statusById(a)
  const mb = statusById(b)
  let gridDiff = 0
  let disagreements = 0
  for (const [key, status] of ma) {
    if (!mb.has(key)) gridDiff++
    else if (mb.get(key) !== status) disagreements++
  }
  for (const key of mb.keys()) {
    if (!ma.has(key)) gridDiff++
  }
  return { gridDiff, disagreements }
}

/** Two-run merge: a seat is available only if BOTH runs agree it is (conservative). */
function mergeUnion(a: SeatMap, b: SeatMap): SeatMap {
  const other = statusById(b)
  return {
    screenPosition: a.screenPosition,
    rows: a.rows.map((row) => ({
      label: row.label,
      seats: row.seats.map((seat) => {
        const bStatus = other.get(seatKey(row.label, seat.id))
        if (seat.status !== 'available') return seat
        if (bStatus && bStatus !== 'available') return { ...seat, status: bStatus }
        return seat
      }),
    })),
  }
}

/** Three-run merge: majority vote per seat; grid from the median-sized map. */
function mergeMajority(maps: SeatMap[]): SeatMap {
  const counted = maps
    .map((m) => ({ m, n: m.rows.reduce((s, r) => s + r.seats.length, 0) }))
    .sort((x, y) => x.n - y.n)
  const base = counted[Math.floor(counted.length / 2)].m

  const votes = new Map<string, string[]>()
  for (const m of maps) {
    for (const row of m.rows) {
      for (const seat of row.seats) {
        const key = seatKey(row.label, seat.id)
        votes.set(key, [...(votes.get(key) ?? []), seat.status])
      }
    }
  }
  return {
    screenPosition: base.screenPosition,
    rows: base.rows.map((row) => ({
      label: row.label,
      seats: row.seats.map((seat) => {
        const statuses = votes.get(seatKey(row.label, seat.id)) ?? []
        const bad = statuses.filter((s) => s !== 'available')
        if (bad.length >= 2) {
          const top = bad.sort(
            (p, q) => bad.filter((x) => x === q).length - bad.filter((x) => x === p).length,
          )[0]
          return { ...seat, status: top }
        }
        return { ...seat, status: 'available' }
      }),
    })),
  }
}

function countSeats(map: SeatMap) {
  let seats = 0
  let occupied = 0
  for (const row of map.rows) {
    for (const seat of row.seats) {
      seats++
      if (seat.status !== 'available') occupied++
    }
  }
  return { seats, occupied }
}

/** Best-effort telemetry — never blocks or fails the request. */
async function logTelemetry(row: Record<string, unknown>): Promise<void> {
  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return
  try {
    await fetch(`${url}/rest/v1/parse_telemetry`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    })
  } catch (err) {
    console.error('telemetry insert failed', err)
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { image, mediaType } = await req.json()
    if (!image) return json(400, { error: 'Missing "image" (base64)' })

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) return json(500, { error: 'GEMINI_API_KEY secret is not configured' })
    // Pinned on purpose: the `-latest` aliases silently re-point to a new model
    // when Google promotes one, changing accuracy, latency and price with no
    // warning. Bump this only after re-running the accuracy bench.
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.6-flash'
    const maxVotes = Math.max(1, Number(Deno.env.get('GEMINI_MAX_VOTES') ?? '3'))
    const media = mediaType ?? 'image/jpeg'
    const t0 = Date.now()

    const call = () => callGemini(apiKey, model, image, media)
    const settle = async (): Promise<SeatMap | null> => {
      try {
        return await call()
      } catch (err) {
        console.error('gemini call failed', err)
        return null
      }
    }

    // Adaptive voting: run 2 in parallel; escalate to a 3rd only if they diverge.
    const initial = Math.min(2, maxVotes)
    const results = (await Promise.all(Array.from({ length: initial }, settle))).filter(
      (m): m is SeatMap => m !== null,
    )
    if (results.length === 0) {
      return json(502, { error: 'The vision model could not read this image.' })
    }

    let final: SeatMap
    let votesUsed = results.length
    let converged: boolean
    let disagreements = 0
    let gridDiff = 0

    if (results.length < 2) {
      final = results[0]
      converged = false
    } else {
      // Merge onto the richer grid: a seat missing from the base can never be
      // recommended, which is worse than carrying one the other run didn't see.
      const [base, other] = [...results].sort(
        (x, y) => countSeats(y).seats - countSeats(x).seats,
      )
      const cmp = compare(base, other)
      disagreements = cmp.disagreements
      gridDiff = cmp.gridDiff
      const close = cmp.gridDiff <= GRID_TOLERANCE && cmp.disagreements <= CONVERGE_TOLERANCE
      if (close || maxVotes < 3) {
        final = mergeUnion(base, other)
        converged = true
      } else {
        const third = await settle()
        const all = third ? [...results, third] : results
        votesUsed = all.length
        final = all.length >= 3 ? mergeMajority(all) : mergeUnion(all[0], all[1])
        converged = false
      }
    }

    const { seats, occupied } = countSeats(final)
    await logTelemetry({
      model,
      converged,
      disagreement_seats: disagreements,
      grid_diff: gridDiff,
      votes_used: votesUsed,
      seat_count: seats,
      occupied_count: occupied,
      latency_ms: Date.now() - t0,
    })

    return json(200, final)
  } catch (err) {
    console.error(err)
    return json(500, { error: err instanceof Error ? err.message : 'Unknown error' })
  }
})
