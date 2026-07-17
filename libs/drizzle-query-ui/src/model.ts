import type {
  FilterCondition,
  FilterNode,
  FilterValueDescriptor,
  QueryFieldInfo,
} from '@cv/drizzle-query'

import { resolveDescriptorValue } from './descriptor-value'

export type EditableFilterCondition = {
  readonly type: 'condition'
  readonly field: string
  readonly operator: string
  readonly value?: unknown
}

export type QueryFiltersState = {
  readonly combinator: 'and' | 'or'
  readonly conditions: readonly EditableFilterCondition[]
}

export type QueryFilterIssueCode =
  | 'unknownField'
  | 'unsupportedOperator'
  | 'required'
  | 'invalidValue'

export type QueryFilterIssue = {
  readonly index: number
  readonly condition: EditableFilterCondition
  readonly code: QueryFilterIssueCode
}

export type ResolvedQueryFiltersState = {
  /** Structurally normalized state retained by the editor and URL. */
  readonly state: QueryFiltersState
  /** Metadata-valid state that is safe to forward to drizzle-query. */
  readonly validState: QueryFiltersState
  readonly validConditions: readonly EditableFilterCondition[]
  readonly invalidConditions: readonly EditableFilterCondition[]
  readonly issues: readonly QueryFilterIssue[]
  readonly hasInvalidConditions: boolean
}

export type QueryFilterOption = {
  readonly label: string
  readonly value: string
}

/**
 * App-specific presentation for a query field. Query capabilities always come
 * from the authoritative drizzle-query definition and cannot be changed here.
 */
export type QueryFilterFieldPresentation = {
  readonly label?: string
  readonly description?: string
  readonly hidden?: boolean
  readonly defaultOperator?: string
  readonly initialValue?: unknown | ((operator: string) => unknown)
  readonly options?: readonly QueryFilterOption[]
}

export type QueryFilterField = QueryFieldInfo & {
  readonly label: string
  readonly description?: string
  readonly defaultOperator?: string
  readonly initialValue?: unknown | ((operator: string) => unknown)
  readonly options: readonly QueryFilterOption[]
}

export type QueryFilterDefinition = {
  readonly fields: readonly QueryFieldInfo[]
}

export const emptyQueryFiltersState = (): QueryFiltersState => ({
  combinator: 'and',
  conditions: [],
})

const humanize = (value: string): string =>
  value
    .replaceAll(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replaceAll(/[_-]+/gu, ' ')
    .replace(/^./u, (character) => character.toLocaleUpperCase('en-US'))

export const createQueryFilterFields = (
  definition: QueryFilterDefinition,
  presentation: Readonly<Record<string, QueryFilterFieldPresentation>> = {}
): readonly QueryFilterField[] =>
  definition.fields.flatMap((field) => {
    const configured = presentation[field.name]
    if (configured?.hidden === true || field.filterOperatorInfo.length === 0) {
      return []
    }
    return [
      {
        ...field,
        label: configured?.label ?? humanize(field.name),
        ...(configured?.description === undefined
          ? {}
          : { description: configured.description }),
        ...(configured?.defaultOperator === undefined
          ? {}
          : { defaultOperator: configured.defaultOperator }),
        ...(configured?.initialValue === undefined
          ? {}
          : { initialValue: configured.initialValue }),
        options: configured?.options ?? [],
      },
    ]
  })

export const valueForDescriptor = (
  descriptor: FilterValueDescriptor,
  now: () => Date = () => new Date()
): unknown => {
  switch (descriptor.type) {
    case 'string':
    case 'unknown':
      return ''
    case 'number':
      return 0
    case 'bigint':
      return '0'
    case 'boolean':
      return true
    case 'date':
      return now().toISOString()
    case 'enum':
      return descriptor.values.at(0) ?? ''
    case 'array':
      return []
    case 'tuple':
      return descriptor.items.map((item) => valueForDescriptor(item, now))
    case 'struct':
      return Object.fromEntries(
        Object.entries(descriptor.fields).map(([name, field]) => [
          name,
          valueForDescriptor(field, now),
        ])
      )
  }
}

export const conditionForField = (
  field: QueryFilterField,
  now?: () => Date
): EditableFilterCondition | undefined => {
  const operator =
    field.filterOperatorInfo.find(
      (candidate) => candidate.name === field.defaultOperator
    ) ?? field.filterOperatorInfo.at(0)
  if (operator === undefined) return undefined

  const descriptor =
    operator.kind === 'binary'
      ? (operator.value ?? { type: 'unknown' as const })
      : undefined
  const configuredInitialValue =
    typeof field.initialValue === 'function'
      ? field.initialValue(operator.name)
      : field.initialValue
  const firstOptionValue = field.options.at(0)?.value
  const optionInitialValue =
    configuredInitialValue === undefined &&
    firstOptionValue !== undefined &&
    descriptor !== undefined
      ? descriptor.type === 'array' &&
        (descriptor.item.type === 'string' ||
          descriptor.item.type === 'enum' ||
          descriptor.item.type === 'unknown')
        ? [firstOptionValue]
        : descriptor.type === 'string' ||
            descriptor.type === 'enum' ||
            descriptor.type === 'unknown'
          ? firstOptionValue
          : undefined
      : undefined

  return operator.kind === 'unary'
    ? { type: 'condition', field: field.name, operator: operator.name }
    : {
        type: 'condition',
        field: field.name,
        operator: operator.name,
        value:
          configuredInitialValue ??
          optionInitialValue ??
          valueForDescriptor(descriptor ?? { type: 'unknown' }, now),
      }
}

export const descriptorForOperator = (
  field: QueryFilterField,
  operatorName: string
): FilterValueDescriptor | undefined => {
  const operator = field.filterOperatorInfo.find(
    (candidate) => candidate.name === operatorName
  )
  if (operator?.kind !== 'binary') return undefined
  return operator.value ?? { type: 'unknown' }
}

const resolveCondition = (
  condition: EditableFilterCondition,
  index: number,
  fields: readonly QueryFilterField[]
):
  | { readonly valid: true; readonly condition: EditableFilterCondition }
  | { readonly valid: false; readonly issue: QueryFilterIssue } => {
  const field = fields.find((candidate) => candidate.name === condition.field)
  if (field === undefined) {
    return {
      valid: false,
      issue: { index, condition, code: 'unknownField' },
    }
  }

  const operator = field.filterOperatorInfo.find(
    (candidate) => candidate.name === condition.operator
  )
  if (operator === undefined) {
    return {
      valid: false,
      issue: { index, condition, code: 'unsupportedOperator' },
    }
  }

  if (operator.kind === 'unary') {
    return {
      valid: true,
      condition: {
        type: 'condition',
        field: field.name,
        operator: operator.name,
      },
    }
  }

  if (!Object.hasOwn(condition, 'value')) {
    return {
      valid: false,
      issue: { index, condition, code: 'required' },
    }
  }

  const descriptor = descriptorForOperator(field, operator.name) ?? {
    type: 'unknown' as const,
  }
  const resolvedValue = resolveDescriptorValue(descriptor, condition.value)
  if (!resolvedValue.valid) {
    return {
      valid: false,
      issue: {
        index,
        condition,
        code:
          condition.value === undefined ||
          condition.value === null ||
          condition.value === '' ||
          (Array.isArray(condition.value) && condition.value.length === 0)
            ? 'required'
            : 'invalidValue',
      },
    }
  }

  return {
    valid: true,
    condition: {
      type: 'condition',
      field: field.name,
      operator: operator.name,
      value: resolvedValue.value,
    },
  }
}

/**
 * Normalizes untrusted editor/URL state without applying query metadata.
 * Conditions that are not even structurally editable are discarded.
 */
export const normalizeQueryFiltersState = (
  value: unknown
): QueryFiltersState => {
  if (typeof value !== 'object' || value === null) {
    return emptyQueryFiltersState()
  }

  const combinator = Reflect.get(value, 'combinator')
  const conditions = Reflect.get(value, 'conditions')
  return {
    combinator: combinator === 'or' ? 'or' : 'and',
    conditions: Array.isArray(conditions)
      ? conditions.filter(isEditableCondition)
      : [],
  }
}

/**
 * Resolves structural state against the authoritative drizzle-query metadata.
 * Invalid/incomplete conditions remain available to the editor but are kept
 * out of `validState`, which is the only state that should reach the API.
 */
export const resolveQueryFiltersState = (
  value: unknown,
  definition: QueryFilterDefinition,
  presentation: Readonly<Record<string, QueryFilterFieldPresentation>> = {}
): ResolvedQueryFiltersState => {
  const state = normalizeQueryFiltersState(value)
  const fields = createQueryFilterFields(definition, presentation)
  const resolved = state.conditions.map((condition, index) =>
    resolveCondition(condition, index, fields)
  )
  const validConditions = resolved.flatMap((item) =>
    item.valid ? [item.condition] : []
  )
  const issues = resolved.flatMap((item) => (item.valid ? [] : [item.issue]))
  const invalidIndexes = new Set(issues.map((issue) => issue.index))
  const invalidConditions = state.conditions.filter((_, index) =>
    invalidIndexes.has(index)
  )

  return {
    state,
    validState: { ...state, conditions: validConditions },
    validConditions,
    invalidConditions,
    issues,
    hasInvalidConditions: issues.length > 0,
  }
}

export const changeConditionField = (
  condition: EditableFilterCondition,
  field: QueryFilterField,
  now?: () => Date
): EditableFilterCondition => conditionForField(field, now) ?? condition

export const changeConditionOperator = (
  condition: EditableFilterCondition,
  field: QueryFilterField,
  operatorName: string,
  now?: () => Date
): EditableFilterCondition => {
  const operator = field.filterOperatorInfo.find(
    (candidate) => candidate.name === operatorName
  )
  if (operator === undefined) return condition
  if (operator.kind === 'binary' && Object.hasOwn(condition, 'value')) {
    const descriptor = descriptorForOperator(field, operator.name) ?? {
      type: 'unknown' as const,
    }
    const resolvedValue = resolveDescriptorValue(descriptor, condition.value)
    if (resolvedValue.valid) {
      return {
        type: 'condition',
        field: field.name,
        operator: operator.name,
        value: resolvedValue.value,
      }
    }
  }
  return (
    conditionForField(
      {
        ...field,
        defaultOperator: operator.name,
      },
      now
    ) ?? condition
  )
}

export const filterNodesFromState = (
  state: QueryFiltersState,
  definition?: QueryFilterDefinition,
  presentation: Readonly<Record<string, QueryFilterFieldPresentation>> = {}
): readonly FilterNode[] => {
  const normalized =
    definition === undefined
      ? normalizeQueryFiltersState(state)
      : resolveQueryFiltersState(state, definition, presentation).validState
  const conditions = normalized.conditions as readonly FilterCondition[]
  if (conditions.length === 0 || normalized.combinator === 'and') {
    return conditions
  }
  return [
    {
      type: 'group',
      combinator: 'or',
      children: conditions as readonly [FilterCondition, ...FilterCondition[]],
    },
  ]
}

const isEditableCondition = (
  value: unknown
): value is EditableFilterCondition =>
  typeof value === 'object' &&
  value !== null &&
  Reflect.get(value, 'type') === 'condition' &&
  typeof Reflect.get(value, 'field') === 'string' &&
  typeof Reflect.get(value, 'operator') === 'string'

export const operatorLabel = (operator: string): string => {
  const labels: Readonly<Record<string, string>> = {
    between: 'is between',
    contains: 'contains',
    endsWith: 'ends with',
    eq: 'is',
    gt: 'is greater than',
    gte: 'is at least',
    hasAll: 'has all of',
    hasAny: 'has any of',
    hasNone: 'has none of',
    in: 'is one of',
    isEmpty: 'is empty',
    isNotEmpty: 'is not empty',
    isNotNull: 'has a value',
    isNull: 'has no value',
    lt: 'is less than',
    lte: 'is at most',
    matches: 'matches',
    ne: 'is not',
    notBetween: 'is not between',
    notContains: 'does not contain',
    notIn: 'is not one of',
    startsWith: 'starts with',
  }
  return labels[operator] ?? humanize(operator).toLocaleLowerCase('en-US')
}
