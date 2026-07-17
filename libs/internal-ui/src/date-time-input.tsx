import { CalendarDays } from 'lucide-react'
import * as React from 'react'

import { Calendar } from './calendar'
import {
  isWithinDateTimeBounds,
  violatesDateUnavailable,
} from './calendar-utils'
import type { CalendarOptionProps } from './date-picker'
import { InputGroup, InputGroupButton } from './input-group'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { SegmentedDateInput } from './segmented-date-input'
import { cn } from './utils'

export interface DateTimeInputProps
  extends CalendarOptionProps,
    Omit<
      React.InputHTMLAttributes<HTMLInputElement>,
      | 'className'
      | 'defaultValue'
      | 'disabled'
      | 'onChange'
      | 'placeholder'
      | 'value'
    > {
  readonly value?: Date | null
  readonly defaultValue?: Date | null
  readonly onChange?: (value: Date | undefined) => void
  readonly disabled?: boolean
  readonly className?: string
  readonly popoverClassName?: string
  readonly inputAriaLabel?: string
}

const applyDateToTime = (date: Date, source?: Date) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    source?.getHours() ?? 0,
    source?.getMinutes() ?? 0
  )

export const DateTimeInput = React.forwardRef<
  HTMLDivElement,
  DateTimeInputProps
>(
  (
    {
      value,
      defaultValue,
      onChange,
      disabled,
      className,
      popoverClassName,
      calendarClassName,
      inputAriaLabel,
      minValue,
      maxValue,
      numberOfMonths,
      isDateUnavailable,
      ariaLabel,
      name,
      form,
      autoFocus,
      required,
      readOnly,
      onBlur,
      onFocus,
      'aria-label': ariaLabelProp,
      'aria-invalid': ariaInvalid,
      ...inputProps
    },
    ref
  ) => {
    const controlled = value !== undefined
    const [open, setOpen] = React.useState(false)
    const anchorRef = React.useRef<HTMLDivElement>(null)
    const [internalDate, setInternalDate] = React.useState<Date | undefined>(
      value ?? defaultValue ?? undefined
    )
    const [invalid, setInvalid] = React.useState(false)
    const selected = controlled ? (value ?? undefined) : internalDate
    const resolvedInputLabel =
      inputAriaLabel ?? ariaLabelProp ?? 'Select date and time'

    React.useEffect(() => {
      if (controlled) {
        setInternalDate(value ?? undefined)
        setInvalid(false)
      }
    }, [controlled, value])

    const selectable = React.useCallback(
      (date: Date) =>
        isWithinDateTimeBounds(date, minValue, maxValue) &&
        !violatesDateUnavailable(date, isDateUnavailable),
      [isDateUnavailable, maxValue, minValue]
    )

    const commit = React.useCallback(
      (date?: Date) => {
        if (!controlled) setInternalDate(date)
        onChange?.(date)
      },
      [controlled, onChange]
    )

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <div
          ref={anchorRef}
          className={cn('w-full', className)}
          onFocusCapture={(event) => {
            const target = event.target as HTMLElement
            if (
              !disabled &&
              !target.closest('[data-slot="date-time-popover-trigger"]')
            ) {
              setOpen(true)
            }
            onFocus?.(event as unknown as React.FocusEvent<HTMLInputElement>)
          }}
        >
          <InputGroup data-disabled={disabled ? 'true' : undefined}>
            <SegmentedDateInput
              {...(inputProps as React.HTMLAttributes<HTMLDivElement>)}
              ref={ref}
              value={selected}
              onChange={(date) => {
                if (!date) {
                  setInvalid(false)
                  commit(undefined)
                } else if (selectable(date)) {
                  setInvalid(false)
                  commit(date)
                } else setInvalid(true)
              }}
              onBlur={(event) => {
                setInvalid(false)
                onBlur?.(event as unknown as React.FocusEvent<HTMLInputElement>)
              }}
              ariaLabel={resolvedInputLabel}
              name={name}
              form={form}
              autoFocus={autoFocus}
              required={required}
              readOnly={readOnly}
              disabled={disabled}
              invalid={
                invalid || ariaInvalid === true || ariaInvalid === 'true'
              }
              minValue={minValue}
              maxValue={maxValue}
              isDateUnavailable={isDateUnavailable}
              granularity="minute"
            />
            <PopoverTrigger
              render={
                <InputGroupButton
                  data-slot="date-time-popover-trigger"
                  type="button"
                  disabled={disabled}
                  aria-label="Open calendar"
                >
                  <CalendarDays />
                </InputGroupButton>
              }
            />
          </InputGroup>
        </div>
        <PopoverContent
          anchor={anchorRef}
          align="start"
          initialFocus={false}
          className={cn('w-auto max-w-none p-0', popoverClassName)}
        >
          <Calendar
            mode="single"
            selected={selected ?? null}
            onSelect={(date) => {
              if (!date) return
              const next = applyDateToTime(date, selected)
              if (!selectable(next)) return
              setInvalid(false)
              commit(next)
              setOpen(false)
            }}
            className={calendarClassName}
            minValue={minValue}
            maxValue={maxValue}
            numberOfMonths={numberOfMonths}
            isDateUnavailable={isDateUnavailable}
            ariaLabel={ariaLabel}
          />
        </PopoverContent>
      </Popover>
    )
  }
)

DateTimeInput.displayName = 'DateTimeInput'
