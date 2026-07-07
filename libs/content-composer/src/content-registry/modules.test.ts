import { describe, expect, test } from 'bun:test'
import { normalizeModules } from './modules'

describe('content registry modules', () => {
  test('rejects modules that normalize to the same content key', () => {
    expect(() =>
      normalizeModules(
        {
          '#content-source/content.config.ts': { default: {} },
          '/repo/content/content.config.ts': { default: {} },
        },
        { contentRoot: '/repo/content' }
      )
    ).toThrow('Duplicate content module key "content.config.ts"')
  })
})
