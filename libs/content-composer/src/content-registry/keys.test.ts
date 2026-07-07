import { describe, expect, test } from 'bun:test'
import { normalizeContentKey } from './keys'

describe('content registry keys', () => {
  test('normalizes keys relative to the configured content root', () => {
    expect(
      normalizeContentKey(
        '/workspace/content-repo/content/profiles/default/en/profile.ts',
        { contentRoot: '/workspace/content-repo/content' }
      )
    ).toBe('profiles/default/en/profile.ts')
    expect(normalizeContentKey('#content-source/content.config.ts')).toBe(
      'content.config.ts'
    )
  })

  test('normalizes Vite keys for content roots outside the workspace', () => {
    expect(
      normalizeContentKey('/@fs/workspace/cv-content/content.config.ts', {
        contentRoot: '/workspace/cv-content',
      })
    ).toBe('content.config.ts')
    expect(
      normalizeContentKey('../cv-content/content.config.ts', {
        contentRoot: '/workspace/cv-content',
      })
    ).toBe('content.config.ts')
    expect(
      normalizeContentKey('/../cv-content/content.config.ts', {
        contentRoot: '/workspace/cv-content',
      })
    ).toBe('content.config.ts')
    expect(
      normalizeContentKey(
        '../content-repo/content/profiles/default/en/profile.ts',
        { contentRoot: '/workspace/content-repo/content' }
      )
    ).toBe('profiles/default/en/profile.ts')
  })
})
