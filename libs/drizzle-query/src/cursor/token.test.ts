import { describe, expect, test } from 'bun:test'

import { QueryError } from '../error'
import { decodeCursor, encodeCursor } from './token'
import type { CursorCodec, CursorScalar } from './types'

describe('cursor tokens', () => {
  test('round-trips every supported scalar type', () => {
    const occurredAt = new Date('2026-07-14T12:34:56.789Z')
    const values = [
      null,
      'alpha',
      12.5,
      false,
      9007199254740993n,
      occurredAt,
    ] as const satisfies readonly CursorScalar[]
    const token = encodeCursor(values, {
      query: 'records:v1',
    })

    const decoded = decodeCursor(token, {
      query: 'records:v1',
      valueTypes: [
        { type: 'string', nullable: true },
        'string',
        'number',
        'boolean',
        'bigint',
        'date',
      ],
    })

    expect(decoded).toEqual(values)
    expect(decoded[5]).not.toBe(occurredAt)
  })

  test('rejects malformed codec payloads and wraps codec failures', () => {
    const malformedCodec: CursorCodec = {
      encode: () => 'token',
      decode: () => ({
        version: 2,
        query: 'records:v1',
        values: 'not-an-array',
      }),
    }
    const throwingCodec: CursorCodec = {
      encode: () => {
        throw new Error('encode failed')
      },
      decode: () => {
        throw new Error('decode failed')
      },
    }

    expect(() =>
      decodeCursor('token', {
        query: 'records:v1',
        valueTypes: ['number'],
        codec: malformedCodec,
      })
    ).toThrow(QueryError)
    expect(() =>
      encodeCursor([1], {
        query: 'records:v1',
        codec: throwingCodec,
      })
    ).toThrow(QueryError)
    expect(() =>
      decodeCursor('token', {
        query: 'records:v1',
        valueTypes: ['number'],
        codec: throwingCodec,
      })
    ).toThrow(QueryError)
  })
})
