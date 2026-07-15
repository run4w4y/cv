import { describe, expect, test } from 'bun:test'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { QueryError } from '../error'
import { createColumnCatalog } from '../fields/index'
import { resolveOrdering } from './resolve'
import type { OrderRequest } from './types'

const records = sqliteTable('ordering_hardening_records', {
  id: integer('id').primaryKey(),
  category: text('category').notNull(),
  nullableCode: text('nullable_code').unique(),
})

const col = createColumnCatalog(records)
const sortableFields = Object.freeze([
  col.id.sortable().runtime,
  col.category.sortable().runtime,
  col.nullableCode.sortable().runtime,
])
const fieldsWithoutUniqueNonNull = Object.freeze([
  col.category.sortable().runtime,
  col.nullableCode.sortable().runtime,
])

const scopedRecords = sqliteTable('ordering_scoped_records', {
  tenantId: text('tenant_id').notNull(),
  sequence: integer('sequence').notNull(),
  label: text('label').notNull(),
  nullableCode: text('nullable_code'),
})
const scopedCol = createColumnCatalog(scopedRecords)
const scopedFields = Object.freeze([
  scopedCol.tenantId.sortable().runtime,
  scopedCol.sequence.sortable().runtime,
  scopedCol.label.sortable().runtime,
  scopedCol.nullableCode.sortable().runtime,
])

const expectQueryError = (
  evaluate: () => unknown,
  expected: { readonly code: QueryError['code']; readonly path: string }
): void => {
  try {
    evaluate()
    throw new Error('Expected a QueryError.')
  } catch (error) {
    expect(error).toBeInstanceOf(QueryError)
    expect((error as QueryError).code).toBe(expected.code)
    expect((error as QueryError).path).toBe(expected.path)
  }
}

describe('deterministic ordering resolution', () => {
  test('appends a unique non-null tie-breaker', () => {
    const resolved = resolveOrdering(
      sortableFields,
      [{ field: 'category', direction: 'desc' }],
      {}
    )

    expect(resolved.terms).toMatchObject([
      {
        field: 'category',
        direction: 'desc',
        source: 'request',
        unique: false,
        nullable: false,
      },
      {
        field: 'id',
        direction: 'asc',
        source: 'tie-breaker',
        unique: true,
        nullable: false,
      },
    ])
  })

  test('falls back to a unique non-null field', () => {
    const resolved = resolveOrdering(sortableFields, undefined, {})

    expect(resolved.terms).toMatchObject([
      {
        field: 'id',
        source: 'fallback',
        unique: true,
        nullable: false,
      },
    ])
  })

  test('rejects a request without an available tie-breaker', () => {
    expectQueryError(
      () =>
        resolveOrdering(
          fieldsWithoutUniqueNonNull,
          [{ field: 'category' }],
          {}
        ),
      { code: 'invalid-ordering', path: 'orderBy' }
    )
  })

  test('adds the same deterministic tie-breaker to default ordering', () => {
    const resolved = resolveOrdering(sortableFields, undefined, {
      defaults: [{ field: 'category' }],
    })

    expect(resolved.terms).toMatchObject([
      { field: 'category', source: 'default' },
      {
        field: 'id',
        source: 'tie-breaker',
        unique: true,
        nullable: false,
      },
    ])
  })

  test('chooses the shortest fallback regardless of candidate order', () => {
    const resolved = resolveOrdering(sortableFields, undefined, {
      uniqueBy: [['category', 'id']],
    })

    expect(resolved.terms).toMatchObject([{ field: 'id', source: 'fallback' }])
  })

  test('appends the shortest available tie-breaker', () => {
    const resolved = resolveOrdering(
      sortableFields,
      [{ field: 'nullableCode' }],
      { uniqueBy: [['category', 'id']] }
    )

    expect(resolved.terms).toMatchObject([
      { field: 'nullableCode', source: 'request' },
      { field: 'id', source: 'tie-breaker' },
    ])
  })

  test('does not treat a nullable unique term as deterministic', () => {
    const resolved = resolveOrdering(
      sortableFields,
      [{ field: 'nullableCode' }],
      {}
    )

    expect(resolved.terms).toMatchObject([
      { field: 'nullableCode', unique: true, nullable: true },
      { field: 'id', source: 'tie-breaker' },
    ])
  })

  test('accepts a unique non-null term anywhere in the tuple', () => {
    const orderBy = [
      { field: 'id', direction: 'desc' },
      { field: 'category' },
    ] as const satisfies readonly OrderRequest<'id' | 'category'>[]
    const resolved = resolveOrdering(sortableFields, orderBy, {})

    expect(resolved.terms.map((term) => term.field)).toEqual(['id', 'category'])
    expect(resolved.terms.every((term) => term.source === 'request')).toBe(true)
  })

  test('normalizes null placement for a non-nullable ordering', () => {
    const first = resolveOrdering(
      sortableFields,
      [{ field: 'id', nulls: 'first' }],
      {}
    )
    const last = resolveOrdering(
      sortableFields,
      [{ field: 'id', nulls: 'last' }],
      {}
    )

    expect(first.terms[0]?.nulls).toBe('last')
    expect(first.terms).toEqual(last.terms)
  })
})

describe('composite deterministic ordering resolution', () => {
  const uniqueBy = [['tenantId', 'sequence']] as const

  test('uses a composite fallback', () => {
    const resolved = resolveOrdering(scopedFields, undefined, { uniqueBy })

    expect(resolved.terms).toMatchObject([
      { field: 'tenantId', source: 'fallback', unique: false },
      { field: 'sequence', source: 'fallback', unique: false },
    ])
  })

  test('appends missing composite members', () => {
    const resolved = resolveOrdering(
      scopedFields,
      [{ field: 'label' }, { field: 'tenantId' }],
      { uniqueBy }
    )

    expect(resolved.terms).toMatchObject([
      { field: 'label', source: 'request' },
      { field: 'tenantId', source: 'request' },
      { field: 'sequence', source: 'tie-breaker' },
    ])
  })

  test('accepts an ordering containing every composite member', () => {
    const resolved = resolveOrdering(
      scopedFields,
      [{ field: 'sequence' }, { field: 'tenantId' }, { field: 'label' }],
      { uniqueBy }
    )

    expect(resolved.terms.map((term) => term.field)).toEqual([
      'sequence',
      'tenantId',
      'label',
    ])
    expect(resolved.terms.every((term) => term.source === 'request')).toBe(true)
  })
})

describe('unique ordering tuple validation', () => {
  test('rejects empty candidates', () => {
    expectQueryError(
      () => resolveOrdering(scopedFields, undefined, { uniqueBy: [[]] }),
      { code: 'invalid-definition', path: 'uniqueBy[0]' }
    )
  })

  test('rejects duplicate fields', () => {
    expectQueryError(
      () =>
        resolveOrdering(scopedFields, undefined, {
          uniqueBy: [['tenantId', 'tenantId']],
        }),
      { code: 'invalid-definition', path: 'uniqueBy[0][1]' }
    )
  })

  test('rejects unknown and nullable fields', () => {
    expectQueryError(
      () =>
        resolveOrdering(scopedFields, undefined, {
          uniqueBy: [['missing']],
        }),
      { code: 'invalid-definition', path: 'uniqueBy[0][0]' }
    )
    expectQueryError(
      () =>
        resolveOrdering(scopedFields, undefined, {
          uniqueBy: [['nullableCode']],
        }),
      { code: 'invalid-definition', path: 'uniqueBy[0][0]' }
    )
  })
})

describe('default ordering diagnostics', () => {
  test('points invalid default fields at defaultOrderBy', () => {
    expectQueryError(
      () =>
        resolveOrdering(sortableFields, undefined, {
          defaults: [{ field: 'missing' }],
        }),
      { code: 'invalid-definition', path: 'defaultOrderBy[0].field' }
    )
  })

  test('points a default without a tie-breaker at defaultOrderBy', () => {
    expectQueryError(
      () =>
        resolveOrdering(fieldsWithoutUniqueNonNull, undefined, {
          defaults: [{ field: 'category' }],
        }),
      { code: 'invalid-definition', path: 'defaultOrderBy' }
    )
  })
})
