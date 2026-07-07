import { describe, expect, test } from 'bun:test'
import { requireField } from './source'

describe('content source helpers', () => {
  test('requires content fields by path', () => {
    expect(requireField('About', 'profile.about')).toBe('About')
    expect(() => requireField(undefined, 'profile.about')).toThrow(
      'Missing required content field: profile.about'
    )
  })
})
