import { useEffect, useState } from 'react'

const STAGES = [
  'Reading the room…',
  'Mapping every seat…',
  'Scoring distance, centering and sound…',
  'Picking your spot…',
]

export function AnalyzingScreen({ previewUrl }: { previewUrl: string }) {
  const [stageIndex, setStageIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(
      () => setStageIndex((i) => Math.min(i + 1, STAGES.length - 1)),
      3500,
    )
    return () => clearInterval(id)
  }, [])

  return (
    <div className="analyzing">
      <div className="backdrop" style={{ backgroundImage: `url(${previewUrl})` }} />
      <div className="glass" role="status">
        <div className="spinner" aria-hidden />
        <p>{STAGES[stageIndex]}</p>
      </div>
    </div>
  )
}
