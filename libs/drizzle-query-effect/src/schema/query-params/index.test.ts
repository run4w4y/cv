import { describe, expect, test } from 'bun:test'
import type {
  CursorPaginationRequest,
  FilterNode,
  OrderRequest,
  PagePaginationRequest,
  QueryFieldInfo,
} from '@cv/drizzle-query'
import { Effect, Option, Schema } from 'effect'

import { fromSearchParams, queryParamsSchema, toSearchParams } from './index'

type PageRequest = {
  readonly filters?: readonly FilterNode[]
  readonly orderBy?: readonly OrderRequest<'id' | 'name'>[]
  readonly pagination?: PagePaginationRequest
}

type CursorRequest = Omit<PageRequest, 'pagination'> & {
  readonly pagination?: CursorPaginationRequest
}

const fields = [
  {
    name: 'id',
    origin: 'column',
    filterOperatorInfo: [],
    sortable: true,
    unique: true,
    nullable: false,
  },
  {
    name: 'name',
    origin: 'column',
    filterOperatorInfo: [
      { name: 'eq', kind: 'binary', value: { type: 'string' } },
      { name: 'contains', kind: 'binary', value: { type: 'string' } },
    ],
    sortable: true,
    unique: false,
    nullable: false,
  },
  {
    name: 'note',
    origin: 'column',
    filterOperatorInfo: [{ name: 'isNull', kind: 'unary' }],
    sortable: false,
    unique: false,
    nullable: true,
  },
  {
    name: 'score',
    origin: 'column',
    filterOperatorInfo: [
      { name: 'gte', kind: 'binary', value: { type: 'number' } },
    ],
    sortable: false,
    unique: false,
    nullable: false,
  },
  {
    name: 'createdAt',
    origin: 'column',
    filterOperatorInfo: [
      { name: 'gte', kind: 'binary', value: { type: 'date' } },
    ],
    sortable: false,
    unique: false,
    nullable: false,
  },
  {
    name: 'sequence',
    origin: 'column',
    filterOperatorInfo: [
      { name: 'gt', kind: 'binary', value: { type: 'bigint' } },
    ],
    sortable: false,
    unique: false,
    nullable: false,
  },
] as const satisfies readonly QueryFieldInfo[]

const pageDefinition = {
  fields,
  pagination: {
    kind: 'page',
    options: { defaultSize: 10, maxSize: 50, overflow: 'reject' },
  },
  resolve: (request: PageRequest = {}) => request,
} as const

const cursorDefinition = {
  fields,
  pagination: {
    kind: 'cursor',
    options: { defaultSize: 5, maxSize: 25, overflow: 'reject' },
  },
  resolve: (request: CursorRequest = {}) => request,
} as const

describe('definition-derived query parameters', () => {
  test('round-trips page requests, JSON fields, and consumer extras', async () => {
    const schema = queryParamsSchema(pageDefinition, {
      extras: {
        scope: Schema.optional(Schema.NonEmptyString),
      },
    })
    const request = {
      filters: [
        {
          type: 'group',
          combinator: 'or',
          children: [
            {
              type: 'condition',
              field: 'name',
              operator: 'contains',
              value: 'R&D / 東京',
            },
            {
              type: 'condition',
              field: 'note',
              operator: 'isNull',
            },
          ],
        },
      ],
      orderBy: [{ field: 'name', direction: 'asc' }],
      pagination: { page: 3, size: 20 },
      scope: 'active',
    } as const satisfies PageRequest & { readonly scope?: string }

    const params = await Effect.runPromise(toSearchParams(schema, request))

    expect(params.get('page')).toBe('3')
    expect(params.get('size')).toBe('20')
    expect(params.get('scope')).toBe('active')
    expect(JSON.parse(params.get('filters') ?? '')).toEqual(request.filters)
    expect(JSON.parse(params.get('orderBy') ?? '')).toEqual(request.orderBy)
    expect(await Effect.runPromise(fromSearchParams(schema, params))).toEqual(
      request
    )
  })

  test('round-trips cursor pagination from a query string', async () => {
    const schema = queryParamsSchema(cursorDefinition)
    const request = {
      filters: [
        {
          type: 'condition',
          field: 'name',
          operator: 'eq',
          value: 'Ada',
        },
      ],
      pagination: { after: 'opaque-token', size: 10 },
    } as const satisfies CursorRequest
    const params = await Effect.runPromise(toSearchParams(schema, request))
    const decoded = await Effect.runPromise(
      fromSearchParams(schema, `?${params.toString()}`)
    )

    expect(params.get('after')).toBe('opaque-token')
    expect(params.has('page')).toBe(false)
    expect(decoded).toEqual(request)
  })

  test('lets context-free consumers choose a synchronous Effect boundary', () => {
    const schema = queryParamsSchema(cursorDefinition)
    const request = {
      filters: [
        {
          type: 'condition',
          field: 'name',
          operator: 'eq',
          value: 'Ada',
        },
      ],
      pagination: { after: 'opaque-token', size: 10 },
    } as const satisfies CursorRequest

    const params = Effect.runSync(toSearchParams(schema, request))

    expect(Effect.runSync(fromSearchParams(schema, params))).toEqual(request)
    expect(() =>
      Effect.runSync(
        fromSearchParams(
          schema,
          new URLSearchParams([
            ['filters', '[]'],
            ['filters', '[]'],
          ])
        )
      )
    ).toThrow()
  })

  test('uses operand codecs before JSON serialization', async () => {
    const schema = queryParamsSchema(pageDefinition)
    const createdAt = new Date('2026-07-15T08:30:00.000Z')
    const request = {
      filters: [
        {
          type: 'condition',
          field: 'createdAt',
          operator: 'gte',
          value: createdAt,
        },
        {
          type: 'condition',
          field: 'sequence',
          operator: 'gt',
          value: 9_007_199_254_740_993n,
        },
      ],
    } as const satisfies PageRequest

    const params = await Effect.runPromise(toSearchParams(schema, request))
    expect(JSON.parse(params.get('filters') ?? '')).toEqual([
      {
        type: 'condition',
        field: 'createdAt',
        operator: 'gte',
        value: createdAt.toISOString(),
      },
      {
        type: 'condition',
        field: 'sequence',
        operator: 'gt',
        value: '9007199254740993',
      },
    ])
    expect(await Effect.runPromise(fromSearchParams(schema, params))).toEqual(
      request
    )
  })

  test('rejects malformed JSON, invalid values, and duplicate JSON fields', () => {
    const schema = queryParamsSchema(pageDefinition)
    const inputs = [
      'filters=%7Bnot-json',
      `filters=${encodeURIComponent(
        JSON.stringify([
          {
            type: 'condition',
            field: 'score',
            operator: 'gte',
            value: 'high',
          },
        ])
      )}`,
      new URLSearchParams([
        ['filters', '[]'],
        ['filters', '[]'],
      ]),
      'page=0&size=10',
      'page=1&size=51',
    ]

    for (const input of inputs) {
      expect(
        Option.isNone(
          Effect.runSync(Effect.option(fromSearchParams(schema, input)))
        )
      ).toBe(true)
    }
  })

  test('prevents extras from replacing generic query parameters', () => {
    expect(() =>
      queryParamsSchema(pageDefinition, {
        extras: { size: Schema.optional(Schema.String) },
      })
    ).toThrow('reserved')
  })
})
