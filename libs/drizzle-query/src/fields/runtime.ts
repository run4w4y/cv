import type { SQL, SQLWrapper } from 'drizzle-orm'

import type { CursorScalar, CursorValueDescriptor } from '../cursor/index'
import type {
  AnyFilterOperator,
  FilterValueBinder,
  FilterValueDescriptor,
} from '../filtering/operators/index'

export const fieldTypes: unique symbol = Symbol('fieldTypes')
export const queryFieldBrand: unique symbol = Symbol('queryField')

/** Public query-field name. */
export type FieldName = string
/** Supported ordering directions. */
export type SortDirection = 'asc' | 'desc'
/** Explicit placement of SQL nulls in an ordering term. */
export type NullPlacement = 'first' | 'last'
/** Source category of a declared query field. */
export type FieldOrigin = 'column' | 'expression' | 'relation' | 'virtual'

export type SortRuntime = {
  readonly enabled: boolean
  readonly expression: SQLWrapper
  readonly cursorType: CursorValueDescriptor
  readonly unique: boolean
  readonly nullable: boolean
  readonly defaultNulls: NullPlacement
  readonly selection: (alias: string) => SQL.Aliased<unknown>
  readonly encode?: (value: Exclude<CursorScalar, null>) => unknown
  /** Stable data that changes whenever inferred ordering semantics change. */
  readonly cursorIdentity?: unknown
}

export type FieldRuntime = {
  readonly name: string | undefined
  readonly origin: FieldOrigin
  readonly nullable: boolean
  readonly expression: SQLWrapper
  readonly filterValue: FilterValueDescriptor
  readonly bind: FilterValueBinder
  readonly operators: readonly AnyFilterOperator[] | undefined
  readonly operatorMap: ReadonlyMap<string, AnyFilterOperator> | undefined
  readonly sort: SortRuntime | undefined
  /** Projection available to opt-in renderer selections. */
  readonly selection?: (alias: string) => SQL.Aliased<unknown>
}

export interface FieldTypeCarrier<
  Name extends string,
  Value,
  Operators extends readonly AnyFilterOperator[] | undefined,
  Sortable extends boolean,
  Origin extends FieldOrigin = FieldOrigin,
  Result = Value,
> {
  readonly [queryFieldBrand]: true
  readonly runtime: FieldRuntime
  readonly [fieldTypes]?: {
    readonly name: Name
    readonly value: Value
    readonly operators: Operators
    readonly sortable: Sortable
    readonly origin: Origin
    readonly result: Result
  }
}

/** Broad query-field constraint used by public definition generics. */
export type AnyQueryField = FieldTypeCarrier<
  string,
  unknown,
  readonly AnyFilterOperator[] | undefined,
  boolean,
  FieldOrigin,
  unknown
>

/** Extracts a query field's public name. */
export type FieldNameOf<Field> = Field extends {
  readonly [fieldTypes]?: { readonly name: infer Name extends string }
}
  ? Name
  : never

/** Extracts a query field's logical request value. */
export type FieldValueOf<Field> = Field extends {
  readonly [fieldTypes]?: { readonly value: infer Value }
}
  ? Value
  : never

/** Extracts the authoritative filter-operator tuple for a query field. */
export type FieldOperatorsOf<Field> = Field extends {
  readonly [fieldTypes]?: {
    readonly operators: infer Operators extends
      | readonly AnyFilterOperator[]
      | undefined
  }
}
  ? Operators
  : never

/** Extracts whether a query field was marked sortable. */
export type FieldIsSortable<Field> = Field extends {
  readonly [fieldTypes]?: { readonly sortable: infer Sortable extends boolean }
}
  ? Sortable
  : false

/** Extracts whether a field comes from a column, expression, or relation. */
export type FieldOriginOf<Field> = Field extends {
  readonly [fieldTypes]?: { readonly origin: infer Origin extends FieldOrigin }
}
  ? Origin
  : never

/** Extracts the value returned when an expression field is selected. */
export type FieldResultOf<Field> = Field extends {
  readonly [fieldTypes]?: { readonly result: infer Result }
}
  ? Result
  : never

export type SortMode = 'default' | 'enum' | 'none'
