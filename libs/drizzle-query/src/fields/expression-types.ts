import type { SQL, SQLWrapper } from 'drizzle-orm'

import type { CursorScalar, CursorValueType } from '../cursor/index'
import type {
  AnyFilterOperator,
  DefaultOperatorKind,
  DefaultOperators,
  FilterValueDescriptor,
  NormalizeOperators,
} from '../filtering/operators/index'
import type { QueryField } from './query-field'
import type { SortMode } from './runtime'

/** @internal Shared query-field shape returned by expression constructors. */
export type ExpressionQueryField<
  Value,
  Nullable extends boolean,
  Kind extends DefaultOperatorKind,
  Mode extends SortMode,
> = QueryField<
  never,
  Value,
  Nullable,
  DefaultOperators<Kind, Value, Nullable>,
  undefined,
  false,
  undefined,
  Mode,
  undefined,
  'expression'
>

/** A named filter-only field with no selectable or sortable SQL value. */
export type VirtualQueryField<
  Name extends string,
  Operators extends readonly [AnyFilterOperator, ...AnyFilterOperator[]],
> = QueryField<
  Name,
  never,
  false,
  readonly [],
  NormalizeOperators<Operators>,
  false,
  undefined,
  'none',
  undefined,
  'virtual'
>

/** Runtime metadata needed to expose a typed computed SQL expression. */
export type ExpressionOptions<Nullable extends boolean, Value = unknown> = {
  /** Whether the expression can evaluate to SQL `null`. */
  readonly nullable?: Nullable
  /** Encodes filter/cursor comparison values for computed SQL expressions. */
  readonly bind?: (value: Value) => SQLWrapper
  /** Runtime value description for custom expression filters. */
  readonly filterValue?: FilterValueDescriptor
}

/** Cursor scalar discriminator inferred from a TypeScript scalar type. */
export type CursorTypeFor<Value extends CursorScalar> =
  Exclude<Value, null> extends string
    ? 'string'
    : Exclude<Value, null> extends number
      ? 'number'
      : Exclude<Value, null> extends boolean
        ? 'boolean'
        : Exclude<Value, null> extends bigint
          ? 'bigint'
          : Exclude<Value, null> extends Date
            ? 'date'
            : CursorValueType

/** Cursor metadata that makes a custom expression sortable. */
export type CustomExpressionCursor<Value extends CursorScalar = CursorScalar> =
  {
    readonly type: CursorTypeFor<Value>
    /** Converts a logical expression result to its stored comparison value. */
    readonly encode?: (value: Exclude<Value, null>) => unknown
  }

/** @internal Erased cursor shape used by the expression factory. */
export type CustomExpressionCursorShape = {
  readonly type: CursorValueType
  readonly encode?: (value: never) => unknown
}

/** Options for a custom expression with optional cursor support. */
export type CustomExpressionOptions<
  Nullable extends boolean,
  Cursor extends CustomExpressionCursorShape | undefined,
  Value = unknown,
> = ExpressionOptions<Nullable, Value> & {
  readonly cursor?: Cursor
}

/** Typed scalar constructors available as `expr` in {@link defineQuery}. */
export type ExpressionHelpers = {
  /** Declares a named filter-only field backed exclusively by custom operators. */
  readonly filter: <
    const Name extends string,
    const Operators extends readonly [
      AnyFilterOperator,
      ...AnyFilterOperator[],
    ],
  >(
    name: Name,
    operators: Operators
  ) => VirtualQueryField<Name, Operators>
  /** Declares a text expression with inferred text filters and ordering. */
  readonly string: <const Nullable extends boolean = false>(
    expression: SQL<string>,
    options?: ExpressionOptions<Nullable, string>
  ) => ExpressionQueryField<string, Nullable, 'text', 'default'>
  /** Declares a numeric expression with inferred numeric filters and ordering. */
  readonly number: <const Nullable extends boolean = false>(
    expression: SQL<number>,
    options?: ExpressionOptions<Nullable, number>
  ) => ExpressionQueryField<number, Nullable, 'number', 'default'>
  /** Declares a bigint expression with inferred bigint filters and ordering. */
  readonly bigint: <const Nullable extends boolean = false>(
    expression: SQL<bigint>,
    options?: ExpressionOptions<Nullable, bigint>
  ) => ExpressionQueryField<bigint, Nullable, 'bigint', 'default'>
  /** Declares a boolean expression with inferred boolean filters and ordering. */
  readonly boolean: <const Nullable extends boolean = false>(
    expression: SQL<boolean>,
    options?: ExpressionOptions<Nullable, boolean>
  ) => ExpressionQueryField<boolean, Nullable, 'boolean', 'default'>
  /** Declares a date expression with inferred date filters and ordering. */
  readonly date: <const Nullable extends boolean = false>(
    expression: SQL<Date>,
    options?: ExpressionOptions<Nullable, Date>
  ) => ExpressionQueryField<Date, Nullable, 'date', 'default'>
  /** Declares an enum expression with inferred enum filters. */
  readonly enum: <
    const Values extends readonly [string, ...string[]],
    const Nullable extends boolean = false,
  >(
    expression: SQL<Values[number]>,
    values: Values,
    options?: ExpressionOptions<Nullable, Values[number]>
  ) => ExpressionQueryField<Values[number], Nullable, 'enum', 'enum'>
  /** Declares a consumer-defined expression, optionally with cursor semantics. */
  readonly custom: {
    <Value, const Nullable extends boolean = false>(
      expression: SQL<Value>,
      options?: CustomExpressionOptions<Nullable, undefined, Value>
    ): ExpressionQueryField<Value, Nullable, 'custom', 'none'>
    <Value extends CursorScalar, const Nullable extends boolean = false>(
      expression: SQL<Value>,
      options: CustomExpressionOptions<
        Nullable,
        CustomExpressionCursor<Value>,
        Value
      > & {
        readonly cursor: CustomExpressionCursor<Value>
      }
    ): ExpressionQueryField<Value, Nullable, 'custom', 'default'>
  }
}
