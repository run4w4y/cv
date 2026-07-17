import type { FilterValueDescriptor } from '@cv/drizzle-query'
import { cn, DateTimeRangeInput } from '@cv/internal-ui'

import {
  dateRangeFromFilterValue,
  filterValueFromDateRange,
  isDateRangeDescriptor,
} from '../date-value'
import {
  embeddedDateInputClassName,
  type ValueEditorProps,
} from './editor-types'
import { ScalarEditor } from './scalar-editor'

type TupleDescriptor = Extract<FilterValueDescriptor, { type: 'tuple' }>

export const TupleEditor = ({
  descriptor,
  value,
  onChange,
  ariaLabel,
  embedded = false,
  ...props
}: ValueEditorProps & { readonly descriptor: TupleDescriptor }) => {
  if (isDateRangeDescriptor(descriptor)) {
    return (
      <DateTimeRangeInput
        value={dateRangeFromFilterValue(value)}
        onChange={(next) => onChange(filterValueFromDateRange(next))}
        startAriaLabel={`${ariaLabel} from`}
        endAriaLabel={`${ariaLabel} to`}
        ariaLabel={`${ariaLabel} calendar`}
        numberOfMonths={2}
        className={cn(
          'w-full max-sm:[&_[data-slot=input-group]]:grid-cols-[minmax(0,1fr)_auto] max-sm:[&_[data-slot=input-group-text]]:hidden max-sm:[&_[data-slot=input-group-control]:nth-child(3)]:col-start-1 max-sm:[&_[data-slot=input-group-control]:nth-child(3)]:row-start-2 max-sm:[&_[data-slot=input-group-control]:nth-child(3)]:border-t max-sm:[&_[data-slot=input-group-button]]:col-start-2 max-sm:[&_[data-slot=input-group-button]]:row-start-1 max-sm:[&_[data-slot=input-group-button]]:row-span-2',
          embedded && embeddedDateInputClassName,
          embedded && 'w-104'
        )}
      />
    )
  }

  const values = Array.isArray(value) ? value : []
  const updateTupleValue = (index: number, next: unknown) => {
    const updated = [...values]
    updated[index] = next
    onChange(updated)
  }

  return (
    <div
      className={cn(
        'min-w-64',
        embedded ? 'flex items-center gap-2' : 'grid grid-cols-2 gap-2'
      )}
    >
      {descriptor.items[0] === undefined ? null : (
        <div className="min-w-0 flex-1">
          <ScalarEditor
            {...props}
            embedded={embedded}
            descriptor={descriptor.items[0]}
            value={values[0]}
            onChange={(next) => updateTupleValue(0, next)}
            ariaLabel={`${ariaLabel} from`}
          />
        </div>
      )}
      {embedded ? (
        <span className="shrink-0 text-xs text-muted-foreground">to</span>
      ) : null}
      {descriptor.items[1] === undefined ? null : (
        <div className="min-w-0 flex-1">
          <ScalarEditor
            {...props}
            embedded={embedded}
            descriptor={descriptor.items[1]}
            value={values[1]}
            onChange={(next) => updateTupleValue(1, next)}
            ariaLabel={`${ariaLabel} to`}
          />
        </div>
      )}
    </div>
  )
}
