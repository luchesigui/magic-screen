import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { recommend } from '../lib/scoring'
import { buildShareImage, buildShareMessage, createShareImageFile, seatRange, shareImage, shareStatusKey } from '../lib/share'
import type { Recommendation, ScorePriority, SeatMap, SeatStatus } from '../lib/types'
import { ScoreRing } from './ScoreRing'
import { SeatMapView } from './SeatMapView'

interface Props {
  map: SeatMap
  rec: Recommendation
  partySize: number
  priorities?: ScorePriority[]
  onReset: () => void
}

export function ResultsScreen({
  map: initialMap,
  rec: initialRec,
  partySize,
  priorities = [],
  onReset,
}: Props) {
  const { t } = useTranslation()
  const [mapHistory, setMapHistory] = useState<SeatMap[]>([initialMap])
  const [isEditing, setIsEditing] = useState(false)
  const [selected, setSelected] = useState(0)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isSharing, setIsSharing] = useState(false)

  const currentMap = mapHistory[mapHistory.length - 1]
  const canUndo = mapHistory.length > 1

  const currentRec = useMemo(() => {
    if (mapHistory.length === 1) return initialRec
    return recommend(currentMap, partySize, priorities)
  }, [mapHistory.length, initialRec, currentMap, partySize, priorities])

  const options = useMemo(
    () => (currentRec ? [currentRec.best, ...currentRec.alternatives] : []),
    [currentRec],
  )
  const active = options[selected] ?? options[0] ?? null

  const handleToggleAisle = useCallback(
    (rowLabel: string, col: number) => {
      const nextMap: SeatMap = {
        ...currentMap,
        rows: currentMap.rows.map((row) => {
          if (row.label !== rowLabel) return row
          return {
            ...row,
            seats: row.seats.map((seat) => {
              if (seat.col !== col) return seat
              const origRow = initialMap.rows.find((r) => r.label === rowLabel)
              const origSeat = origRow?.seats.find((s) => s.col === col)
              const originalStatus: SeatStatus = origSeat ? origSeat.status : 'available'
              const newStatus: SeatStatus = seat.status === 'aisle' ? originalStatus : 'aisle'
              return { ...seat, status: newStatus }
            }),
          }
        }),
      }

      setMapHistory((prev) => [...prev, nextMap])
      setSelected(0)
    },
    [currentMap, initialMap],
  )

  const handleUndo = useCallback(() => {
    if (mapHistory.length > 1) {
      setMapHistory((prev) => prev.slice(0, -1))
      setSelected(0)
    }
  }, [mapHistory.length])

  const shareMessage = useMemo(() => {
    if (!currentRec) return ''
    return buildShareMessage({
      rec: currentRec,
      selected,
      partySize,
      priorities,
      t,
    })
  }, [currentRec, selected, partySize, priorities, t])

  const handleShareImage = async () => {
    if (!active) return
    setIsSharing(true)
    setStatusMessage(null)
    try {
      const image = await buildShareImage({ map: currentMap, active, priorities, t })
      const file = createShareImageFile(image)
      const result = await shareImage(file, shareMessage, t('results.share.cardTitle'))
      const statusKey = shareStatusKey(result)
      if (statusKey) setStatusMessage(t(statusKey))
    } catch {
      setStatusMessage(t('results.share.failed'))
    } finally {
      setIsSharing(false)
    }
  }

  return (
    <div className="screen">
      <header className="large-title">
        <h1>{t('results.title')}</h1>
        <p>{t('results.subtitle', { count: partySize })}</p>
      </header>

      <div className="results-grid">
        <div className="results-map">
          <section className="card seatmap-card">
            <div className="seatmap-toolbar">
              <h2 className="seatmap-title">{t('home.seatMap')}</h2>
              <div className="seatmap-actions">
                {canUndo && (
                  <button
                    type="button"
                    className="correction-undo-btn"
                    onClick={handleUndo}
                    aria-label={t('results.undoCorrection')}
                  >
                    {t('results.undoCorrection')}
                  </button>
                )}
                <button
                  type="button"
                  className={`correction-toggle-btn ${isEditing ? 'active' : ''}`}
                  onClick={() => setIsEditing((prev) => !prev)}
                  aria-pressed={isEditing}
                >
                  {isEditing ? t('results.doneEditing') : t('results.correctMap')}
                </button>
              </div>
            </div>

            {isEditing && (
              <div className="correction-hint-banner" role="status">
                {t('results.correctionHint')}
              </div>
            )}

            <SeatMapView
              map={currentMap}
              highlighted={active}
              isEditing={isEditing}
              onToggleAisle={handleToggleAisle}
            />
          </section>

          {active ? (
            <section className="card">
              <div className="result-header">
                <div>
                  <div className="seats">{seatRange(active)}</div>
                  <div className="row-note">{t('results.row', { row: active.rowLabel })}</div>
                </div>
                <div className="score-pill">{active.score}</div>
              </div>
              {active.split && <p className="split-note">{t('results.split', { count: partySize })}</p>}
              <div className="rings">
                <details className="ring-detail">
                  <summary>
                    <ScoreRing
                      label={t('results.distance')}
                      value={active.breakdown.distance}
                      delta={
                        currentRec && selected > 0
                          ? active.breakdown.distance - currentRec.best.breakdown.distance
                          : undefined
                      }
                    />
                  </summary>
                  <div className="ring-detail-body">{t('results.distanceDetail')}</div>
                </details>
                <details className="ring-detail">
                  <summary>
                    <ScoreRing
                      label={t('results.centering')}
                      value={active.breakdown.centering}
                      delta={
                        currentRec && selected > 0
                          ? active.breakdown.centering - currentRec.best.breakdown.centering
                          : undefined
                      }
                    />
                  </summary>
                  <div className="ring-detail-body">{t('results.centeringDetail')}</div>
                </details>
                <details className="ring-detail">
                  <summary>
                    <ScoreRing
                      label={t('results.sound')}
                      value={active.breakdown.sound}
                      delta={
                        currentRec && selected > 0
                          ? active.breakdown.sound - currentRec.best.breakdown.sound
                          : undefined
                      }
                    />
                  </summary>
                  <div className="ring-detail-body">{t('results.soundDetail')}</div>
                </details>
              </div>
              <p className="split-note">{t('results.aislePenalty')}</p>
            </section>
          ) : (
            <section className="card no-seats-card">
              <p>{t('results.noSeatsAfterCorrection', { count: partySize })}</p>
            </section>
          )}
        </div>

        <div className="results-side">
          {currentRec && currentRec.alternatives.length > 0 && (
            <section className="card">
              <div className="card-label">{t('results.options')}</div>
              <div className="alt-list">
                {options.map((block, i) => (
                  <button
                    key={`${block.rowLabel}-${block.seats[0].id}`}
                    className="alt-row"
                    aria-pressed={i === selected}
                    onClick={() => setSelected(i)}
                  >
                    <span>
                      <span className="alt-seats">{seatRange(block)}</span>
                      <span className="alt-sub">
                        {i === 0 ? t('results.topPick') : t('results.alternative', { number: i })} ·{' '}
                        {t('results.row', { row: block.rowLabel })}
                      </span>
                    </span>
                    <span className="alt-score">{block.score}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {currentRec && active && (
            <section className="card share-card" aria-labelledby="share-card-title">
              <div className="card-label" id="share-card-title">
                {t('results.share.cardTitle')}
              </div>
              <div className="share-preview">
                <pre className="share-text">{shareMessage}</pre>
              </div>
              <div className="share-actions">
                <button
                  type="button"
                  className="cta share-btn primary"
                  onClick={handleShareImage}
                  disabled={isSharing}
                  aria-busy={isSharing}
                >
                  {isSharing ? t('results.share.sharing') : t('results.share.share')}
                </button>
              </div>
              {statusMessage && (
                <div className="share-status" aria-live="polite" role="status">
                  {statusMessage}
                </div>
              )}
            </section>
          )}

          <button className="cta secondary" onClick={onReset}>
            {t('results.checkAnother')}
          </button>
        </div>
      </div>
    </div>
  )
}
