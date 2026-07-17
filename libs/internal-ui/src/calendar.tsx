import { type CalendarDate, today } from '@internationalized/date'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import * as React from 'react'
import { useLocale } from 'react-aria'
import {
  Button as AriaButton,
  Calendar as AriaCalendar,
  type CalendarProps as AriaCalendarProps,
  CalendarCell,
  type CalendarCellProps,
  CalendarGrid,
  CalendarGridBody,
  CalendarGridHeader,
  CalendarHeaderCell,
  CalendarStateContext,
  composeRenderProps,
  type DateValue,
  Heading,
  RangeCalendar,
  RangeCalendarStateContext,
} from 'react-aria-components'

import {
  type CalendarRangeValue,
  capitalizeMonthLabel,
  type DateRange,
  formatMonthRangeLabel,
  fromRangeValue,
  localTimeZone,
  mapDateUnavailable,
  toCalendarDate,
  toDate,
  toRangeValue,
} from './calendar-utils'
import { Select } from './select'
import { cn } from './utils'

type SharedCalendarProps = {
  readonly className?: string
  readonly numberOfMonths?: number
  readonly disabled?: boolean
  readonly initialFocus?: boolean
  readonly minValue?: Date
  readonly maxValue?: Date
  readonly isDateUnavailable?: (date: Date) => boolean
  readonly ariaLabel?: string
}

type SingleCalendarProps = SharedCalendarProps & {
  readonly mode?: 'single'
  readonly selected?: Date | null
  readonly onSelect?: (value?: Date) => void
}

type RangeCalendarProps = SharedCalendarProps & {
  readonly mode: 'range'
  readonly selected?: DateRange
  readonly onSelect?: (value?: DateRange) => void
}

export type CalendarProps = SingleCalendarProps | RangeCalendarProps

const CalendarHeader = () => {
  const calendarState = React.useContext(CalendarStateContext)
  const rangeState = React.useContext(RangeCalendarStateContext)
  const state = calendarState ?? rangeState
  const { locale } = useLocale()
  const focusedDate = state?.focusedDate ?? state?.visibleRange.start
  const visibleStart = state?.visibleRange.start ?? focusedDate
  const visibleEnd = state?.visibleRange.end ?? visibleStart

  const visibleMonthCount = React.useMemo(() => {
    if (!visibleStart || !visibleEnd) return 1
    return Math.max(
      (visibleEnd.year - visibleStart.year) * 12 +
        visibleEnd.month -
        visibleStart.month +
        1,
      1
    )
  }, [visibleEnd, visibleStart])

  const monthFormatter = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long' }),
    [locale]
  )
  const headingFormatter = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
    [locale]
  )
  const headingLabel = visibleStart
    ? formatMonthRangeLabel(
        visibleStart,
        visibleMonthCount,
        headingFormatter,
        state?.timeZone ?? localTimeZone,
        locale
      )
    : ''

  const monthOptions = React.useMemo(() => {
    if (!state || !visibleStart) return []

    return Array.from(
      {
        length: visibleStart.calendar.getMonthsInYear(visibleStart),
      },
      (_, index) => {
        const month = index + 1
        const target = visibleStart.set({ month })
        return {
          value: String(month),
          label: formatMonthRangeLabel(
            target,
            visibleMonthCount,
            monthFormatter,
            state.timeZone,
            locale
          ),
        }
      }
    )
  }, [locale, monthFormatter, state, visibleMonthCount, visibleStart])

  const [year, setYear] = React.useState(() => String(focusedDate?.year ?? ''))

  React.useEffect(() => {
    setYear(String(focusedDate?.year ?? ''))
  }, [focusedDate?.year])

  if (!state || !focusedDate || !visibleStart) return null

  const setFocusedDate = (nextDate: typeof focusedDate) => {
    if (!state.isInvalid(nextDate)) state.setFocusedDate(nextDate)
  }

  const commitYear = () => {
    const parsed = Number(year)
    if (!Number.isInteger(parsed)) {
      setYear(String(focusedDate.year))
      return
    }

    const clamped = Math.min(
      state.maxValue?.year ?? parsed,
      Math.max(state.minValue?.year ?? parsed, parsed)
    )
    const target = focusedDate.set({ year: clamped })
    if (state.isInvalid(target)) {
      setYear(String(focusedDate.year))
      return
    }
    setFocusedDate(target)
    setYear(String(target.year))
  }

  const disabled = state.isDisabled || state.isReadOnly

  return (
    <header className="grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-2 border-b border-border bg-muted/50 px-3 py-2">
      <Heading className="sr-only">{headingLabel}</Heading>
      <AriaButton
        slot="previous"
        aria-label="Previous month"
        className="grid size-8 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        <ChevronLeft className="size-4" />
      </AriaButton>

      <div
        className="flex min-w-0 items-center justify-center gap-1.5"
        onPointerDownCapture={(event) => event.stopPropagation()}
      >
        <Select
          value={String(visibleStart.month)}
          onValueChange={(value) => {
            if (!value) return
            setFocusedDate(visibleStart.set({ month: Number(value) }))
          }}
          options={monthOptions}
          ariaLabel={headingLabel}
          disabled={disabled}
          className="h-8 w-auto min-w-28 border-0 bg-transparent px-2 text-sm font-semibold shadow-none"
        />
        <input
          type="text"
          inputMode="numeric"
          value={year}
          onChange={(event) =>
            setYear(event.target.value.replace(/[^\d-]/g, ''))
          }
          onBlur={commitYear}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commitYear()
            }
            if (event.key === 'Escape') setYear(String(focusedDate.year))
          }}
          aria-label="Year"
          disabled={disabled}
          className="h-8 w-14 rounded-md bg-transparent px-1 text-center text-sm font-semibold text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>

      <AriaButton
        slot="next"
        aria-label="Next month"
        className="grid size-8 place-items-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-background hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      >
        <ChevronRight className="size-4" />
      </AriaButton>
    </header>
  )
}

type CalendarDayCellProps = Omit<CalendarCellProps, 'date'> & {
  readonly date: CalendarDate
  readonly todayDate: CalendarDate
  readonly gridMonthDate?: CalendarDate
}

const CalendarDayCell = ({
  date,
  todayDate,
  gridMonthDate,
  className,
  ...props
}: CalendarDayCellProps) => {
  const calendarState = React.useContext(CalendarStateContext)
  const rangeState = React.useContext(RangeCalendarStateContext)
  const state = calendarState ?? rangeState
  if (!state) return null

  return (
    <CalendarCell
      {...props}
      date={date}
      className={composeRenderProps(className, (userClassName, renderProps) => {
        const renderedDate = renderProps.date ?? date
        const outsideGridMonth = Boolean(
          gridMonthDate &&
            (renderedDate.month !== gridMonthDate.month ||
              renderedDate.year !== gridMonthDate.year)
        )
        const isToday = renderedDate.compare(todayDate) === 0
        const inRange =
          renderProps.isSelected &&
          !renderProps.isSelectionStart &&
          !renderProps.isSelectionEnd

        return cn(
          'group relative flex size-10 items-center justify-center rounded-md text-sm font-medium text-foreground outline-none transition-colors select-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover',
          !renderProps.isSelected &&
            !renderProps.isDisabled &&
            !renderProps.isUnavailable &&
            'hover:bg-muted',
          renderProps.isSelected &&
            !inRange &&
            'bg-primary text-primary-foreground hover:bg-primary/90',
          inRange && 'rounded-none bg-accent text-accent-foreground',
          renderProps.isSelectionStart &&
            !renderProps.isSelectionEnd &&
            'rounded-r-none',
          renderProps.isSelectionEnd &&
            !renderProps.isSelectionStart &&
            'rounded-l-none',
          (renderProps.isDisabled || renderProps.isUnavailable) &&
            'cursor-not-allowed text-muted-foreground opacity-50',
          isToday &&
            !renderProps.isSelected &&
            'font-bold text-primary after:absolute after:bottom-1 after:size-1 after:rounded-full after:bg-primary after:content-[""]',
          outsideGridMonth && 'invisible pointer-events-none',
          !renderProps.isDisabled &&
            !renderProps.isUnavailable &&
            'cursor-pointer',
          userClassName
        )
      })}
    />
  )
}

const CalendarGrids = ({ numberOfMonths }: { numberOfMonths: number }) => {
  const calendarState = React.useContext(CalendarStateContext)
  const rangeState = React.useContext(RangeCalendarStateContext)
  const state = calendarState ?? rangeState
  const { locale } = useLocale()
  const visibleStart = state?.visibleRange.start ?? state?.focusedDate
  const todayDate = React.useMemo(() => today(localTimeZone), [])
  const monthFormatter = React.useMemo(
    () => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }),
    [locale]
  )

  return (
    <div className="isolate flex flex-wrap gap-5 px-3 py-4">
      {Array.from({ length: Math.max(numberOfMonths, 1) }, (_, index) => {
        const gridMonthDate = visibleStart?.add({ months: index })

        return (
          <div key={gridMonthDate?.toString()} className="min-w-0 shrink-0">
            {numberOfMonths > 1 && gridMonthDate ? (
              <div className="mb-2 text-center text-sm font-semibold text-muted-foreground">
                {capitalizeMonthLabel(
                  monthFormatter.format(
                    gridMonthDate.toDate(state?.timeZone ?? localTimeZone)
                  ),
                  locale
                )}
              </div>
            ) : null}
            <CalendarGrid
              offset={{ months: index }}
              className="border-collapse border-spacing-0"
            >
              <CalendarGridHeader>
                {(day) => (
                  <CalendarHeaderCell className="h-7 w-10 text-xs font-semibold uppercase text-muted-foreground">
                    {day}
                  </CalendarHeaderCell>
                )}
              </CalendarGridHeader>
              <CalendarGridBody>
                {(value) => (
                  <CalendarDayCell
                    date={value}
                    todayDate={todayDate}
                    gridMonthDate={gridMonthDate as CalendarDate | undefined}
                  />
                )}
              </CalendarGridBody>
            </CalendarGrid>
          </div>
        )
      })}
    </div>
  )
}

export const Calendar = (props: CalendarProps) => {
  const {
    className,
    numberOfMonths: numberOfMonthsProp,
    disabled,
    initialFocus,
    minValue,
    maxValue,
    isDateUnavailable,
    ariaLabel = 'Calendar',
  } = props
  const numberOfMonths = numberOfMonthsProp ?? (props.mode === 'range' ? 2 : 1)
  const commonProps = {
    className: cn(
      'w-fit max-w-[calc(100vw-2rem)] overflow-auto rounded-md bg-popover text-popover-foreground',
      className
    ),
    isDisabled: disabled,
    autoFocus: initialFocus,
    visibleDuration: { months: Math.max(numberOfMonths, 1) },
    minValue: toCalendarDate(minValue),
    maxValue: toCalendarDate(maxValue),
    isDateUnavailable: mapDateUnavailable(isDateUnavailable),
    'aria-label': ariaLabel,
  } satisfies Partial<AriaCalendarProps<DateValue>>

  if (props.mode === 'range') {
    const value = toRangeValue(props.selected)
    return (
      <RangeCalendar
        {...commonProps}
        value={props.selected === undefined ? undefined : value}
        onChange={(next) =>
          props.onSelect?.(
            fromRangeValue(next as unknown as CalendarRangeValue | null)
          )
        }
      >
        <CalendarHeader />
        <CalendarGrids numberOfMonths={numberOfMonths} />
      </RangeCalendar>
    )
  }

  const value = toCalendarDate(props.selected)
  return (
    <AriaCalendar
      {...commonProps}
      value={props.selected === undefined ? undefined : (value ?? null)}
      onChange={(next) => props.onSelect?.(toDate(next))}
    >
      <CalendarHeader />
      <CalendarGrids numberOfMonths={numberOfMonths} />
    </AriaCalendar>
  )
}
