import { QueryError } from '../../error'
import {
  type AnyFilterOperator,
  normalizeOperators,
} from '../../filtering/operators/index'
import type { FieldOrigin, FieldRuntime, SortMode } from '../runtime'
import {
  applySortableOptions,
  type EnumSortableOptions,
  type SortableOptions,
} from '../sortable-options'
import type { NonEmptyOperators } from './types'

/** @internal Validates a public field or expression alias. */
export const validateFieldName = (name: string, path = 'field.name'): void => {
  if (name.length === 0 || name !== name.trim()) {
    throw new QueryError(
      'invalid-definition',
      'Field names must be non-empty and may not have surrounding whitespace.',
      { path }
    )
  }
}

/** @internal Copies runtime metadata while preserving the field's origin. */
export const cloneFieldRuntime = <Origin extends FieldOrigin>(
  runtime: FieldRuntime & { readonly origin: Origin },
  changes: Omit<Partial<FieldRuntime>, 'origin'>
): FieldRuntime & { readonly origin: Origin } => ({
  ...runtime,
  ...changes,
  origin: runtime.origin,
})

/** @internal Resolves and indexes the operators selected by `filterable`. */
export const resolveFieldOperators = <Tools>(
  defaults: readonly AnyFilterOperator[],
  tools: Tools,
  definition?:
    | NonEmptyOperators
    | ((
        defaults: readonly AnyFilterOperator[],
        tools: Tools
      ) => NonEmptyOperators)
) => {
  const selected =
    definition === undefined
      ? defaults
      : typeof definition === 'function'
        ? definition(defaults, tools)
        : definition
  const operators = normalizeOperators(selected)

  return {
    operators,
    operatorMap: new Map(
      operators.map((operator) => [operator.name, operator] as const)
    ),
  }
}

/** @internal Applies ordering options to one sortable runtime. */
export const resolveFieldSort = (
  runtime: FieldRuntime,
  mode: SortMode,
  options: SortableOptions | EnumSortableOptions<string>
) => {
  const current = runtime.sort
  const path = `fields.${runtime.name ?? '<unnamed>'}.sortable`
  if (current === undefined || mode === 'none') {
    throw new QueryError(
      'invalid-definition',
      'This field has no default ordering semantics.',
      { path }
    )
  }
  if (current.enabled) {
    throw new QueryError(
      'invalid-definition',
      'A field may only be marked sortable once.',
      { path }
    )
  }

  return applySortableOptions(current, options, path)
}
