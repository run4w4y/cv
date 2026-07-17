import { CalendarDays } from 'lucide-react'
import * as React from 'react'

import { Button } from './button'
import { Calendar } from './calendar'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { cn } from './utils'

export type CalendarOptionProps = {
  readonly numberOfMonths?: number
  readonly minValue?: Date
  readonly maxValue?: Date
  readonly isDateUnavailable?: (date: Date) => boolean
  readonly ariaLabel?: string
  readonly calendarClassName?: string
}

export interface DatePickerProps extends CalendarOptionProps {
  readonly value?: Date | null
  readonly onChange?: (value: Date | undefined) => void
  readonly placeholder?: string
  readonly formatDate?: (value: Date | undefined) => string
  readonly disabled?: boolean
  readonly className?: string
}

export const DatePicker = ({
  value,
  onChange,
  placeholder = 'Choose a date',
  formatDate = (date) => (date ? date.toLocaleDateString() : ''),
  disabled,
  className,
  calendarClassName,
  ...calendarProps
}: DatePickerProps) => {
  const controlled = value !== undefined
  const [open, setOpen] = React.useState(false)
  const [internalValue, setInternalValue] = React.useState<Date | undefined>(
    value ?? undefined
  )

  React.useEffect(() => {
    if (controlled) setInternalValue(value ?? undefined)
  }, [controlled, value])

  const selected = controlled ? (value ?? undefined) : internalValue
  const displayValue = formatDate(selected)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            aria-label={calendarProps.ariaLabel ?? 'Choose a date'}
            disabled={disabled}
            className={cn(
              'w-full justify-start text-left font-normal',
              !selected && 'text-muted-foreground',
              className
            )}
          >
            <CalendarDays />
            {displayValue || placeholder}
          </Button>
        }
      />
      <PopoverContent align="start" className="w-auto max-w-none p-0">
        <Calendar
          mode="single"
          selected={selected ?? null}
          onSelect={(date) => {
            if (!controlled) setInternalValue(date)
            onChange?.(date)
            if (date) setOpen(false)
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
