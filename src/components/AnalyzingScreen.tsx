import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const STAGE_KEYS = [
  'analyzing.reading',
  'analyzing.mapping',
  'analyzing.scoring',
  'analyzing.picking',
] as const

export function AnalyzingScreen({ previewUrl }: { previewUrl: string }) {
  const { t } = useTranslation()
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(
      () => setStageIndex((i) => Math.min(i + 1, STAGE_KEYS.length - 1)),
      3500,
    )
    return () => clearInterval(id)
  }, [])

  return (
    <div className="analyzing">
      <div className="backdrop" style={{ backgroundImage: `url(${previewUrl})` }} />
      <div className="glass" role="status">
        <div className="spinner" aria-hidden />
        <p>{t(STAGE_KEYS[stageIndex])}</p>
      </div>
    </div>
  )
}
