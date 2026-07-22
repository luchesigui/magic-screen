import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import './App.css'
import { errorTranslationKey } from './i18n'
import { fileToJpegBase64, parseSeatMap } from './lib/api'
import { recommend } from './lib/scoring'
import type { Recommendation, ScorePriority, SeatMap } from './lib/types'
import { AnalyzingScreen } from './components/AnalyzingScreen'
import { HomeScreen } from './components/HomeScreen'
import { ResultsScreen } from './components/ResultsScreen'

const loadDemo = import.meta.env.DEV ? () => import('./lib/demo') : undefined

type Stage =
  | { name: 'home' }
  | { name: 'analyzing'; previewUrl: string }
  | {
      name: 'results'
      map: SeatMap
      rec: Recommendation
      partySize: number
      priorities: ScorePriority[]
    }

export default function App() {
  const { t } = useTranslation()
  const [stage, setStage] = useState<Stage>({ name: 'home' })
  const [error, setError] = useState<string | null>(null)
  const [partySize, setPartySize] = useState(2)
  const [priorities, setPriorities] = useState<ScorePriority[]>([])

  const analyze = useCallback(
    async (file: File, pSize: number, selectedPriorities: ScorePriority[]) => {
      const previewUrl = URL.createObjectURL(file)
      setError(null)
      setStage({ name: 'analyzing', previewUrl })
      try {
        const base64 = await fileToJpegBase64(file)
        const map = await parseSeatMap(base64)
        const rec = recommend(map, pSize, selectedPriorities)
        if (!rec) throw new Error('NO_SEATS')
        setStage({ name: 'results', map, rec, partySize: pSize, priorities: selectedPriorities })
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        const requestStatus = /^Request failed \((\d+)\)$/.exec(message)?.[1]
        console.error('Seat-map analysis failed:', err)
        setError(t(errorTranslationKey(message), { count: pSize, status: requestStatus }))
        setStage({ name: 'home' })
      } finally {
        URL.revokeObjectURL(previewUrl)
      }
    },
    [t],
  )

  const startDemo = useCallback(async (pSize: number, selectedPriorities: ScorePriority[]) => {
    if (!loadDemo) return
    const { getDemoResultsState } = await loadDemo()
    const demo = getDemoResultsState(pSize, selectedPriorities)
    if (!demo) return
    setError(null)
    setStage(demo)
  }, [])

  const reset = useCallback(() => {
    setError(null)
    setStage({ name: 'home' })
  }, [])

  switch (stage.name) {
    case 'home':
      return (
        <HomeScreen
          onAnalyze={analyze}
          onDemo={import.meta.env.DEV ? startDemo : undefined}
          error={error}
          partySize={partySize}
          onPartySizeChange={setPartySize}
          priorities={priorities}
          onPrioritiesChange={setPriorities}
        />
      )
    case 'analyzing':
      return <AnalyzingScreen previewUrl={stage.previewUrl} />
    case 'results':
      return (
        <ResultsScreen
          map={stage.map}
          rec={stage.rec}
          partySize={stage.partySize}
          priorities={stage.priorities}
          onReset={reset}
        />
      )
  }
}
