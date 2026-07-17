import { CalendarDays } from 'lucide-react'
import * as React from 'react'

import { Button } from './button'
import { Calendar } from './calendar'
import type { DateRange } from './calendar-utils'
import type { CalendarOptionProps } from './date-picker'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { cn } from './utils'

export interface DateRangePickerProps extends CalendarOptionProps {
  readonly value?: DateRange
  readonly onChange?: (value: DateRange | undefined) => void
  readonly placeholder?: string
  readonly formatRange?: (value: DateRange | undefined) => string
  readonly disabled?: boolean
  readonly className?: string
  readonly popoverClassName?: string
}

const defaultFormatRange = (range?: DateRange) => {
  if (range?.from && range.to) {
    return `${range.from.toLocaleDateString()} – ${range.to.toLocaleDateString()}`
  }
  return range?.from?.toLocaleDateString() ?? ''
}

export const DateRangePicker = ({
  value,
  onChange,
  placeholder = 'Select a date range',
  formatRange = defaultFormatRange,
  disabled,
  className,
  calendarClassName,
  popoverClassName,
  ...calendarProps
}: DateRangePickerProps) => {
  const controlled = value !== undefined
  const [open, setOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState<
    DateRange | undefined
  >(value)

  React.useEffect(() => {
    if (controlled) setInternalValue(value)
  }, [controlled, value])

  const selected = controlled ? value : internalValue
  const displayValue = formatRange(selected)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={calendarProps.ariaLabel ?? 'Choose a date range'}
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left font-normal',
              (!selected?.from || !selected.to) && 'text-muted-foreground',
              className
            )}
          >
            <CalendarDays />
            {displayValue || placeholder}
          </Button>
        }
      />
      <PopoverContent
        align="start"
        className={cn('w-auto max-w-none p-0', popoverClassName)}
      >
        <Calendar
          mode="range"
          selected={selected}
          onSelect={(range) => {
            if (!controlled) setInternalValue(range)
            onChange?.(range)
            if (range?.from && range.to) setOpen(false)
          }}
          disabled={disabled}
          initialFocus
          className={calendarClassName}
          {...calendarProps}
        />
      </PopoverContent>
    </Popover>
  )
}
