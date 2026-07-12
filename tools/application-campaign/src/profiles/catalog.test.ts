import { describe, expect, test } from 'bun:test'
import { profileSlugsForLocale, profileSlugsWithContent } from './catalog'

const catalog = {
  availableProfiles: {
    en: ['go-backend'],
    ru: ['typescript-full-stack'],
  },
  defaultLocale: 'ru',
  defaultProfile: 'default',
  locales: ['en', 'ru'],
  profiles: ['default', 'go-backend', 'typescript-full-stack', 'missing'],
}

describe('profile discovery', () => {
  test('discovers profiles with content in any locale', () => {
    expect(profileSlugsWithContent(catalog)).toEqual([
      'go-backend',
      'typescript-full-stack',
    ])
  })

  test('preserves source ordering while selecting a locale', () => {
    expect(profileSlugsForLocale(catalog, 'en')).toEqual(['go-backend'])
    expect(profileSlugsForLocale(catalog, 'ru')).toEqual([
      'typescript-full-stack',
    ])
  })

  test('uses the repository default locale when none is supplied', () => {
    expect(profileSlugsForLocale(catalog)).toEqual(['typescript-full-stack'])
  })
})
