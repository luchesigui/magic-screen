import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supportedLanguages } from '../i18n'
import type { ScorePriority } from '../lib/types'

const PRIORITY_OPTIONS: ScorePriority[] = ['distance', 'sound', 'angle']

interface Props {
  onAnalyze: (file: File, partySize: number, priorities: ScorePriority[]) => void
  onDemo?: (partySize: number, priorities: ScorePriority[]) => void
  error: string | null
  partySize?: number
  onPartySizeChange?: (size: number) => void
  priorities?: ScorePriority[]
  onPrioritiesChange?: (priorities: ScorePriority[]) => void
}

export function HomeScreen({
  onAnalyze,
  onDemo,
  error,
  partySize: partySizeProp,
  onPartySizeChange,
  priorities: prioritiesProp,
  onPrioritiesChange,
}: Props) {
  const { i18n, t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [localPartySize, setLocalPartySize] = useState(2)
  const [localPriorities, setLocalPriorities] = useState<ScorePriority[]>([])
  const [dragging, setDragging] = useState(false)

  const partySize = partySizeProp ?? localPartySize
  const setPartySize = (updater: number | ((n: number) => number)) => {
    const next = typeof updater === 'function' ? updater(partySize) : updater
    if (onPartySizeChange) onPartySizeChange(next)
    else setLocalPartySize(next)
  }

  const priorities = prioritiesProp ?? localPriorities
  const togglePriority = (priority: ScorePriority) => {
    const next = priorities.includes(priority)
      ? priorities.filter((selected) => selected !== priority)
      : [...priorities, priority]
    if (onPrioritiesChange) onPrioritiesChange(next)
    else setLocalPriorities(next)
  }

  const pick = (picked: File) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(picked)
    setPreviewUrl(URL.createObjectURL(picked))
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
    if (dropped) pick(dropped)
  }

  return (
    <div className="screen">
      <header className="large-title">
        <div className="title-row">
          <h1>Magic Screen</h1>
          <label className="language-selector">
            <span>{t('language.label')}</span>
            <select value={i18n.resolvedLanguage} onChange={(event) => void i18n.changeLanguage(event.target.value)}>
              {supportedLanguages.map((language) => (
                <option key={language} value={language}>{t(`language.${language}`)}</option>
              ))}
            </select>
          </label>
        </div>
        <p>{t('home.subtitle')}</p>
      </header>

      {error && <div className="error-banner">{error}</div>}

      <div className="home-grid">
        <section className={`card${dragging ? ' dragover' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true) }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }} onDrop={onDrop}>
          <div className="card-label">{t('home.seatMap')}</div>
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => { const picked = e.target.files?.[0]; if (picked) pick(picked); e.target.value = '' }} />
          {previewUrl ? (
            <div className="picker-preview">
              <img src={previewUrl} alt={t('home.selectedSeatMap')} />
              <button className="change" onClick={() => inputRef.current?.click()}>{t('home.change')}</button>
            </div>
          ) : (
            <button className="picker" onClick={() => inputRef.current?.click()}>
              <span className="picker-icon" aria-hidden>🎟️</span>
              <span>{t('home.picker')}</span>
            </button>
          )}
        </section>

        <div className="home-side">
          <section className="card">
            <div className="card-label">{t('home.partySize')}</div>
            <div className="stepper">
              <div className="count">{partySize}<small>{t('home.seat', { count: partySize })}</small></div>
              <div className="stepper-buttons">
                <button aria-label={t('home.fewerSeats')} disabled={partySize <= 1} onClick={() => setPartySize((n) => Math.max(1, n - 1))}>−</button>
                <button aria-label={t('home.moreSeats')} disabled={partySize >= 10} onClick={() => setPartySize((n) => Math.min(10, n + 1))}>+</button>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-label">{t('preferences.title')}</div>
            <p className="preference-help" id="preference-help">{t('preferences.help')}</p>
            <div className="preference-options" role="group" aria-label={t('preferences.title')} aria-describedby="preference-help">
              {PRIORITY_OPTIONS.map((option) => {
                const isSelected = priorities.includes(option)
                return (
                  <label key={option} className={`preference-checkbox-label${isSelected ? ' selected' : ''}`}>
                    <input type="checkbox" value={option} checked={isSelected} onChange={() => togglePriority(option)} />
                    <span className="preference-text">{t(`preferences.${option}`)}</span>
                  </label>
                )
              })}
            </div>
          </section>

          <button className="cta" disabled={!file} onClick={() => file && onAnalyze(file, partySize, priorities)}>{t('home.findSeats')}</button>
          {import.meta.env.DEV && onDemo && (
            <button className="cta secondary demo-btn" onClick={() => onDemo(partySize, priorities)}>{t('home.loadDemo')}</button>
          )}
        </div>
      </div>
    </div>
  )
}
