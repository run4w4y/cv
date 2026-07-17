import * as React from 'react'

import {
  conditionForField,
  createQueryFilterFields,
  type EditableFilterCondition,
  type QueryFilterDefinition,
  type QueryFilterField,
  type QueryFilterFieldPresentation,
  type QueryFiltersState,
  type ResolvedQueryFiltersState,
  resolveQueryFiltersState,
} from './model'

type QueryFiltersConfiguration = {
  readonly definition: QueryFilterDefinition
  readonly value: QueryFiltersState
  readonly onValueChange: (value: QueryFiltersState) => void
  readonly fields?: Readonly<Record<string, QueryFilterFieldPresentation>>
  readonly className?: string
  readonly defaultExpanded?: boolean
  readonly expanded?: boolean
  readonly onExpandedChange?: (expanded: boolean) => void
  readonly onResolvedStateChange?: (state: ResolvedQueryFiltersState) => void
}

export type QueryFiltersProps = QueryFiltersConfiguration

export type QueryFiltersRootProps = QueryFiltersConfiguration & {
  readonly children: React.ReactNode
}

export type QueryFiltersContextValue = {
  readonly value: QueryFiltersState
  readonly fields: readonly QueryFilterField[]
  readonly expanded: boolean
  readonly setExpanded: (expanded: boolean) => void
  readonly addCondition: (field: QueryFilterField) => void
  readonly updateCondition: (
    index: number,
    condition: EditableFilterCondition
  ) => void
  readonly removeCondition: (index: number) => void
  readonly resolved: ResolvedQueryFiltersState
}

const QueryFiltersContext =
  React.createContext<QueryFiltersContextValue | null>(null)

export const useQueryFilters = (): QueryFiltersContextValue => {
  const context = React.useContext(QueryFiltersContext)
  if (context === null) {
    throw new Error(
      'QueryFilters components must be used within QueryFiltersRoot'
    )
  }
  return context
}

const useControllableExpandedState = (
  expandedProp: boolean | undefined,
  defaultExpanded: boolean,
  onExpandedChange?: (expanded: boolean) => void
) => {
  const [internalExpanded, setInternalExpanded] =
    React.useState(defaultExpanded)
  const controlled = expandedProp !== undefined
  const expanded = controlled ? expandedProp : internalExpanded

  const setExpanded = React.useCallback(
    (next: boolean) => {
      if (!controlled) setInternalExpanded(next)
      onExpandedChange?.(next)
    },
    [controlled, onExpandedChange]
  )

  return [expanded, setExpanded] as const
}

export const QueryFiltersRoot = ({
  definition,
  value,
  onValueChange,
  fields: fieldPresentation,
  className,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  onResolvedStateChange,
  children,
}: QueryFiltersRootProps) => {
  const [expanded, setExpanded] = useControllableExpandedState(
    expandedProp,
    defaultExpanded,
    onExpandedChange
  )
  const fields = React.useMemo(
    () => createQueryFilterFields(definition, fieldPresentation),
    [definition, fieldPresentation]
  )
  const resolved = React.useMemo(
    () => resolveQueryFiltersState(value, definition, fieldPresentation),
    [definition, fieldPresentation, value]
  )

  React.useEffect(() => {
    onResolvedStateChange?.(resolved)
  }, [onResolvedStateChange, resolved])

  const updateCondition = React.useCallback(
    (index: number, condition: EditableFilterCondition) => {
      onValueChange({
        ...value,
        conditions: value.conditions.map((item, current) =>
          current === index ? condition : item
        ),
      })
    },
    [onValueChange, value]
  )

  const removeCondition = React.useCallback(
    (index: number) => {
      onValueChange({
        ...value,
        conditions: value.conditions.filter((_, current) => current !== index),
      })
    },
    [onValueChange, value]
  )

  const addCondition = React.useCallback(
    (field: QueryFilterField) => {
      const condition = conditionForField(field)
      if (condition === undefined) return
      onValueChange({
        ...value,
        conditions: [...value.conditions, condition],
      })
    },
    [onValueChange, value]
  )

  const context = React.useMemo<QueryFiltersContextValue>(
    () => ({
      value,
      fields,
      expanded,
      setExpanded,
      addCondition,
      updateCondition,
      removeCondition,
      resolved,
    }),
    [
      addCondition,
      expanded,
      fields,
      removeCondition,
      setExpanded,
      updateCondition,
      value,
      resolved,
    ]
  )

  return (
    <QueryFiltersContext.Provider value={context}>
      <div className={className}>{children}</div>
    </QueryFiltersContext.Provider>
  )
}
