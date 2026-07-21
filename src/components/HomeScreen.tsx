import { useRef, useState } from 'react'

interface Props {
  onAnalyze: (file: File, partySize: number) => void
  error: string | null
}

export function HomeScreen({ onAnalyze, error }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [partySize, setPartySize] = useState(2)
  const [dragging, setDragging] = useState(false)

  const pick = (picked: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(picked)
    setPreviewUrl(URL.createObjectURL(picked))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files).find((f) =>
      f.type.startsWith('image/'),
    )
    if (dropped) pick(dropped)
  }

  return (
    <div className="screen">
      <header className="large-title">
        <h1>Magic Screen</h1>
        <p>Snap the seat map. Get the best seats.</p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="home-grid">
        <section
          className={`card${dragging ? ' dragover' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false)
          }}
          onDrop={onDrop}
        >
          <div className="card-label">Seat map</div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) pick(f)
              e.target.value = ''
            }}
          />
          {previewUrl ? (
            <div className="picker-preview">
              <img src={previewUrl} alt="Selected seat map" />
              <button className="change" onClick={() => inputRef.current?.click()}>
                Change
              </button>
            </div>
          ) : (
            <button className="picker" onClick={() => inputRef.current?.click()}>
              <span className="picker-icon" aria-hidden>
                🎟️
              </span>
              <span>
                <strong>Take a photo</strong>, pick a screenshot,
                <br />
                or drop the seat map image here
              </span>
            </button>
          )}
        </section>

        <div className="home-side">
          <section className="card">
            <div className="card-label">Party size</div>
            <div className="stepper">
              <div className="count">
                {partySize}
                <small>{partySize === 1 ? 'seat' : 'seats together'}</small>
              </div>
              <div className="stepper-buttons">
                <button
                  aria-label="Fewer seats"
                  disabled={partySize <= 1}
                  onClick={() => setPartySize((n) => Math.max(1, n - 1))}
                >
                  −
                </button>
                <button
                  aria-label="More seats"
                  disabled={partySize >= 10}
                  onClick={() => setPartySize((n) => Math.min(10, n + 1))}
                >
                  +
                </button>
              </div>
            </div>
          </section>

          <button className="cta" disabled={!file} onClick={() => file && onAnalyze(file, partySize)}>
            Find my seats
          </button>
        </div>
      </div>
    </div>
  )
}
