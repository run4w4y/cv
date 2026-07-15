import { describe, expect, test } from 'bun:test'
import type {
  CursorPaginationRequest,
  FilterNode,
  OrderRequest,
  PagePaginationRequest,
  QueryFieldInfo,
} from '@cv/drizzle-query'
import { Option, Schema } from 'effect'

import { effectSchemaAnnotation, schemaBinaryFilterOperator } from '../operator'
import { queryRequestSchema } from './index'

type PageRequest = {
  readonly filters?: readonly FilterNode[]
  readonly orderBy?: readonly OrderRequest<'id' | 'name'>[]
  readonly pagination?: PagePaginationRequest
}

type CursorRequest = Omit<PageRequest, 'pagination'> & {
  readonly pagination?: CursorPaginationRequest
}

const within = schemaBinaryFilterOperator(
  'within',
  Schema.Struct({ minimum: Schema.Number, maximum: Schema.Number }),
  { compile: () => undefined as never }
)

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
    name: 'range',
    origin: 'expression',
    filterOperatorInfo: [
      {
        name: 'within',
        kind: 'binary',
        value: { type: 'unknown' },
        annotations: within.annotations,
      },
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
    options: { defaultSize: 10, maxSize: 25, overflow: 'reject' },
  },
  resolve: (request: PageRequest = {}) => request,
} as const

const cursorDefinition = {
  fields,
  pagination: {
    kind: 'cursor',
    options: { defaultSize: 5, maxSize: 20, overflow: 'reject' },
  },
  resolve: (request: CursorRequest = {}) => request,
} as const

describe('definition-derived request schemas', () => {
  test('decodes binary, unary, custom, and recursive filter nodes', () => {
    const schema = queryRequestSchema(pageDefinition)
    const request = {
      filters: [
        {
          type: 'group',
          combinator: 'and',
          children: [
            {
              type: 'condition',
              field: 'score',
              operator: 'gte',
              value: 70,
            },
            {
              type: 'group',
              combinator: 'not',
              children: [
                {
                  type: 'condition',
                  field: 'note',
                  operator: 'isNull',
                },
              ],
            },
            {
              type: 'condition',
              field: 'range',
              operator: 'within',
              value: { minimum: 20, maximum: 80 },
            },
          ],
        },
      ],
      orderBy: [{ field: 'name', direction: 'desc', nulls: 'last' }],
      pagination: { page: 2, size: 20 },
    } as const satisfies PageRequest

    expect(Schema.decodeUnknownSync(schema)(request)).toEqual(request)
  })

  test('rejects unsupported fields, operators, values, and oversized pages', () => {
    const schema = queryRequestSchema(pageDefinition)
    const invalidRequests = [
      {
        filters: [
          {
            type: 'condition',
            field: 'missing',
            operator: 'eq',
            value: 1,
          },
        ],
      },
      {
        filters: [
          {
            type: 'condition',
            field: 'score',
            operator: 'contains',
            value: 1,
          },
        ],
      },
      {
        filters: [
          {
            type: 'condition',
            field: 'score',
            operator: 'gte',
            value: '70',
          },
        ],
      },
      { orderBy: [{ field: 'score' }] },
      { pagination: { page: 1, size: 26 } },
    ]

    for (const request of invalidRequests) {
      expect(Option.isNone(Schema.decodeUnknownOption(schema)(request))).toBe(
        true
      )
    }
  })

  test('selects cursor pagination from the definition', () => {
    const schema = queryRequestSchema(cursorDefinition)

    expect(
      Schema.decodeUnknownSync(schema)({
        pagination: { after: 'opaque-cursor', size: 20 },
      })
    ).toEqual({ pagination: { after: 'opaque-cursor', size: 20 } })
  })

  test('rejects an invalid Effect Schema operator annotation', () => {
    const invalidDefinition = {
      ...pageDefinition,
      fields: [
        ...fields,
        {
          name: 'invalid',
          origin: 'expression',
          filterOperatorInfo: [
            {
              name: 'custom',
              kind: 'binary',
              value: { type: 'unknown' },
              annotations: new Map([[effectSchemaAnnotation, 'not-a-schema']]),
            },
          ],
          sortable: false,
          unique: false,
          nullable: false,
        },
      ],
    } as const

    expect(() => queryRequestSchema(invalidDefinition)).toThrow(
      'invalid Effect Schema metadata'
    )
  })

  test('allows oversized sizes when the core strategy clamps them', () => {
    const definition = {
      ...pageDefinition,
      pagination: {
        kind: 'page',
        options: { defaultSize: 10, maxSize: 10, overflow: 'clamp' },
      },
    } as const

    expect(
      Schema.decodeUnknownSync(queryRequestSchema(definition))({
        pagination: { size: 100 },
      })
    ).toEqual({ pagination: { size: 100 } })
  })
})
