import { describe, expect, test } from 'bun:test'
import { Option, Schema } from 'effect'

import {
  type CursorPageInfoSchema,
  cursorPaginationQuerySchema,
  cursorPaginationRequestSchema,
  cursorQueryPageSchema,
  orderBySchema,
  pagePaginationQuerySchema,
} from './index'

describe('pagination schemas', () => {
  test('decodes page and size query-string values', () => {
    expect(
      Schema.decodeUnknownSync(pagePaginationQuerySchema())({
        page: '2',
        size: '50',
      })
    ).toEqual({ page: 2, size: 50 })
  })

  test('supports consumer-selected maximum sizes', () => {
    const schema = cursorPaginationQuerySchema({ maximumSize: 20 })

    expect(
      Option.isNone(Schema.decodeUnknownOption(schema)({ size: '21' }))
    ).toBe(true)
    expect(
      Schema.decodeUnknownSync(schema)({ after: 'cursor', size: '20' })
    ).toEqual({ after: 'cursor', size: 20 })
  })

  test('validates already-decoded pagination independently of transport', () => {
    const schema = cursorPaginationRequestSchema({ maximumSize: 10 })

    expect(Schema.decodeUnknownSync(schema)({ size: 10 })).toEqual({ size: 10 })
    expect(
      Option.isNone(Schema.decodeUnknownOption(schema)({ size: '10' }))
    ).toBe(true)
  })
})

describe('ordering and response schemas', () => {
  test('derives ordering fields from the supplied field schema', () => {
    const schema = orderBySchema(Schema.Literals(['name', 'createdAt']))

    expect(
      Schema.decodeUnknownSync(schema)([
        { field: 'name', direction: 'asc', nulls: 'last' },
      ])
    ).toEqual([{ field: 'name', direction: 'asc', nulls: 'last' }])
    expect(
      Option.isNone(
        Schema.decodeUnknownOption(schema)([{ field: 'unsupported' }])
      )
    ).toBe(true)
  })

  test('composes a consumer item schema with cursor page metadata', () => {
    const schema = cursorQueryPageSchema(Schema.Struct({ id: Schema.String }))
    const value = {
      items: [{ id: 'application-1' }],
      pageInfo: {
        kind: 'cursor',
        size: 1,
        hasNextPage: false,
        hasPreviousPage: false,
        totalItems: 12,
        nextCursor: null,
      },
    } satisfies {
      readonly items: readonly { readonly id: string }[]
      readonly pageInfo: Schema.Schema.Type<typeof CursorPageInfoSchema>
    }

    expect(Schema.decodeUnknownSync(schema)(value)).toEqual(value)
  })
})
