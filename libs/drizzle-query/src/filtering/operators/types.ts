import type { SQL, SQLWrapper } from 'drizzle-orm'

declare const operatorValueType: unique symbol
declare const operatorContextType: unique symbol

/** Opaque integration metadata keyed by adapter-owned symbols. */
export type FilterOperatorAnnotations = ReadonlyMap<symbol, unknown>

/** Effect-free description of a filter value that runtime schema adapters can consume. */
export type FilterValueDescriptor =
  | { readonly type: 'string' }
  | { readonly type: 'number' }
  | { readonly type: 'bigint' }
  | { readonly type: 'boolean' }
  | { readonly type: 'date' }
  | { readonly type: 'enum'; readonly values: readonly string[] }
  | { readonly type: 'unknown' }
  | { readonly type: 'array'; readonly item: FilterValueDescriptor }
  | {
      readonly type: 'tuple'
      readonly items: readonly FilterValueDescriptor[]
    }
  | {
      readonly type: 'struct'
      readonly fields: Readonly<Record<string, FilterValueDescriptor>>
    }

/** Binds a right-hand-side value with the field's Drizzle encoder. */
export type FilterValueBinder = (value: unknown) => SQLWrapper

/** How a binary operator derives its operand descriptor from its field. */
export type FilterValueShape = 'field' | 'array' | 'tuple'

type ContextCompileArgument<Context> = [Context] extends [never]
  ? { readonly context?: never }
  : { readonly context: Context }

/** SQL expression and definition context supplied to a unary operator. */
export type UnaryFilterOperatorCompileArguments<Context = never> = {
  readonly expression: SQLWrapper
} & ContextCompileArgument<Context>

/** Field expression, typed value, binder, and definition context for a binary operator. */
export type BinaryFilterOperatorCompileArguments<Value, Context = never> = {
  readonly expression: SQLWrapper
  readonly value: Value
  readonly bind: FilterValueBinder
} & ContextCompileArgument<Context>

/** A named operator that tests a field without a right-hand-side value. */
export interface UnaryFilterOperator<
  Name extends string = string,
  Context = never,
> {
  readonly kind: 'unary'
  readonly name: Name
  compile(arguments_: UnaryFilterOperatorCompileArguments<Context>): SQL
  /** Type-only carrier used to infer the query definition's compile context. */
  readonly [operatorContextType]?: Context
}

/** A named operator that compares a field with one typed request value. */
export interface BinaryFilterOperator<
  Name extends string = string,
  Value = unknown,
  Context = never,
> {
  readonly kind: 'binary'
  readonly name: Name
  /** Field-relative operand shape used by schema integrations. */
  readonly valueShape: FilterValueShape
  /** Optional value description overriding inference from the query field. */
  readonly valueDescriptor?: FilterValueDescriptor
  /** Opaque adapter-owned metadata, ignored by the core package. */
  readonly annotations?: FilterOperatorAnnotations
  compile(arguments_: BinaryFilterOperatorCompileArguments<Value, Context>): SQL
  /** Type-only carrier used to infer the right-hand-side request value. */
  readonly [operatorValueType]?: Value
  /** Type-only carrier used to infer the query definition's compile context. */
  readonly [operatorContextType]?: Context
}

type RuntimeUnaryFilterOperator = {
  readonly kind: 'unary'
  readonly name: string
  readonly compile: (arguments_: never) => SQL
}

type RuntimeBinaryFilterOperator = {
  readonly kind: 'binary'
  readonly name: string
  readonly valueShape: FilterValueShape
  readonly valueDescriptor?: FilterValueDescriptor
  readonly annotations?: FilterOperatorAnnotations
  readonly compile: (arguments_: never) => SQL
}

/** Runtime union of supported unary and binary filter operators. */
export type AnyFilterOperator =
  | RuntimeUnaryFilterOperator
  | RuntimeBinaryFilterOperator

/** Extracts the literal public name carried by an operator. */
export type OperatorName<Operator> = Operator extends {
  readonly name: infer Name extends string
}
  ? Name
  : never

/** Extracts the right-hand-side value type carried by a binary operator. */
export type OperatorValue<Operator> =
  Operator extends BinaryFilterOperator<string, infer Value, infer _Context>
    ? Value
    : never

/** Extracts the definition compile context required by an operator. */
export type OperatorContext<Operator> =
  Operator extends UnaryFilterOperator<string, infer Context>
    ? Context
    : Operator extends BinaryFilterOperator<string, infer _Value, infer Context>
      ? Context
      : never

/** Produces the request fragment accepted by one operator. */
export type OperatorRequest<Operator extends AnyFilterOperator> =
  Operator extends BinaryFilterOperator<infer Name, infer Value, infer _Context>
    ? {
        readonly operator: Name
        readonly value: Value
      }
    : Operator extends UnaryFilterOperator<infer Name, infer _Context>
      ? {
          readonly operator: Name
          readonly value?: never
        }
      : never

/** Produces the request union accepted by an operator collection. */
export type OperatorRequests<Operators extends readonly AnyFilterOperator[]> =
  OperatorRequest<Operators[number]>

/** Definition options for a binary filter operator. */
export interface BinaryFilterOperatorOptions<Value, Context = never> {
  /** Field-relative operand shape; defaults to the field value itself. */
  readonly valueShape?: FilterValueShape
  /** Runtime value description for custom operands that cannot be inferred. */
  readonly valueDescriptor?: FilterValueDescriptor
  /** Opaque adapter-owned metadata, ignored by the core package. */
  readonly annotations?: FilterOperatorAnnotations
  readonly compile: (
    arguments_: BinaryFilterOperatorCompileArguments<Value, Context>
  ) => SQL
}

/** Definition options for a unary filter operator. */
export interface UnaryFilterOperatorOptions<Context = never> {
  readonly compile: (
    arguments_: UnaryFilterOperatorCompileArguments<Context>
  ) => SQL
}
