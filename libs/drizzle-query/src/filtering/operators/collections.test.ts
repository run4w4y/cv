import { describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'

import {
  appendOperators,
  pickOperators,
  replaceOperator,
  withoutOperators,
} from './collections'
import { textOperators } from './defaults/text'
import { binaryFilterOperator } from './define'
import type {
  BinaryFilterOperatorCompileArguments,
  OperatorRequests,
} from './types'

const caseInsensitiveEq = binaryFilterOperator('eq', {
  compile: ({
    expression,
    value,
    bind,
  }: BinaryFilterOperatorCompileArguments<string>) =>
    sql`lower(${expression}) = lower(${bind(value)})`,
})

const longerThan = binaryFilterOperator('longerThan', {
  compile: ({
    expression,
    value,
    bind,
  }: BinaryFilterOperatorCompileArguments<number>) =>
    sql`length(${expression}) > ${bind(value)}`,
})

const customized = appendOperators(
  replaceOperator(
    withoutOperators(textOperators(), ['notContains', 'endsWith']),
    caseInsensitiveEq
  ),
  [longerThan]
)

describe('operator arrays', () => {
  test('removes, replaces, and appends while preserving source order', () => {
    expect(customized.map((operator) => operator.name)).toEqual([
      'eq',
      'ne',
      'in',
      'notIn',
      'contains',
      'startsWith',
      'longerThan',
    ])
    expect(customized[0]).toBe(caseInsensitiveEq)
  })

  test('picks requested operators in source order', () => {
    const picked = pickOperators(textOperators(), ['endsWith', 'eq'])
    expect(picked.map((operator) => operator.name)).toEqual(['eq', 'endsWith'])
  })

  test('lets later declarations override existing operator names', () => {
    const overridden = appendOperators(textOperators(), [caseInsensitiveEq])

    expect(overridden.filter((operator) => operator.name === 'eq')).toEqual([
      caseInsensitiveEq,
    ])
  })
})

const staticTypeContracts = (): void => {
  const compile = (request: OperatorRequests<typeof customized>): void => {
    void request
  }
  compile({ operator: 'eq', value: 'ALPHA' })
  compile({ operator: 'longerThan', value: 10 })
  // @ts-expect-error removed operators are absent from the authoritative array
  compile({ operator: 'notContains', value: 'alpha' })
  // @ts-expect-error appended binary operators retain their RHS type
  compile({ operator: 'longerThan', value: '10' })
}

void staticTypeContracts
