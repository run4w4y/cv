import { type SQL, sql } from 'drizzle-orm'

import type { CursorScalar } from '../cursor/index'
import type {
  AnyFilterOperator,
  DefaultOperatorKind,
  DefaultOperators,
} from '../filtering/operators/index'
import { normalizeOperators } from '../filtering/operators/index'
import type {
  CustomExpressionCursor,
  CustomExpressionCursorShape,
  CustomExpressionOptions,
  ExpressionHelpers,
  ExpressionOptions,
  ExpressionQueryField,
  VirtualQueryField,
} from './expression-types'
import { QueryField } from './query-field'
import { validateFieldName } from './query-field/runtime'
import type { SortMode } from './runtime'
import { cursorTypeFor, defaultsForKind, filterValueFor } from './scalar-kind'

export type {
  CursorTypeFor,
  CustomExpressionCursor,
  CustomExpressionOptions,
  ExpressionHelpers,
  ExpressionOptions,
  VirtualQueryField,
} from './expression-types'

/** @internal Creates one expression-backed query-field builder. */
export const makeExpressionField = <
  Value,
  Kind extends DefaultOperatorKind,
  Nullable extends boolean,
  Mode extends SortMode,
>(
  expression: SQL<Value>,
  kind: Kind,
  options: ExpressionOptions<Nullable, Value>,
  mode: Mode,
  enumValues?: readonly string[],
  cursor?: CustomExpressionCursorShape
): ExpressionQueryField<Value, Nullable, Kind, Mode> => {
  const nullable = options.nullable ?? false
  const defaults = defaultsForKind(
    kind,
    nullable,
    enumValues,
    false
  ) as DefaultOperators<Kind, Value, Nullable>
  const cursorType = cursor?.type ?? cursorTypeFor(kind)

  return new QueryField({
    runtime: {
      name: undefined,
      origin: 'expression',
      nullable,
      expression,
      filterValue:
        options.filterValue ?? filterValueFor(kind, enumValues, false),
      bind: (value: unknown) =>
        options.bind?.(value as Value) ?? sql.param(value),
      operators: undefined,
      operatorMap: undefined,
      sort:
        mode === 'none'
          ? undefined
          : {
              enabled: false,
              expression,
              cursorType: { type: cursorType, nullable },
              unique: false,
              nullable,
              defaultNulls: 'last' as const,
              selection: (alias: string) => expression.as(alias),
              ...((cursor?.encode ?? options.bind) === undefined
                ? {}
                : {
                    encode: (cursor?.encode ?? options.bind) as (
                      value: Exclude<CursorScalar, null>
                    ) => unknown,
                  }),
            },
      selection: (alias: string) => expression.as(alias),
    },
    defaults,
    tools: undefined,
    sortMode: mode,
  })
}

function customExpression<Value, const Nullable extends boolean = false>(
  expression: SQL<Value>,
  options?: CustomExpressionOptions<Nullable, undefined, Value>
): ExpressionQueryField<Value, Nullable, 'custom', 'none'>

function customExpression<
  Value extends CursorScalar,
  const Nullable extends boolean = false,
>(
  expression: SQL<Value>,
  options: CustomExpressionOptions<
    Nullable,
    CustomExpressionCursor<Value>,
    Value
  > & {
    readonly cursor: CustomExpressionCursor<Value>
  }
): ExpressionQueryField<Value, Nullable, 'custom', 'default'>

function customExpression<Value, Nullable extends boolean>(
  expression: SQL<Value>,
  options: CustomExpressionOptions<
    Nullable,
    CustomExpressionCursorShape | undefined,
    Value
  > = {}
): ExpressionQueryField<Value, Nullable, 'custom', 'default' | 'none'> {
  return makeExpressionField(
    expression,
    'custom',
    options,
    options.cursor === undefined ? 'none' : 'default',
    undefined,
    options.cursor
  )
}

/** @internal Shared expression-helper implementation. */
export const expressionHelpers: ExpressionHelpers = {
  filter: <
    const Name extends string,
    const Operators extends readonly [
      AnyFilterOperator,
      ...AnyFilterOperator[],
    ],
  >(
    name: Name,
    declared: Operators
  ): VirtualQueryField<Name, Operators> => {
    validateFieldName(name)
    const operators = normalizeOperators(declared)
    return new QueryField({
      runtime: {
        name,
        origin: 'virtual',
        nullable: false,
        expression: sql`null`,
        filterValue: { type: 'unknown' },
        bind: (value: unknown) => sql.param(value),
        operators,
        operatorMap: new Map(
          operators.map((operator) => [operator.name, operator] as const)
        ),
        sort: undefined,
      },
      defaults: [],
      tools: undefined,
      sortMode: 'none',
    })
  },
  string: (expression, options = {}) =>
    makeExpressionField(expression, 'text', options, 'default'),
  number: (expression, options = {}) =>
    makeExpressionField(expression, 'number', options, 'default'),
  bigint: (expression, options = {}) =>
    makeExpressionField(expression, 'bigint', options, 'default'),
  boolean: (expression, options = {}) =>
    makeExpressionField(expression, 'boolean', options, 'default'),
  date: (expression, options = {}) =>
    makeExpressionField(expression, 'date', options, 'default'),
  enum: (expression, values, options = {}) =>
    makeExpressionField(expression, 'enum', options, 'enum', values),
  custom: customExpression,
}
