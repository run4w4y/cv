import {
  Button,
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
  cn,
  Select,
} from '@cv/internal-ui'
import { X } from 'lucide-react'
import * as React from 'react'
import {
  changeConditionOperator,
  descriptorForOperator,
  type EditableFilterCondition,
  operatorLabel,
} from './model'
import { keyConditions } from './query-filter-display'
import { useQueryFilters } from './query-filters-context'
import { ValueEditor } from './value-editor'

const FilterSelect = ({
  ariaLabel,
  value,
  onValueChange,
  options,
  className,
}: {
  readonly ariaLabel: string
  readonly value: string
  readonly onValueChange: (value: string) => void
  readonly options: readonly {
    readonly label: string
    readonly value: string
  }[]
  readonly className?: string
}) => (
  <Select
    ariaLabel={ariaLabel}
    value={value}
    onValueChange={(next) => {
      if (next !== null) onValueChange(next)
    }}
    options={options}
    className={cn(
      'h-10 min-h-10 rounded-none border-0 bg-transparent px-3 font-medium focus-visible:z-10 focus-visible:ring-0',
      className
    )}
  />
)

const UnavailableFilterRow = ({
  condition,
  index,
}: {
  readonly condition: EditableFilterCondition
  readonly index: number
}) => {
  const context = useQueryFilters()
  const renderedValue = Array.isArray(condition.value)
    ? condition.value.map(String).join(', ')
    : String(condition.value ?? '')

  return (
    <div
      className="min-w-0 max-w-full"
      data-filter-index={index}
      data-slot="query-filter-row"
    >
      <ButtonGroup
        className="min-w-0 max-w-full overflow-hidden rounded-md border border-destructive bg-card focus-within:ring-2 focus-within:ring-destructive/20"
        aria-invalid
      >
        <ButtonGroupText className="min-h-10 max-w-48 shrink-0 border-0 bg-transparent px-3 py-2">
          <span className="truncate">{condition.field}</span>
        </ButtonGroupText>
        <ButtonGroupSeparator />
        <ButtonGroupText className="min-h-10 shrink-0 border-0 bg-transparent px-3 py-2 text-muted-foreground">
          {operatorLabel(condition.operator)}
        </ButtonGroupText>
        {renderedValue.length === 0 ? null : (
          <>
            <ButtonGroupSeparator />
            <ButtonGroupText className="min-h-10 min-w-0 max-w-xl flex-1 border-0 bg-transparent px-3 py-2">
              <span className="truncate">{renderedValue}</span>
            </ButtonGroupText>
          </>
        )}
        <ButtonGroupSeparator />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove ${condition.field} filter`}
          onClick={() => context.removeCondition(index)}
          className="size-10 shrink-0 rounded-none border-0 bg-transparent text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <X />
        </Button>
      </ButtonGroup>
      <p className="mt-1.5 px-1 text-xs text-destructive" role="alert">
        This field is no longer available.
      </p>
    </div>
  )
}

const issueMessage = (
  code: 'required' | 'invalidValue' | 'unsupportedOperator' | 'unknownField'
) => {
  if (code === 'required') return 'Choose or enter a value.'
  if (code === 'invalidValue') {
    return 'This value is not valid for the selected field.'
  }
  if (code === 'unsupportedOperator') {
    return 'This operator is not supported for the selected field.'
  }
  return 'This field is no longer available.'
}

const FilterRow = ({
  condition,
  index,
}: {
  readonly condition: EditableFilterCondition
  readonly index: number
}) => {
  const context = useQueryFilters()
  const field = context.fields.find(
    (candidate) => candidate.name === condition.field
  )
  if (field === undefined) {
    return <UnavailableFilterRow condition={condition} index={index} />
  }
  const supportedOperator = field.filterOperatorInfo.find(
    (candidate) => candidate.name === condition.operator
  )
  const operator =
    supportedOperator ??
    ({
      name: condition.operator,
      kind: Object.hasOwn(condition, 'value') ? 'binary' : 'unary',
    } as const)
  const issue = context.resolved.issues.find((item) => item.index === index)

  return (
    <div
      className="min-w-0 max-w-full"
      data-filter-index={index}
      data-slot="query-filter-row"
    >
      <ButtonGroup
        className={cn(
          'min-w-0 max-w-full overflow-hidden rounded-md border bg-card focus-within:ring-2',
          issue === undefined
            ? 'border-border focus-within:border-ring focus-within:ring-ring/20'
            : 'border-destructive focus-within:ring-destructive/20'
        )}
        aria-invalid={issue === undefined ? undefined : true}
      >
        <ButtonGroupText className="min-h-10 max-w-48 shrink-0 border-0 bg-transparent px-3 py-2">
          <span className="truncate">{field.label}</span>
        </ButtonGroupText>
        <ButtonGroupSeparator />
        <FilterSelect
          ariaLabel={`${field.label} operator`}
          value={operator.name}
          onValueChange={(next) =>
            context.updateCondition(
              index,
              changeConditionOperator(condition, field, next)
            )
          }
          options={[
            ...(supportedOperator === undefined
              ? [
                  {
                    label: `${operatorLabel(condition.operator)} (unavailable)`,
                    value: condition.operator,
                  },
                ]
              : []),
            ...field.filterOperatorInfo.map((item) => ({
              label: operatorLabel(item.name),
              value: item.name,
            })),
          ]}
          className="max-w-48 shrink-0"
        />
        {operator.kind === 'binary' ? (
          <>
            <ButtonGroupSeparator />
            <div
              className="flex min-h-10 min-w-40 max-w-xl flex-1 items-center bg-transparent px-3"
              data-slot="query-filter-value"
            >
              <ValueEditor
                descriptor={
                  descriptorForOperator(field, operator.name) ?? {
                    type: 'unknown',
                  }
                }
                value={condition.value}
                onChange={(value) =>
                  context.updateCondition(index, { ...condition, value })
                }
                options={field.options}
                ariaLabel={`${field.label} value`}
                embedded
              />
            </div>
          </>
        ) : null}
        <ButtonGroupSeparator />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove ${field.label} filter`}
          onClick={() => context.removeCondition(index)}
          className="size-10 shrink-0 rounded-none border-0 bg-transparent text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <X />
        </Button>
      </ButtonGroup>
      {issue === undefined ? null : (
        <p className="mt-1.5 px-1 text-xs text-destructive" role="alert">
          {issueMessage(issue.code)}
        </p>
      )}
    </div>
  )
}

export const QueryFiltersRows = ({
  className,
}: {
  readonly className?: string
}) => {
  const context = useQueryFilters()
  const keyedConditions = React.useMemo(
    () => keyConditions(context.value.conditions),
    [context.value.conditions]
  )
  if (context.value.conditions.length === 0) return null

  return (
    <div
      className={cn('flex min-w-0 flex-wrap items-start gap-2.5', className)}
      data-slot="query-filter-rows"
    >
      {keyedConditions.map(({ condition, index, key }) => (
        <FilterRow key={key} condition={condition} index={index} />
      ))}
    </div>
  )
}
