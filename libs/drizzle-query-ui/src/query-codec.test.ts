import { describe, expect, test } from 'bun:test'

import type { QueryFiltersState } from './model'
import {
  areQueryFiltersStatesEqual,
  decodeQueryFiltersUrlState,
  normalizeQueryFilterNodes,
  parseCanonicalQueryFiltersState,
  parseQueryFilterNodes,
  serializeCanonicalQueryFiltersState,
} from './query-codec'
import { applicationQueryDefinition } from './stories/application-query-fixture'

describe('query filters URL codec', () => {
  test('round-trips the API FilterNode array and preserves OR semantics', () => {
    const state: QueryFiltersState = {
      combinator: 'or',
      conditions: [
        {
          type: 'condition',
          field: 'applicationStatus',
          operator: 'eq',
          value: 'applied',
        },
        {
          type: 'condition',
          field: 'fitScore',
          operator: 'gte',
          value: 80,
        },
      ],
    }

    const encoded = serializeCanonicalQueryFiltersState(state)
    expect(JSON.parse(encoded ?? '[]')).toEqual([
      {
        type: 'group',
        combinator: 'or',
        children: state.conditions,
      },
    ])
    expect(parseCanonicalQueryFiltersState(encoded)).toEqual(state)
    expect(areQueryFiltersStatesEqual(state, { ...state })).toBe(true)
  })

  test('rejects state-shaped JSON instead of interpreting another format', () => {
    const nonCanonicalState = JSON.stringify({
      combinator: 'or',
      conditions: [
        {
          type: 'condition',
          field: 'applicationStatus',
          operator: 'eq',
          value: 'applied',
        },
      ],
    })
    const decoded = decodeQueryFiltersUrlState(
      new URLSearchParams({ filters: nonCanonicalState }),
      applicationQueryDefinition
    )
    expect(decoded.source).toBe('invalid')
    expect(decoded.blocksRequest).toBe(true)
    expect(decoded.needsCanonicalWrite).toBe(false)
  })

  test('validates canonical filters independently of editor visibility', () => {
    const decoded = decodeQueryFiltersUrlState(
      new URLSearchParams({
        filters: JSON.stringify([
          {
            type: 'condition',
            field: 'q',
            operator: 'matches',
            value: 'platform',
          },
        ]),
      }),
      applicationQueryDefinition,
      { q: { hidden: true } }
    )

    expect(decoded.blocksRequest).toBe(false)
    expect(decoded.hasUnsupportedEditorConditions).toBe(true)
    expect(decoded.appliedFilters).toEqual([
      {
        type: 'condition',
        field: 'q',
        operator: 'matches',
        value: 'platform',
      },
    ])
  })

  test('treats presentation options as suggestions rather than validation', () => {
    const decoded = decodeQueryFiltersUrlState(
      new URLSearchParams({
        filters: JSON.stringify([
          {
            type: 'condition',
            field: 'company',
            operator: 'eq',
            value: 'A company not present in facets',
          },
        ]),
      }),
      applicationQueryDefinition,
      {
        company: {
          options: [{ label: 'Acme', value: 'Acme' }],
        },
      }
    )

    expect(decoded.blocksRequest).toBe(false)
    expect(decoded.appliedFilters).toEqual([
      {
        type: 'condition',
        field: 'company',
        operator: 'eq',
        value: 'A company not present in facets',
      },
    ])
  })

  test('blocks malformed, duplicate, and definition-invalid canonical input', () => {
    const malformed = decodeQueryFiltersUrlState(
      new URLSearchParams({ filters: 'not-json' }),
      applicationQueryDefinition
    )
    expect(malformed.blocksRequest).toBe(true)
    expect(malformed.needsCanonicalWrite).toBe(false)

    const duplicateParams = new URLSearchParams()
    duplicateParams.append('filters', '[]')
    duplicateParams.append('filters', '[]')
    const duplicate = decodeQueryFiltersUrlState(
      duplicateParams,
      applicationQueryDefinition
    )
    expect(duplicate.blocksRequest).toBe(true)
    expect(duplicate.needsCanonicalWrite).toBe(false)

    const invalid = decodeQueryFiltersUrlState(
      new URLSearchParams({
        filters: JSON.stringify([
          {
            type: 'condition',
            field: 'applicationStatus',
            operator: 'eq',
            value: 'not-a-status',
          },
        ]),
      }),
      applicationQueryDefinition
    )
    expect(invalid.blocksRequest).toBe(true)
    expect(invalid.editorState.conditions).toHaveLength(1)
  })

  test('rejects canonical payloads larger than the decoding limit', () => {
    const oversized = JSON.stringify([
      {
        type: 'condition',
        field: 'q',
        operator: 'matches',
        value: 'x'.repeat(64 * 1024),
      },
    ])

    expect(oversized.length).toBeGreaterThan(64 * 1024)
    expect(parseQueryFilterNodes(oversized)).toBeUndefined()

    const decoded = decodeQueryFiltersUrlState(
      new URLSearchParams({ filters: oversized }),
      applicationQueryDefinition
    )
    expect(decoded.source).toBe('invalid')
    expect(decoded.blocksRequest).toBe(true)
  })

  test('rejects saved-view filters deeper than the structural limit', () => {
    let nested: unknown = {
      type: 'condition',
      field: 'applicationStatus',
      operator: 'eq',
      value: 'applied',
    }
    for (let depth = 0; depth < 16; depth += 1) {
      nested = {
        type: 'group',
        combinator: 'not',
        children: [nested],
      }
    }

    expect(normalizeQueryFilterNodes([nested])).toBeUndefined()
  })

  test('rejects saved-view filters containing too many nodes', () => {
    const filters = Array.from({ length: 101 }, () => ({
      type: 'condition',
      field: 'applicationStatus',
      operator: 'eq',
      value: 'applied',
    }))

    expect(normalizeQueryFilterNodes(filters)).toBeUndefined()
  })

  test('validates nested groups before forwarding and flags editor parity', () => {
    const nested = JSON.stringify([
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
                field: 'applicationStatus',
                operator: 'eq',
                value: 'applied',
              },
              {
                type: 'condition',
                field: 'fitScore',
                operator: 'gte',
                value: 80,
              },
            ],
          },
        ],
      },
    ])
    const decoded = decodeQueryFiltersUrlState(
      new URLSearchParams({ filters: nested }),
      applicationQueryDefinition
    )
    expect(decoded.blocksRequest).toBe(false)
    expect(decoded.hasUnsupportedStructure).toBe(true)
    expect(decoded.appliedFilters).toEqual(JSON.parse(nested))

    const invalidNested = decodeQueryFiltersUrlState(
      new URLSearchParams({
        filters: nested.replace('"applied"', '"not-a-status"'),
      }),
      applicationQueryDefinition
    )
    expect(invalidNested.blocksRequest).toBe(true)
  })
})
