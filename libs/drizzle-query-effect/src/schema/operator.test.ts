import { describe, expect, test } from 'bun:test'
import type {
  BinaryFilterOperatorCompileArguments,
  OperatorContext,
} from '@cv/drizzle-query'
import { Schema } from 'effect'

import { effectSchemaAnnotation, schemaBinaryFilterOperator } from './operator'

describe('schema binary filter operators', () => {
  test('retains the schema while inferring the compiled value type', () => {
    const valueSchema = Schema.Struct({
      minimum: Schema.Number,
      maximum: Schema.Number,
    })
    const operator = schemaBinaryFilterOperator('inside', valueSchema, {
      compile: ({ value }) => {
        const minimum: number = value.minimum
        const maximum: number = value.maximum
        void minimum
        void maximum
        return undefined as never
      },
    })

    expect(operator.name).toBe('inside')
    expect(operator.kind).toBe('binary')
    expect(operator.annotations?.get(effectSchemaAnnotation)).toBe(valueSchema)
  })

  test('preserves annotations owned by other integrations', () => {
    const externalAnnotation = Symbol('external')
    const operator = schemaBinaryFilterOperator('inside', Schema.String, {
      annotations: new Map([[externalAnnotation, 'external-value']]),
      compile: () => undefined as never,
    })

    expect(operator.annotations?.get(externalAnnotation)).toBe('external-value')
    expect(
      Schema.isSchema(operator.annotations?.get(effectSchemaAnnotation))
    ).toBe(true)
  })

  test('preserves a custom operator compile context', () => {
    const operator = schemaBinaryFilterOperator('visibleAt', Schema.String, {
      compile: ({
        context,
      }: BinaryFilterOperatorCompileArguments<
        string,
        { readonly asOf: string }
      >) => {
        const asOf: string = context.asOf
        void asOf
        return undefined as never
      },
    })
    const typeContracts = (): void => {
      const context: OperatorContext<typeof operator> = {
        asOf: '2026-07-15T08:30:00.000Z',
      }
      void context
    }
    void typeContracts

    expect(operator.name).toBe('visibleAt')
  })
})
