import { describe, expect, test } from 'bun:test'

import {
  decodeQueryParameterState,
  writeQueryParameterState,
} from './search-params'

type Request = { readonly q?: string }

const boundary = {
  ownedKeys: new Set(['q']),
  decode: (input: URLSearchParams | string): Request => {
    const params =
      typeof input === 'string' ? new URLSearchParams(input) : input
    const values = params.getAll('q')
    if (values.length > 1) throw new Error('duplicate query')
    if (values[0] === 'invalid') throw new Error('invalid query')
    return values[0] === undefined ? {} : { q: values[0] }
  },
  encode: (request: Request) =>
    request.q === undefined
      ? new URLSearchParams()
      : new URLSearchParams({ q: request.q }),
} as const

describe('query search-parameter boundary', () => {
  test('decodes valid state and preserves invalid raw state', () => {
    expect(
      decodeQueryParameterState(boundary, new URLSearchParams('legacy=ignored'))
    ).toEqual({ status: 'valid', value: {} })
    expect(
      decodeQueryParameterState(boundary, new URLSearchParams('q=invalid'))
    ).toMatchObject({
      status: 'invalid',
      raw: 'q=invalid',
      issues: ['invalid query'],
    })
  })

  test('writes owned state while preserving unrelated parameters', () => {
    expect(
      writeQueryParameterState(
        boundary,
        new URLSearchParams('q=old&currency=JPY'),
        { q: 'new' }
      ).toString()
    ).toBe('currency=JPY&q=new')
  })
})
