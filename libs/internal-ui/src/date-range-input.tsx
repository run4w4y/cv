import { CalendarDays } from 'lucide-react'
import * as React from 'react'

import { Calendar } from './calendar'
import {
  type DateRange,
  isWithinBounds,
  isWithinDateTimeBounds,
  violatesDateUnavailable,
} from './calendar-utils'
import type { CalendarOptionProps } from './date-picker'
import { InputGroup, InputGroupButton, InputGroupText } from './input-group'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { SegmentedDateInput } from './segmented-date-input'
import { cn } from './utils'

export interface DateRangeInputProps extends CalendarOptionProps {
  readonly value?: DateRange
  readonly defaultValue?: DateRange
  readonly onChange?: (value: DateRange | undefined) => void
  readonly disabled?: boolean
  readonly className?: string
  readonly popoverClassName?: string
  readonly startAriaLabel?: string
  readonly endAriaLabel?: string
}

type DateRangeFieldProps = DateRangeInputProps & {
  readonly granularity: 'day' | 'minute'
}

const normalizeRange = (range?: DateRange | null): DateRange | undefined =>
  range?.from || range?.to
    ? { from: range.from ?? undefined, to: range.to ?? undefined }
    : undefined

const applyDateToTime = (date: Date, source?: Date) =>
  new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    source?.getHours() ?? 0,
    source?.getMinutes() ?? 0
  )

export const DateRangeField = ({
  value,
  defaultValue,
  onChange,
  disabled,
  className,
  popoverClassName,
  calendarClassName,
  startAriaLabel,
  endAriaLabel,
  granularity,
  ...calendarProps
}: DateRangeFieldProps) => {
  const controlled = value !== undefined
  const [open, setOpen] = React.useState(false)
  const [internalRange, setInternalRange] = React.useState<
    DateRange | undefined
  >(normalizeRange(value ?? defaultValue))
  const [draftRange, setDraftRange] = React.useState<DateRange | undefined>()
  const [startInvalid, setStartInvalid] = React.useState(false)
  const [endInvalid, setEndInvalid] = React.useState(false)
  const selected =
    draftRange ?? (controlled ? normalizeRange(value) : internalRange)
  const isDateTime = granularity === 'minute'

  React.useEffect(() => {
    if (controlled) {
      setInternalRange(normalizeRange(value))
      setDraftRange(undefined)
      setStartInvalid(false)
      setEndInvalid(false)
    }
  }, [controlled, value])

  const commit = React.useCallback(
    (next?: DateRange) => {
      const normalized = normalizeRange(next)
      if (!controlled) setInternalRange(normalized)
      setDraftRange(undefined)
      onChange?.(normalized)
    },
    [controlled, onChange]
  )

  const selectable = React.useCallback(
    (date: Date) => {
      const withinBounds = isDateTime
        ? isWithinDateTimeBounds(
            date,
            calendarProps.minValue,
            calendarProps.maxValue
          )
        : isWithinBounds(date, calendarProps.minValue, calendarProps.maxValue)
      return (
        withinBounds &&
        !violatesDateUnavailable(date, calendarProps.isDateUnavailable)
      )
    },
    [
      calendarProps.isDateUnavailable,
      calendarProps.maxValue,
      calendarProps.minValue,
      isDateTime,
    ]
  )

  const updateStart = (next?: Date) => {
    if (!next) {
      setStartInvalid(false)
      setEndInvalid(false)
      commit(undefined)
      return
    }
    if (!selectable(next)) {
      setStartInvalid(true)
      return
    }

    setStartInvalid(false)
    commit(
      selected?.to && next <= selected.to
        ? { from: next, to: selected.to }
        : { from: next }
    )
  }

  const updateEnd = (next?: Date) => {
    if (!next) {
      setEndInvalid(false)
      commit(selected?.from ? { from: selected.from } : undefined)
      return
    }
    if (!selectable(next)) {
      setEndInvalid(true)
      return
    }
    if (!selected?.from || next < selected.from) {
      setEndInvalid(true)
      setDraftRange({ from: selected?.from, to: next })
      return
    }

    setEndInvalid(false)
    commit({ from: selected.from, to: next })
  }

  const startLabel =
    startAriaLabel ?? (isDateTime ? 'Start date and time' : 'Start date')
  const endLabel =
    endAriaLabel ?? (isDateTime ? 'End date and time' : 'End date')

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={
          <div
            className={cn('w-full', className)}
            onFocusCapture={() => {
              if (!disabled) setOpen(true)
            }}
          >
            <InputGroup
              data-disabled={disabled ? 'true' : undefined}
              className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto]"
            >
              <SegmentedDateInput
                value={selected?.from}
                onChange={updateStart}
                onBlur={() => {
                  setStartInvalid(false)
                  setDraftRange(undefined)
                }}
                ariaLabel={startLabel}
                disabled={disabled}
                invalid={startInvalid}
                minValue={calendarProps.minValue}
                maxValue={calendarProps.maxValue}
                isDateUnavailable={calendarProps.isDateUnavailable}
                granularity={granularity}
              />
              <InputGroupText className="px-2">–</InputGroupText>
              <SegmentedDateInput
                value={selected?.to}
                onChange={updateEnd}
                onBlur={() => {
                  setEndInvalid(false)
                  setDraftRange(undefined)
                }}
                ariaLabel={endLabel}
                disabled={disabled}
                invalid={endInvalid}
                minValue={calendarProps.minValue}
                maxValue={calendarProps.maxValue}
                isDateUnavailable={calendarProps.isDateUnavailable}
                granularity={granularity}
              />
              <InputGroupButton
                type="button"
                disabled={disabled}
                aria-label="Open calendar"
              >
                <CalendarDays />
              </InputGroupButton>
            </InputGroup>
          </div>
        }
      />
      <PopoverContent
        align="start"
        initialFocus={false}
        className={cn('w-auto max-w-none p-0', popoverClassName)}
      >
        <Calendar
          mode="range"
          selected={selected}
          onSelect={(range) => {
            if (!range) {
              commit(undefined)
              return
            }

            const from = range.from
              ? isDateTime
                ? applyDateToTime(range.from, selected?.from)
                : range.from
              : undefined
            let to = range.to
              ? isDateTime
                ? applyDateToTime(range.to, selected?.to)
                : range.to
              : undefined
            if (from && !selectable(from)) return
            if (to && !selectable(to)) return
            if (from && to && from > to) to = from

            setStartInvalid(false)
            setEndInvalid(false)
            commit({ from, to })
            if (from && to) setOpen(false)
          }}
          className={calendarClassName}
          {...calendarProps}
        />
      </PopoverContent>
    </Popover>
  )
}

export const DateRangeInput = (props: DateRangeInputProps) => (
  <DateRangeField {...props} granularity="day" />
)
