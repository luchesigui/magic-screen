import { describe, expect, it, vi } from 'vitest'
import i18n from '../i18n'
import type { Recommendation, ScoredBlock, SeatMap } from './types'
import { buildShareImage, buildShareMessage, createShareImageFile, seatRange, shareImage, shareStatusKey } from './share'

function makeBlock(rowLabel: string, seatIds: string[], score: number): ScoredBlock {
  return {
    rowLabel,
    seats: seatIds.map((id, index) => ({ id, col: index + 1, status: 'available' })),
    score,
    breakdown: { distance: 80, centering: 80, sound: 80 },
    split: false,
  }
}

describe('share helper', () => {
  it('formats seat range correctly', () => {
    const single = makeBlock('A', ['A1'], 90)
    const multi = makeBlock('B', ['B2', 'B3', 'B4'], 85)
    expect(seatRange(single)).toBe('A1')
    expect(seatRange(multi)).toBe('B2 – B4')
  })

  it('builds deterministic share message when Top Pick is selected (EN)', () => {
    const rec: Recommendation = {
      best: makeBlock('F', ['F4', 'F5'], 95),
      alternatives: [
        makeBlock('G', ['G4', 'G5'], 90),
        makeBlock('E', ['E4', 'E5'], 85),
      ],
    }

    const t = i18n.getFixedT('en')
    const message = buildShareMessage({
      rec,
      selected: 0,
      partySize: 2,
      baseUrl: 'https://magicscreen.app',
      t,
    })

    expect(message).toContain('🎬 Magic Screen')
    expect(message).toContain('👥 Party size: 2')
    expect(message).toContain('⭐ Top Pick: Row F (F4 – F5) · 95/100')
    expect(message).toContain('💡 Alternatives:')
    expect(message).toContain('• Alt 1: Row G (G4 – G5) · 90/100')
    expect(message).toContain('• Alt 2: Row E (E4 – E5) · 85/100')
    expect(message).toContain('Find the best cinema seats with Magic Screen:')
    expect(message).toContain('https://magicscreen.app')
  })

  it('builds deterministic share message when Alternative is selected (pt-BR)', () => {
    const rec: Recommendation = {
      best: makeBlock('F', ['F4', 'F5'], 95),
      alternatives: [
        makeBlock('G', ['G4', 'G5'], 90),
        makeBlock('E', ['E4', 'E5'], 85),
        makeBlock('D', ['D4', 'D5'], 80),
      ],
    }

    const t = i18n.getFixedT('pt-BR')
    const message = buildShareMessage({
      rec,
      selected: 1, // Alt 1 selected
      partySize: 2,
      baseUrl: 'https://magicscreen.app',
      t,
    })

    expect(message).toContain('🎬 Magic Screen')
    expect(message).toContain('👥 Quantidade de pessoas: 2')
    expect(message).toContain('🎯 Selecionado: Fila G (G4 – G5) · 90/100')
    expect(message).toContain('⭐ Melhor Escolha: Fila F (F4 – F5) · 95/100')
    expect(message).toContain('💡 Alternativas:')
    expect(message).toContain('• Alt 2: Fila E (E4 – E5) · 85/100')
    expect(message).toContain('• Alt 3: Fila D (D4 – D5) · 80/100')
    expect(message).not.toContain('• Alt 1:')
    expect(message).toContain('Encontre os melhores lugares no cinema com o Magic Screen:')
    expect(message).toContain('https://magicscreen.app')
  })

  it('limits alternatives to 2 when present', () => {
    const rec: Recommendation = {
      best: makeBlock('F', ['F1'], 95),
      alternatives: [
        makeBlock('G', ['G1'], 90),
        makeBlock('E', ['E1'], 85),
        makeBlock('D', ['D1'], 80),
      ],
    }

    const t = i18n.getFixedT('en')
    const message = buildShareMessage({
      rec,
      selected: 0,
      partySize: 1,
      baseUrl: 'https://magicscreen.app',
      t,
    })

    expect(message).toContain('• Alt 1: Row G (G1) · 90/100')
    expect(message).toContain('• Alt 2: Row E (E1) · 85/100')
    expect(message).not.toContain('• Alt 3:')
  })

  it('handles zero alternatives gracefully', () => {
    const rec: Recommendation = {
      best: makeBlock('A', ['A1'], 90),
      alternatives: [],
    }

    const t = i18n.getFixedT('en')
    const message = buildShareMessage({
      rec,
      selected: 0,
      partySize: 1,
      baseUrl: 'https://magicscreen.app',
      t,
    })

    expect(message).not.toContain('💡 Alternatives:')
    expect(message).toContain('⭐ Top Pick: Row A (A1) · 90/100')
  })

  it('normalizes out-of-range selected index to 0 without duplicating lines', () => {
    const rec: Recommendation = {
      best: makeBlock('F', ['F4', 'F5'], 95),
      alternatives: [
        makeBlock('G', ['G4', 'G5'], 90),
        makeBlock('E', ['E4', 'E5'], 85),
      ],
    }

    const t = i18n.getFixedT('en')
    const message = buildShareMessage({
      rec,
      selected: 99,
      partySize: 2,
      baseUrl: 'https://magicscreen.app',
      t,
    })

    expect(message).toContain('⭐ Top Pick: Row F (F4 – F5) · 95/100')
    expect(message).not.toContain('🎯 Selected:')
    expect(message).toContain('• Alt 1: Row G (G4 – G5) · 90/100')
    expect(message).toContain('• Alt 2: Row E (E4 – E5) · 85/100')
  })

  it('shares the PNG, title and contextual text without clipboard, download or WhatsApp fallbacks', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn().mockReturnValue(true)
    const writeText = vi.fn()
    const open = vi.fn()
    const createObjectURL = vi.fn()
    const originalNavigator = globalThis.navigator
    const originalWindow = globalThis.window
    const originalURL = globalThis.URL
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { share, canShare, clipboard: { writeText } },
    })
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { open } })
    Object.defineProperty(globalThis, 'URL', { configurable: true, value: { createObjectURL } })
    const file = new File([new Blob(['map'], { type: 'image/png' })], 'magic-screen-recommendation.png', { type: 'image/png' })

    try {
      await expect(shareImage(file, 'Recommendation: Row F', 'Share recommendation')).resolves.toBe('shared')
      expect(canShare).toHaveBeenCalledWith({ files: [file] })
      expect(share).toHaveBeenCalledWith({ files: [file], text: 'Recommendation: Row F', title: 'Share recommendation' })
      expect(writeText).not.toHaveBeenCalled()
      expect(createObjectURL).not.toHaveBeenCalled()
      expect(open).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator })
      Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
      Object.defineProperty(globalThis, 'URL', { configurable: true, value: originalURL })
    }
  })

  it('creates a PNG file even when the canvas Blob has no type', () => {
    const file = createShareImageFile(new Blob(['map']))

    expect(file.name).toBe('magic-screen-recommendation.png')
    expect(file.type).toBe('image/png')
  })

  it('does not treat a cancelled share as an error', async () => {
    const originalNavigator = globalThis.navigator
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        canShare: vi.fn().mockReturnValue(true),
        share: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')),
      },
    })

    try {
      await expect(shareImage(new File(['map'], 'map.png', { type: 'image/png' }), 'text', 'title')).resolves.toBe('cancelled')
    } finally {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator })
    }
  })

  it('reports files rejected by canShare without any fallback action', async () => {
    const originalNavigator = globalThis.navigator
    const share = vi.fn()
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { share, canShare: vi.fn().mockReturnValue(false), clipboard: { writeText: vi.fn() } },
    })

    try {
      await expect(shareImage(new File(['map'], 'map.png', { type: 'image/png' }), 'text', 'title')).resolves.toBe('file-unsupported')
      expect(share).not.toHaveBeenCalled()
    } finally {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator })
    }
  })

  it('maps a canShare exception to its distinct status message', async () => {
    const originalNavigator = globalThis.navigator
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { share: vi.fn(), canShare: vi.fn().mockImplementation(() => { throw new Error('bad payload') }) },
    })

    try {
      await expect(shareImage(new File(['map'], 'map.png', { type: 'image/png' }), 'text', 'title')).resolves.toBe('capability-check-failed')
      const key = shareStatusKey('capability-check-failed')
      expect(key).toBe('results.share.capabilityCheckFailed')
      expect(i18n.getFixedT('en')(key!)).toBe('We could not verify sharing in this browser. Please try again.')
      expect(i18n.getFixedT('pt-BR')(key!)).toBe('Não foi possível verificar o compartilhamento neste navegador. Tente novamente.')
    } finally {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator })
    }
  })

  it('reports an insecure context before checking share support', async () => {
    const originalNavigator = globalThis.navigator
    const originalWindow = globalThis.window
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { share: vi.fn(), canShare: vi.fn() } })
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: false } })

    try {
      await expect(shareImage(new File(['map'], 'map.png', { type: 'image/png' }), 'text', 'title')).resolves.toBe('insecure-context')
    } finally {
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: originalNavigator })
      Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
    }
  })

  it('selects the HTTPS or localhost message for an insecure context', () => {
    const key = shareStatusKey('insecure-context')

    expect(key).toBe('results.share.insecureContext')
    expect(i18n.getFixedT('en')(key!)).toContain('HTTPS or localhost')
    expect(i18n.getFixedT('pt-BR')(key!)).toContain('HTTPS ou localhost')
  })

  it('builds a shareable map image with recommendation, score and priority markings', async () => {
    const fillText = vi.fn()
    const fillRect = vi.fn()
    const rects: Array<{ color: string; args: number[] }> = []
    let fillStyle = ''
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        get fillStyle() { return fillStyle },
        set fillStyle(value: string) { fillStyle = value },
        font: '',
        textAlign: '',
        fillText,
        fillRect: (...args: number[]) => {
          fillRect(...args)
          rects.push({ color: fillStyle, args })
        },
      }),
      toBlob: (callback: BlobCallback, type?: string) => callback(new Blob(['map'], { type })),
    }
    const createElement = vi.fn(() => canvas)
    const originalDocument = globalThis.document
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement } })
    const map: SeatMap = {
      screenPosition: 'top',
      rows: [{ label: 'F', seats: [{ id: 'F1', col: 1, status: 'available' }, { id: 'F2', col: 2, status: 'occupied' }, { id: 'F3', col: 3, status: 'available' }] }],
    }
    try {
      const image = await buildShareImage({ map, active: makeBlock('F', ['F1'], 95), priorities: ['sound'], t: i18n.getFixedT('en') })
      expect(image.type).toBe('image/png')
      expect(createElement).toHaveBeenCalledWith('canvas')
      expect(canvas).toMatchObject({ width: 360, height: 182 })
      expect(fillText).toHaveBeenCalledWith('Magic Screen', expect.any(Number), expect.any(Number))
      expect(fillText).toHaveBeenCalledWith(expect.stringContaining('95/100'), expect.any(Number), expect.any(Number))
      expect(fillText).toHaveBeenCalledWith(expect.stringContaining('Sound'), expect.any(Number), expect.any(Number))
      expect(rects).toContainEqual({ color: '#55b98a', args: [90, 122, 26, 26] })
      expect(rects).toContainEqual({ color: '#626270', args: [60, 122, 26, 26] })
      expect(rects).toContainEqual({ color: '#f6c343', args: [30, 122, 26, 26] })
    } finally {
      Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })
    }
  })
})
