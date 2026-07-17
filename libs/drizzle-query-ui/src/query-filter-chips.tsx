import { Badge } from '@cv/internal-ui'
import { X } from 'lucide-react'
import * as React from 'react'
import { operatorLabel } from './model'
import { conditionValueLabel, keyConditions } from './query-filter-display'
import { useQueryFilters } from './query-filters-context'

export const QueryFiltersChips = () => {
  const context = useQueryFilters()
  const keyedConditions = React.useMemo(
    () => keyConditions(context.value.conditions),
    [context.value.conditions]
  )

  if (context.value.conditions.length === 0) return null

  return (
    <ul
      className="flex min-w-0 flex-wrap gap-2"
      aria-label="Active filters"
      data-slot="query-filter-chips"
    >
      {keyedConditions.map(({ condition, index, key }) => {
        const field = context.fields.find(
          (candidate) => candidate.name === condition.field
        )
        const fieldLabel = field?.label ?? condition.field
        const renderedValue =
          field === undefined
            ? String(condition.value ?? '')
            : conditionValueLabel(condition, field)
        const invalid =
          field === undefined ||
          context.resolved.issues.some((issue) => issue.index === index)

        return (
          <li key={key} className="contents">
            <Badge
              variant={invalid ? 'danger' : 'secondary'}
              className="min-h-8 max-w-full min-w-0 gap-2 px-2.5"
            >
              <span className="shrink-0 font-semibold text-foreground">
                {fieldLabel}
              </span>
              <span className="shrink-0 text-muted-foreground">
                {operatorLabel(condition.operator)}
              </span>
              {renderedValue.length > 0 ? (
                <span className="truncate">{renderedValue}</span>
              ) : null}
              <button
                type="button"
                aria-label={`Remove ${fieldLabel} filter`}
                onClick={() => context.removeCondition(index)}
                className="ml-0.5 cursor-pointer rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <X className="size-3" />
              </button>
            </Badge>
          </li>
        )
      })}
    </ul>
  )
}
