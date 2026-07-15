import type {
  AnyFilterOperator,
  NormalizeOperators,
} from '../../filtering/operators/index'
import {
  type FieldOrigin,
  type FieldRuntime,
  type FieldTypeCarrier,
  fieldTypes,
  queryFieldBrand,
  type SortMode,
} from '../runtime'
import type { EnumSortableOptions, SortableOptions } from '../sortable-options'
import {
  cloneFieldRuntime,
  resolveFieldOperators,
  resolveFieldSort,
  validateFieldName,
} from './runtime'
import type {
  CountFactory,
  FilterDefinition,
  InternalFieldOptions,
  NonEmptyOperators,
} from './types'

export type { CountQueryField } from './types'

/**
 * Immutable-style capability builder for one column, expression, or relation.
 * Each modifier returns a new field value with correspondingly narrowed types.
 */
export class QueryField<
  Name extends string,
  Value,
  Nullable extends boolean,
  Defaults extends readonly AnyFilterOperator[],
  Operators extends readonly AnyFilterOperator[] | undefined = undefined,
  IsSortable extends boolean = false,
  Tools = undefined,
  Mode extends SortMode = 'default',
  Count extends CountFactory | undefined = undefined,
  Origin extends FieldOrigin = FieldOrigin,
> implements
    FieldTypeCarrier<
      Name,
      Value,
      Operators,
      IsSortable,
      Origin,
      Nullable extends true ? Value | null : Value
    >
{
  readonly [queryFieldBrand] = true as const
  readonly runtime: FieldRuntime & { readonly origin: Origin }
  readonly [fieldTypes]?: {
    readonly name: Name
    readonly value: Value
    readonly operators: Operators
    readonly sortable: IsSortable
    readonly origin: Origin
    readonly result: Nullable extends true ? Value | null : Value
  }

  readonly #defaults: Defaults
  readonly #tools: Tools
  readonly #sortMode: Mode
  readonly #count: Count | undefined
  readonly count: Count extends CountFactory ? Count : never

  constructor(
    options: InternalFieldOptions<Defaults, Tools, Mode, Count, Origin>
  ) {
    this.runtime = options.runtime
    this.#defaults = options.defaults
    this.#tools = options.tools
    this.#sortMode = options.sortMode
    this.#count = options.count
    this.count = options.count as Count extends CountFactory ? Count : never
  }

  /** Assigns the public name required by computed and relationship fields. */
  as<const Alias extends string>(
    alias: Alias
  ): QueryField<
    Alias,
    Value,
    Nullable,
    Defaults,
    Operators,
    IsSortable,
    Tools,
    Mode,
    Count,
    Origin
  > {
    validateFieldName(alias)
    return new QueryField({
      runtime: cloneFieldRuntime(this.runtime, { name: alias }),
      defaults: this.#defaults,
      tools: this.#tools,
      sortMode: this.#sortMode,
      count: this.#count,
    })
  }

  /** Enables the field's inferred filter operators. */
  filterable(
    this: Defaults extends readonly []
      ? never
      : QueryField<
          Name,
          Value,
          Nullable,
          Defaults,
          Operators,
          IsSortable,
          Tools,
          Mode,
          Count,
          Origin
        >
  ): QueryField<
    Name,
    Value,
    Nullable,
    Defaults,
    Defaults,
    IsSortable,
    Tools,
    Mode,
    Count,
    Origin
  >

  /** Enables an authoritative custom operator array or default transformation. */
  filterable<const Final extends NonEmptyOperators>(
    definition: FilterDefinition<Defaults, Tools, Final>
  ): QueryField<
    Name,
    Value,
    Nullable,
    Defaults,
    NormalizeOperators<Final>,
    IsSortable,
    Tools,
    Mode,
    Count,
    Origin
  >

  filterable(
    definition?:
      | NonEmptyOperators
      | ((
          defaults: readonly AnyFilterOperator[],
          tools: Tools
        ) => NonEmptyOperators)
  ): QueryField<
    Name,
    Value,
    Nullable,
    Defaults,
    readonly AnyFilterOperator[],
    IsSortable,
    Tools,
    Mode,
    Count,
    Origin
  > {
    const { operators, operatorMap } = resolveFieldOperators(
      this.#defaults,
      this.#tools,
      definition
    )

    return new QueryField({
      runtime: cloneFieldRuntime(this.runtime, { operators, operatorMap }),
      defaults: this.#defaults,
      tools: this.#tools,
      sortMode: this.#sortMode,
      count: this.#count,
    })
  }

  /** Enables inferred scalar ordering semantics. */
  sortable(
    this: Mode extends 'default'
      ? QueryField<
          Name,
          Value,
          Nullable,
          Defaults,
          Operators,
          IsSortable,
          Tools,
          Mode,
          Count,
          Origin
        >
      : never,
    options?: SortableOptions
  ): QueryField<
    Name,
    Value,
    Nullable,
    Defaults,
    Operators,
    true,
    Tools,
    Mode,
    Count,
    Origin
  >

  /** Enables enum ordering with an explicit semantic rank. */
  sortable(
    this: Mode extends 'enum'
      ? QueryField<
          Name,
          Value,
          Nullable,
          Defaults,
          Operators,
          IsSortable,
          Tools,
          Mode,
          Count,
          Origin
        >
      : never,
    options: EnumSortableOptions<Extract<Value, string>>
  ): QueryField<
    Name,
    Value,
    Nullable,
    Defaults,
    Operators,
    true,
    Tools,
    Mode,
    Count,
    Origin
  >

  sortable(
    options: SortableOptions | EnumSortableOptions<Extract<Value, string>> = {}
  ): QueryField<
    Name,
    Value,
    Nullable,
    Defaults,
    Operators,
    true,
    Tools,
    Mode,
    Count,
    Origin
  > {
    const sort = resolveFieldSort(this.runtime, this.#sortMode, options)

    return new QueryField({
      runtime: cloneFieldRuntime(this.runtime, { sort }),
      defaults: this.#defaults,
      tools: this.#tools,
      sortMode: this.#sortMode,
      count: this.#count,
    })
  }
}
