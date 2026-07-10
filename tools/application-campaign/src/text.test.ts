import { describe, expect, test } from 'bun:test'
import { slugify } from './text'

describe('application campaign text helpers', () => {
  test('slugifies noisy values', () => {
    expect(slugify('Acme / Senior Backend Engineer')).toBe(
      'acme-senior-backend-engineer'
    )
  })
})
