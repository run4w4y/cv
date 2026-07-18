import { describe, expect, test } from 'bun:test'

import { matchPublicCvRoute } from './public-route'

describe('public CV route', () => {
  test('accepts exactly one token segment under /c', () => {
    expect(matchPublicCvRoute('/c/stable-token')).toBe('stable-token')
    expect(matchPublicCvRoute('/c/token.with_symbols~')).toBe(
      'token.with_symbols~'
    )
  })

  test('rejects legacy and non-exact paths', () => {
    expect(matchPublicCvRoute('/')).toBeNull()
    expect(matchPublicCvRoute('/en')).toBeNull()
    expect(matchPublicCvRoute('/c')).toBeNull()
    expect(matchPublicCvRoute('/c/token/')).toBeNull()
    expect(matchPublicCvRoute('/c/token/extra')).toBeNull()
    expect(matchPublicCvRoute('/c/bad%2Ftoken')).toBeNull()
  })
})
