import { describe, expect, test } from 'bun:test'

import {
  changeConditionOperator,
  conditionForField,
  createQueryFilterFields,
  filterNodesFromState,
  normalizeQueryFiltersState,
  resolveQueryFiltersState,
} from './model'

const definition = {
  fields: [
    {
      name: 'status',
      origin: 'column' as const,
      filterOperatorInfo: [
        {
          name: 'eq',
          kind: 'binary' as const,
          value: { type: 'enum' as const, values: ['draft', 'active'] },
        },
        { name: 'isNull', kind: 'unary' as const },
      ],
      sortable: true,
      unique: false,
      nullable: true,
    },
  ],
}

describe('drizzle query filter state', () => {
  test('derives fields and valid initial values from query metadata', () => {
    const field = createQueryFilterFields(definition, {
      status: { label: 'Application status' },
    })[0]
    expect(field?.label).toBe('Application status')
    expect(field && conditionForField(field)).toEqual({
      type: 'condition',
      field: 'status',
      operator: 'eq',
      value: 'draft',
    })
  })

  test('drops the operand when changing to a unary operator', () => {
    const field = createQueryFilterFields(definition)[0]
    const condition = field && conditionForField(field)
    expect(
      field && condition && changeConditionOperator(condition, field, 'isNull')
    ).toEqual({ type: 'condition', field: 'status', operator: 'isNull' })
  })

  test('uses field presentation to select the initial operator', () => {
    const field = createQueryFilterFields(definition, {
      status: { defaultOperator: 'isNull' },
    })[0]

    expect(field && conditionForField(field)).toEqual({
      type: 'condition',
      field: 'status',
      operator: 'isNull',
    })
  })

  test('uses configured options and initial values when creating a filter', () => {
    const optionField = createQueryFilterFields(definition, {
      status: {
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Draft', value: 'draft' },
        ],
      },
    })[0]
    const configuredField = createQueryFilterFields(definition, {
      status: { initialValue: () => 'active' },
    })[0]

    expect(optionField && conditionForField(optionField)).toEqual({
      type: 'condition',
      field: 'status',
      operator: 'eq',
      value: 'active',
    })
    expect(configuredField && conditionForField(configuredField)).toEqual({
      type: 'condition',
      field: 'status',
      operator: 'eq',
      value: 'active',
    })
  })

  test('keeps query capabilities authoritative when presentation is configured', () => {
    const field = createQueryFilterFields(definition, {
      status: { label: 'Application status' },
    })[0]

    expect(field?.filterOperatorInfo.map((operator) => operator.name)).toEqual([
      'eq',
      'isNull',
    ])
  })

  test('maps an or-state to the recursive drizzle-query filter model', () => {
    expect(
      filterNodesFromState({
        combinator: 'or',
        conditions: [
          {
            type: 'condition',
            field: 'status',
            operator: 'eq',
            value: 'active',
          },
        ],
      })
    ).toEqual([
      {
        type: 'group',
        combinator: 'or',
        children: [
          {
            type: 'condition',
            field: 'status',
            operator: 'eq',
            value: 'active',
          },
        ],
      },
    ])
  })

  test('normalizes structural URL state condition-by-condition', () => {
    expect(
      normalizeQueryFiltersState({
        combinator: 'invalid',
        conditions: [
          {
            type: 'condition',
            field: 'status',
            operator: 'eq',
            value: 'active',
          },
          { type: 'group', combinator: 'and', children: [] },
          null,
        ],
      })
    ).toEqual({
      combinator: 'and',
      conditions: [
        {
          type: 'condition',
          field: 'status',
          operator: 'eq',
          value: 'active',
        },
      ],
    })
  })

  test('separates incomplete and invalid conditions from API-safe state', () => {
    const timestampDefinition = {
      fields: [
        ...definition.fields,
        {
          name: 'updatedAt',
          origin: 'column' as const,
          filterOperatorInfo: [
            {
              name: 'gte',
              kind: 'binary' as const,
              value: { type: 'date' as const },
            },
          ],
          sortable: true,
          unique: false,
          nullable: false,
        },
      ],
    }
    const state = {
      combinator: 'and' as const,
      conditions: [
        {
          type: 'condition' as const,
          field: 'status',
          operator: 'eq',
          value: 'active',
        },
        {
          type: 'condition' as const,
          field: 'updatedAt',
          operator: 'gte',
          value: '2026-07-16T12:52:00+03:00',
        },
        {
          type: 'condition' as const,
          field: 'status',
          operator: 'eq',
          value: 'preparing',
        },
        {
          type: 'condition' as const,
          field: 'missing',
          operator: 'eq',
          value: 'anything',
        },
      ],
    }

    const resolved = resolveQueryFiltersState(state, timestampDefinition)

    expect(resolved.validState).toEqual({
      combinator: 'and',
      conditions: [state.conditions[0]],
    })
    expect(resolved.issues.map(({ code }) => code)).toEqual([
      'invalidValue',
      'invalidValue',
      'unknownField',
    ])
    expect(resolved.hasInvalidConditions).toBe(true)
    expect(filterNodesFromState(state, timestampDefinition)).toEqual(
      resolved.validConditions
    )
  })

  test('does not emit an incomplete initial operand to drizzle-query', () => {
    const state = {
      combinator: 'and' as const,
      conditions: [
        {
          type: 'condition' as const,
          field: 'status',
          operator: 'eq',
          value: '',
        },
      ],
    }

    const resolved = resolveQueryFiltersState(state, definition)
    expect(resolved.issues[0]?.code).toBe('required')
    expect(filterNodesFromState(state, definition)).toEqual([])
  })
})
