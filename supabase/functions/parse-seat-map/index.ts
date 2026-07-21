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
- Each seat token is its printed label (e.g. "K10"). Occupied seats hide their number behind a person icon — infer their label from the neighbors' numbering, and append "x" (e.g. "K10x"). Other non-available markers: b=blocked, w=wheelchair, c=companion, r=reduced mobility.
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

function statusById(map: SeatMap): Map<string, string> {
  const m = new Map<string, string>()
  for (const row of map.rows) {
    for (const seat of row.seats) m.set(`${row.label}:${seat.id}`, seat.status)
  }
  return m
}

/** Same grid (identical seat-id set) and few status disagreements → converged. */
function compare(a: SeatMap, b: SeatMap): { gridMatch: boolean; disagreements: number } {
  const ma = statusById(a)
  const mb = statusById(b)
  if (ma.size !== mb.size) return { gridMatch: false, disagreements: Infinity }
  let disagreements = 0
  for (const [key, status] of ma) {
    if (!mb.has(key)) return { gridMatch: false, disagreements: Infinity }
    if (mb.get(key) !== status) disagreements++
  }
  return { gridMatch: true, disagreements }
}

/** Two-run merge: a seat is available only if BOTH runs agree it is (conservative). */
function mergeUnion(a: SeatMap, b: SeatMap): SeatMap {
  const other = statusById(b)
  return {
    screenPosition: a.screenPosition,
    rows: a.rows.map((row) => ({
      label: row.label,
      seats: row.seats.map((seat) => {
        const bStatus = other.get(`${row.label}:${seat.id}`)
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
        const key = `${row.label}:${seat.id}`
        votes.set(key, [...(votes.get(key) ?? []), seat.status])
      }
    }
  }
  return {
    screenPosition: base.screenPosition,
    rows: base.rows.map((row) => ({
      label: row.label,
      seats: row.seats.map((seat) => {
        const statuses = votes.get(`${row.label}:${seat.id}`) ?? []
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
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-flash-latest'
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

    if (results.length < 2) {
      final = results[0]
      converged = false
    } else {
      const cmp = compare(results[0], results[1])
      disagreements = Number.isFinite(cmp.disagreements) ? cmp.disagreements : -1
      if ((cmp.gridMatch && cmp.disagreements <= CONVERGE_TOLERANCE) || maxVotes < 3) {
        final = mergeUnion(results[0], results[1])
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
