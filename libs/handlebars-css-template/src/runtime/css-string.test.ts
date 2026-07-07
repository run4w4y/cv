import { describe, expect, test } from 'bun:test'

import { cssString, escapeCssString } from './css-string'

describe('CSS string escaping', () => {
  test('escapes values as wrapped CSS string literals', () => {
    expect(escapeCssString('A"B\nΩ')).toBe('"\\41\\"\\42\\A\\3A9"')
  })

  test('normalizes nullish values to an empty CSS string', () => {
    expect(escapeCssString(null)).toBe('""')
    expect(escapeCssString(undefined)).toBe('""')
  })

  test('returns a Handlebars safe string helper value', () => {
    const value = cssString('source')

    expect(value.toString()).toBe('"\\73\\6F\\75\\72\\63\\65"')
    expect(value.toHTML()).toBe('"\\73\\6F\\75\\72\\63\\65"')
  })
})
