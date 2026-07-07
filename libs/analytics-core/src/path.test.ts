import { describe, expect, test } from 'bun:test'

import {
  classifyAnalyticsPath,
  localeFromAnalyticsPath,
  normalizeAnalyticsPath,
} from './path'

describe('analytics path helpers', () => {
  test('normalizes URLs and strips private tokens from paths', () => {
    expect(
      normalizeAnalyticsPath(
        'https://cv.example/en/a/frontend-alpha/?p=AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA'
      )
    ).toBe('/en/a/frontend-alpha/')
    expect(normalizeAnalyticsPath('ru')).toBe('/ru/')
    expect(normalizeAnalyticsPath('/assets/cv.pdf?download=1')).toBe(
      '/assets/cv.pdf'
    )
  })

  test('classifies audience, public, and other paths', () => {
    expect(classifyAnalyticsPath('/en/a/frontend-alpha/')).toEqual({
      audienceId: 'frontend-alpha',
      kind: 'audience',
      locale: 'en',
      path: '/en/a/frontend-alpha/',
    })
    expect(classifyAnalyticsPath('/ru/')).toEqual({
      kind: 'public',
      locale: 'ru',
      path: '/ru/',
    })
    expect(classifyAnalyticsPath('/assets/cv.pdf')).toEqual({
      kind: 'other',
      path: '/assets/cv.pdf',
    })
  })

  test('defaults locale for non-localized analytics paths', () => {
    expect(localeFromAnalyticsPath('/assets/cv.pdf')).toBe('en')
  })
})
