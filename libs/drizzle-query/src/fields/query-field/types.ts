import type {
  AnyFilterOperator,
  DefaultOperators,
} from '../../filtering/operators/index'
import type { FieldOrigin, FieldRuntime, SortMode } from '../runtime'
import type { QueryField } from './index'

/** @internal Non-empty authoritative operator list accepted by `filterable`. */
export type NonEmptyOperators = readonly [
  AnyFilterOperator,
  ...AnyFilterOperator[],
]

/** @internal Factory carried by relation fields that support `.count()`. */
export type CountFactory = () => CountQueryField

/** Numeric query field returned by a relationship's `.count()` helper. */
export type CountQueryField = QueryField<
  never,
  number,
  false,
  DefaultOperators<'number', number, false>,
  undefined,
  false,
  undefined,
  'default',
  undefined,
  'expression'
>

/** @internal Custom operators or a transformation of inferred defaults. */
export type FilterDefinition<
  Defaults extends readonly AnyFilterOperator[],
  Tools,
  Final extends NonEmptyOperators,
> = Final | ((defaults: Defaults, tools: Tools) => Final)

/** @internal Constructor state shared by every immutable field copy. */
export type InternalFieldOptions<
  Defaults extends readonly AnyFilterOperator[],
  Tools,
  Mode extends SortMode,
  Count extends CountFactory | undefined,
  Origin extends FieldOrigin,
> = {
  readonly runtime: FieldRuntime & { readonly origin: Origin }
  readonly defaults: Defaults
  readonly tools: Tools
  readonly sortMode: Mode
  readonly count?: Count
}
