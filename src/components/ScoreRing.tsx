interface Props {
  label: string
  value: number
  /** Difference vs. the top pick's sub-score; shown when comparing options. */
  delta?: number
}

const R = 22
const CIRC = 2 * Math.PI * R

export function ScoreRing({ label, value, delta }: Props) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="ring">
      <svg width="58" height="58" viewBox="0 0 58 58" role="img" aria-label={`${label} ${clamped} out of 100`}>
        <circle cx="29" cy="29" r={R} fill="none" stroke="var(--bg-inset)" strokeWidth="5" />
        <circle
          cx="29"
          cy="29"
          r={R}
          fill="none"
          stroke="var(--gold)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - clamped / 100)}
          transform="rotate(-90 29 29)"
        />
        <text x="29" y="34" textAnchor="middle" className="ring-value">
          {clamped}
        </text>
      </svg>
      {label}
      {delta !== undefined && delta !== 0 && (
        <span className={`delta ${delta > 0 ? 'up' : 'down'}`}>
          {delta > 0 ? '+' : '−'}
          {Math.abs(delta)} vs top pick
        </span>
      )}
    </div>
  )
}
