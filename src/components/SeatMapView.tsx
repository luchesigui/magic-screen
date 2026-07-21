import { useMemo } from 'react'
import type { ScoredBlock, SeatMap } from '../lib/types'

const UNIT = 24
const SEAT = 18
const GUTTER = 26
const SCREEN_H = 26
const PAD = 8

interface Props {
  map: SeatMap
  highlighted: ScoredBlock
}

export function SeatMapView({ map, highlighted }: Props) {
  const { minCol, maxCol } = useMemo(() => {
    let min = Infinity
    let max = -Infinity
    for (const row of map.rows) {
      for (const seat of row.seats) {
        if (seat.col < min) min = seat.col
        if (seat.col > max) max = seat.col
      }
    }
    return { minCol: min, maxCol: max }
  }, [map])

  const highlightedIds = useMemo(
    () => new Set(highlighted.seats.map((s) => `${highlighted.rowLabel}:${s.col}`)),
    [highlighted],
  )

  // rows[0] is closest to the screen; draw it adjacent to the screen bar.
  const screenOnTop = map.screenPosition === 'top'
  const visualRows = screenOnTop ? map.rows : [...map.rows].reverse()

  const gridW = (maxCol - minCol + 1) * UNIT
  const width = gridW + GUTTER * 2 + PAD * 2
  const rowsH = map.rows.length * UNIT
  const height = rowsH + SCREEN_H + 22 + PAD * 2

  const rowY = (i: number) => PAD + (screenOnTop ? SCREEN_H + 18 : 0) + i * UNIT
  const screenY = screenOnTop ? PAD : PAD + rowsH + 14

  const seatX = (col: number) => PAD + GUTTER + (col - minCol) * UNIT

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Seat map with recommended seats in row ${highlighted.rowLabel}`}
    >
      {/* Screen */}
      <path
        d={`M ${PAD + GUTTER + gridW * 0.06} ${screenY + (screenOnTop ? SCREEN_H : 0)}
            L ${PAD + GUTTER} ${screenY + (screenOnTop ? 0 : SCREEN_H)}
            L ${PAD + GUTTER + gridW} ${screenY + (screenOnTop ? 0 : SCREEN_H)}
            L ${PAD + GUTTER + gridW * 0.94} ${screenY + (screenOnTop ? SCREEN_H : 0)} Z`}
        fill="var(--bg-inset)"
      />
      <text
        x={PAD + GUTTER + gridW / 2}
        y={screenY + SCREEN_H / 2 + 4}
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        letterSpacing="3"
        fill="var(--text-secondary)"
      >
        SCREEN
      </text>

      {visualRows.map((row, i) => {
        const y = rowY(i)
        return (
          <g key={row.label}>
            <text
              x={PAD + GUTTER - 12}
              y={y + SEAT / 2 + 4}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="var(--text-secondary)"
            >
              {row.label}
            </text>
            {row.seats.map((seat) => {
              const isPick = highlightedIds.has(`${row.label}:${seat.col}`)
              let fill = 'var(--seat-available)'
              if (seat.status === 'occupied' || seat.status === 'blocked') {
                fill = 'var(--seat-occupied)'
              } else if (seat.status !== 'available') {
                fill = 'var(--seat-special)'
              }
              return (
                <rect
                  key={seat.id}
                  className={isPick ? 'seat-best' : undefined}
                  x={seatX(seat.col)}
                  y={y}
                  width={SEAT}
                  height={SEAT}
                  rx={6}
                  fill={isPick ? 'var(--gold)' : fill}
                />
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}
