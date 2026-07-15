import type {
  NullPlacement as FieldNullPlacement,
  FieldRuntime,
  SortDirection,
  SortRuntime,
} from '../fields/index'

/** The direction in which an ordering term compares non-null values. */
export type Direction = SortDirection

/** Where null values appear relative to non-null values. */
export type NullPlacement = FieldNullPlacement

/**
 * A consumer-supplied ordering term.
 *
 * This is distributive over `FieldName`, which preserves completion and
 * narrowing when a query exposes a literal union of sortable field names.
 */
export type OrderRequest<FieldName extends string = string> =
  FieldName extends string
    ? {
        readonly field: FieldName
        readonly direction?: Direction
        readonly nulls?: NullPlacement
      }
    : never

/** Definition-owned inputs used to resolve deterministic ordering. */
export type OrderingResolutionOptions<FieldName extends string = string> = {
  readonly defaults?: readonly OrderRequest<FieldName>[]
  readonly uniqueBy?: readonly (readonly FieldName[])[]
}

/** Field runtimes accepted by the low-level ordering compiler. */
export type OrderingFieldSource =
  | readonly FieldRuntime[]
  | ReadonlyMap<string, FieldRuntime>

/**
 * A fully resolved term, including defaults and any deterministic tie-breaker
 * appended by the package.
 */
export type EffectiveOrderTerm<FieldName extends string = string> = {
  readonly field: FieldName
  readonly direction: Direction
  readonly nulls: NullPlacement
  readonly unique: boolean
  readonly nullable: boolean
  readonly source: 'request' | 'default' | 'fallback' | 'tie-breaker'
}

/** Target-neutral deterministic ordering resolved for one query request. */
export type OrderingResolution<FieldName extends string = string> = {
  readonly terms: readonly EffectiveOrderTerm<FieldName>[]
}

export type ResolvedOrderTerm<FieldName extends string> = {
  readonly public: EffectiveOrderTerm<FieldName>
  readonly sort: SortRuntime
}

export type OrderingErrorKind = 'definition' | 'request'
