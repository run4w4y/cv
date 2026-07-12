import { describe, expect, test } from 'bun:test'

import { normalizeCompany } from './shared'

describe('CRUD persistence helpers', () => {
  test('normalizes company names used by registry lookups', () => {
    expect(normalizeCompany('  Example Labs  ')).toBe('example labs')
  })
})
