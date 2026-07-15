import type { SQL } from 'drizzle-orm'
import type {
  AnyQueryField,
  FieldNameOf,
  FieldOperatorsOf,
} from '../fields/index'
import type { AnyFilterOperator, OperatorRequests } from './operators/index'

/** A filter condition whose operator takes no right-hand-side value. */
export type UnaryFilterCondition<
  Field extends string = string,
  Operator extends string = string,
> = {
  readonly type: 'condition'
  readonly field: Field
  readonly operator: Operator
  readonly value?: never
}

/** A filter condition whose operator compares a field with a typed value. */
export type BinaryFilterCondition<
  Field extends string = string,
  Operator extends string = string,
  Value = unknown,
> = {
  readonly type: 'condition'
  readonly field: Field
  readonly operator: Operator
  readonly value: Value
}

/** Any untyped condition accepted by the low-level filtering compiler. */
export type FilterCondition = UnaryFilterCondition | BinaryFilterCondition

/** A recursive boolean combination of filter nodes. */
export type FilterGroup =
  | {
      readonly type: 'group'
      readonly combinator: 'and' | 'or'
      readonly children: readonly [FilterNode, ...FilterNode[]]
    }
  | {
      readonly type: 'group'
      readonly combinator: 'not'
      readonly children: readonly [FilterNode]
    }

/** A condition or nested boolean group in a filter expression. */
export type FilterNode = FilterCondition | FilterGroup

type FilterConditionForField<Field> = Field extends AnyQueryField
  ? FieldOperatorsOf<Field> extends infer Operators extends
      readonly AnyFilterOperator[]
    ? {
        readonly type: 'condition'
        readonly field: FieldNameOf<Field>
      } & OperatorRequests<Operators>
    : never
  : never

/** Conditions inferred from the names, operators, and values of query fields. */
export type TypedFilterCondition<Fields extends readonly AnyQueryField[]> =
  FilterConditionForField<Fields[number]>

/** A recursive boolean filter group constrained to a query's fields. */
export type TypedFilterGroup<Fields extends readonly AnyQueryField[]> =
  | {
      readonly type: 'group'
      readonly combinator: 'and' | 'or'
      readonly children: readonly [
        TypedFilterNode<Fields>,
        ...TypedFilterNode<Fields>[],
      ]
    }
  | {
      readonly type: 'group'
      readonly combinator: 'not'
      readonly children: readonly [TypedFilterNode<Fields>]
    }

/** A filter node whose valid shape is inferred from a query definition. */
export type TypedFilterNode<Fields extends readonly AnyQueryField[]> =
  | TypedFilterCondition<Fields>
  | TypedFilterGroup<Fields>

/** SQL fragments produced from a filter tree. */
export type FilterCompilation = {
  readonly where: SQL | undefined
}
