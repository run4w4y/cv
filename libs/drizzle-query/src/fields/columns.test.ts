import { describe, expect, test } from 'bun:test'
import {
  cidr,
  inet,
  integer,
  interval,
  jsonb,
  macaddr,
  pgTable,
  text,
  uuid,
} from 'drizzle-orm/pg-core'
import type { OperatorRequests } from '../filtering/operators/types'
import { pagePagination } from '../pagination/page'
import { defineQuery } from '../query/define'
import { createColumnCatalog } from './columns'
import type { FieldOperatorsOf } from './runtime'

const records = pgTable('column_capability_records', {
  id: uuid('id').primaryKey(),
  address: inet('address').notNull(),
  network: cidr('network').notNull(),
  hardwareAddress: macaddr('hardware_address').notNull(),
  duration: interval('duration').notNull(),
  name: text('name').notNull(),
  label: text('label').notNull(),
  score: integer('score').notNull(),
  status: text('status', { enum: ['draft', 'active', 'archived'] }).notNull(),
  note: text('note'),
  payload: jsonb('payload').$type<{ readonly kind: string }>().notNull(),
})

const columns = createColumnCatalog(records)
const filterableId = columns.id.filterable()
const filterableScore = columns.score.filterable()
const filterableStatus = columns.status.filterable()
const filterableNote = columns.note.filterable()
const query = defineQuery(
  records,
  ({ col }) => [
    col.id.sortable({ unique: true }),
    col.score.filterable(),
    col.status.filterable(),
    col.note.filterable(),
    col.payload,
  ],
  { pagination: pagePagination() }
)

const typeContracts = (): void => {
  type UuidOperator = FieldOperatorsOf<typeof filterableId>[number]['name']
  const equality: UuidOperator = 'eq'
  // @ts-expect-error Specialized strings do not infer LIKE operators.
  const pattern: UuidOperator = 'contains'
  void equality
  void pattern

  const compileScore = (
    request: OperatorRequests<FieldOperatorsOf<typeof filterableScore>>
  ): void => {
    void request
  }
  const compileStatus = (
    request: OperatorRequests<FieldOperatorsOf<typeof filterableStatus>>
  ): void => {
    void request
  }
  const compileNote = (
    request: OperatorRequests<FieldOperatorsOf<typeof filterableNote>>
  ): void => {
    void request
  }

  // @ts-expect-error numeric fields do not expose text operators
  compileScore({ operator: 'contains', value: 2 })
  // @ts-expect-error numeric comparison operators require numbers
  compileScore({ operator: 'gte', value: '20' })
  // @ts-expect-error enum values are inferred from the Drizzle column
  compileStatus({ operator: 'eq', value: 'pending' })
  // @ts-expect-error a unary nullable operator must not receive a value
  compileNote({ operator: 'isNull', value: null })
  // @ts-expect-error JSON has no safe inferred scalar operators
  columns.payload.filterable()

  query.resolve({
    filters: [
      {
        type: 'condition',
        field: 'score',
        // @ts-expect-error numeric fields do not expose text operators
        operator: 'contains',
        value: 2,
      },
    ],
  })
  query.resolve({
    filters: [
      {
        type: 'condition',
        field: 'status',
        operator: 'eq',
        // @ts-expect-error enum values are inferred through the public query request
        value: 'pending',
      },
    ],
  })
  query.resolve({
    filters: [
      {
        type: 'condition',
        // @ts-expect-error non-filterable columns are absent from public requests
        field: 'payload',
        operator: 'eq',
        value: 'lead',
      },
    ],
  })
}

void typeContracts

describe('column capability inference', () => {
  test('uses equality/list filters for constrained string columns', () => {
    for (const field of [
      columns.id.filterable().sortable(),
      columns.address.filterable().sortable(),
      columns.network.filterable().sortable(),
      columns.hardwareAddress.filterable().sortable(),
      columns.duration.filterable().sortable(),
    ]) {
      expect(field.runtime.operators?.map((operator) => operator.name)).toEqual(
        ['eq', 'ne', 'in', 'notIn']
      )
      expect(field.runtime.sort?.enabled).toBe(true)
    }
  })

  test('retains pattern filters for unconstrained text', () => {
    expect(
      columns.label
        .filterable()
        .runtime.operators?.map((operator) => operator.name)
    ).toEqual([
      'eq',
      'ne',
      'in',
      'notIn',
      'contains',
      'notContains',
      'startsWith',
      'endsWith',
    ])
  })

  test('infers numeric, enum, nullable, and opaque column capabilities', () => {
    expect(
      filterableScore.runtime.operators?.map((operator) => operator.name)
    ).toEqual([
      'eq',
      'ne',
      'in',
      'notIn',
      'gt',
      'gte',
      'lt',
      'lte',
      'between',
      'notBetween',
    ])
    expect(
      filterableStatus.runtime.operators?.map((operator) => operator.name)
    ).toEqual(['eq', 'ne', 'in', 'notIn'])
    expect(
      filterableNote.runtime.operators?.map((operator) => operator.name)
    ).toEqual([
      'eq',
      'ne',
      'in',
      'notIn',
      'contains',
      'notContains',
      'startsWith',
      'endsWith',
      'isNull',
      'isNotNull',
    ])
    expect(columns.payload.runtime.operators).toBeUndefined()
    expect(columns.payload.runtime.sort).toBeUndefined()
  })

  test('preserves inferred primary-key uniqueness when sorting is enabled', () => {
    expect(columns.id.sortable().runtime.sort).toMatchObject({
      enabled: true,
      unique: true,
      nullable: false,
    })
  })

  test('creates a null-prototype catalog without prototype-key collisions', () => {
    expect(Object.getPrototypeOf(columns)).toBeNull()
    expect(Object.hasOwn(columns, '__proto__')).toBe(false)
    expect(columns.name.runtime.name).toBe('name')
  })

  test('enables suitable defaults without reserving a column name', () => {
    const defaults = columns({ exclude: ['id', 'status'] })
    expect(defaults.some(({ runtime }) => runtime.name === 'score')).toBe(true)
    expect(defaults.some(({ runtime }) => runtime.name === 'payload')).toBe(
      false
    )
    expect(defaults.some(({ runtime }) => runtime.name === 'id')).toBe(false)
  })
})
