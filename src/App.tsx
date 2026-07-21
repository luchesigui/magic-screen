import { useCallback, useState } from 'react'
import './App.css'
import { fileToJpegBase64, parseSeatMap } from './lib/api'
import { recommend } from './lib/scoring'
import type { Recommendation, SeatMap } from './lib/types'
import { AnalyzingScreen } from './components/AnalyzingScreen'
import { HomeScreen } from './components/HomeScreen'
import { ResultsScreen } from './components/ResultsScreen'

type Stage =
  | { name: 'home' }
  | { name: 'analyzing'; previewUrl: string }
  | { name: 'results'; map: SeatMap; rec: Recommendation; partySize: number }

export default function App() {
  const [stage, setStage] = useState<Stage>({ name: 'home' })
  const [error, setError] = useState<string | null>(null)

  const analyze = useCallback(async (file: File, partySize: number) => {
    const previewUrl = URL.createObjectURL(file)
    setError(null)
    setStage({ name: 'analyzing', previewUrl })
    try {
      const base64 = await fileToJpegBase64(file)
      const map = await parseSeatMap(base64)
      const rec = recommend(map, partySize)
      if (!rec) {
        throw new Error(
          `No row has ${partySize} free seats. Try fewer seats or another session.`,
        )
      }
      setStage({ name: 'results', map, rec, partySize })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setStage({ name: 'home' })
    } finally {
      URL.revokeObjectURL(previewUrl)
    }
  }, [])

  const reset = useCallback(() => {
    setError(null)
    setStage({ name: 'home' })
  }, [])

  switch (stage.name) {
    case 'home':
      return <HomeScreen onAnalyze={analyze} error={error} />
    case 'analyzing':
      return <AnalyzingScreen previewUrl={stage.previewUrl} />
    case 'results':
      return (
        <ResultsScreen
          map={stage.map}
          rec={stage.rec}
          partySize={stage.partySize}
          onReset={reset}
        />
      )
  }
}
