import { describe, expect, test } from 'bun:test'
import type { FilterNode, OrderRequest } from '../index'
import {
  formatFilterExpression,
  formatSortExpression,
  parseFilterExpression,
  parseSortExpression,
} from './index'

const resultValue = <Value>(result: {
  readonly ok: boolean
  readonly value?: Value
}): Value => {
  expect(result.ok).toBe(true)
  if (!result.ok || result.value === undefined) {
    throw new Error('Expected a successful query-language result.')
  }
  return result.value
}

describe('compact filter query language', () => {
  test('parses the registry management query without JSON transport noise', () => {
    const expression =
      'listingAvailability:ne:closed;applicationStatus:notIn:[rejected,withdrawn,archived]'

    expect(resultValue(parseFilterExpression(expression))).toEqual([
      {
        type: 'condition',
        field: 'listingAvailability',
        operator: 'ne',
        value: 'closed',
      },
      {
        type: 'condition',
        field: 'applicationStatus',
        operator: 'notIn',
        value: ['rejected', 'withdrawn', 'archived'],
      },
    ])
  })

  test('preserves nested AND, OR, and NOT groups through formatting', () => {
    const filters = [
      {
        type: 'group',
        combinator: 'and',
        children: [
          {
            type: 'group',
            combinator: 'or',
            children: [
              {
                type: 'condition',
                field: 'status',
                operator: 'eq',
                value: 'applied',
              },
              {
                type: 'condition',
                field: 'status',
                operator: 'eq',
                value: 'screen',
              },
            ],
          },
          {
            type: 'group',
            combinator: 'not',
            children: [
              {
                type: 'condition',
                field: 'followUpAt',
                operator: 'isNull',
              },
            ],
          },
        ],
      },
    ] as const satisfies readonly FilterNode[]

    const formatted = resultValue(formatFilterExpression(filters))

    expect(formatted).toBe(
      '((status:eq:applied|status:eq:screen);!followUpAt:isNull)'
    )
    expect(resultValue(parseFilterExpression(formatted))).toEqual(filters)
  })

  test('round-trips quoted strings, ambiguous strings, arrays, and structs', () => {
    const filters = [
      {
        type: 'condition',
        field: 'message',
        operator: 'eq',
        value: 'R&D / 東京',
      },
      {
        type: 'condition',
        field: 'externalId',
        operator: 'in',
        value: ['true', '123', 'ordinary'],
      },
      {
        type: 'condition',
        field: 'score',
        operator: 'between',
        value: { minimum: 10, maximum: 20 },
      },
    ] as const satisfies readonly FilterNode[]

    const formatted = resultValue(formatFilterExpression(filters))

    expect(formatted).toBe(
      'message:eq:"R&D / 東京";externalId:in:["true","123",ordinary];score:between:{minimum:10,maximum:20}'
    )
    expect(resultValue(parseFilterExpression(formatted))).toEqual(filters)
  })

  test('returns explicit failures for malformed and oversized input', () => {
    expect(parseFilterExpression('status:eq:[applied')).toMatchObject({
      ok: false,
    })
    expect(parseFilterExpression('status:eq:applied trailing')).toMatchObject({
      ok: false,
    })
    expect(parseFilterExpression('x'.repeat(64 * 1024 + 1))).toMatchObject({
      ok: false,
      issues: [{ code: 'expression-too-large' }],
    })
  })
})

describe('compact sort query language', () => {
  test('round-trips multi-column ordering and null placement', () => {
    const orderBy = [
      { field: 'company', direction: 'asc' },
      { field: 'followUpAt', direction: 'desc', nulls: 'last' },
    ] as const satisfies readonly OrderRequest[]

    const formatted = resultValue(formatSortExpression(orderBy))

    expect(formatted).toBe('company:asc,followUpAt:desc:last')
    expect(resultValue(parseSortExpression(formatted))).toEqual(orderBy)
  })

  test('rejects malformed, unsupported, and duplicate terms', () => {
    expect(parseSortExpression('company:sideways')).toMatchObject({
      ok: false,
      issues: [{ code: 'invalid-sort-direction' }],
    })
    expect(parseSortExpression('company:asc:last:extra')).toMatchObject({
      ok: false,
    })
    expect(parseSortExpression('company:asc,company:desc')).toMatchObject({
      ok: false,
      issues: [{ code: 'duplicate-sort-field' }],
    })
  })
})
