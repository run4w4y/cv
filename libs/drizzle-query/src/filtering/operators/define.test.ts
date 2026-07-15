import { describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'

import { binaryFilterOperator, unaryFilterOperator } from './define'
import type { BinaryFilterOperatorCompileArguments } from './types'

describe('filter operator factories', () => {
  test('defines a typed binary operator', () => {
    const operator = binaryFilterOperator('minimum', {
      compile: ({
        expression,
        value,
        bind,
      }: BinaryFilterOperatorCompileArguments<number>) =>
        sql`${expression} >= ${bind(value)}`,
    })

    expect(operator).toMatchObject({ kind: 'binary', name: 'minimum' })
  })

  test('defines an expression-only unary operator', () => {
    const operator = unaryFilterOperator('isPresent', {
      compile: ({ expression }) => sql`${expression} is not null`,
    })

    expect(operator).toMatchObject({ kind: 'unary', name: 'isPresent' })
  })
})
