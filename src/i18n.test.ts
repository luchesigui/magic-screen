import { describe, expect, it } from 'vitest'
import { errorTranslationKey, resources } from './i18n'

function leafKeys(value: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null
      ? leafKeys(child as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  )
}

describe('translations', () => {
  it('keeps the PT-BR catalog complete and distinct from English', () => {
    expect(leafKeys(resources['pt-BR'].translation)).toEqual(leafKeys(resources.en.translation))
    expect(resources['pt-BR'].translation.home.findSeats).toBe('Encontrar meus lugares')
  })

  it('hides unexpected backend errors behind the PT-BR generic message', () => {
    expect(errorTranslationKey('Gemini 503: upstream unavailable')).toBe('errors.generic')
    expect(resources['pt-BR'].translation.errors.generic).toBe('Algo deu errado.')
  })
})
