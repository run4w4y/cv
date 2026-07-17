import {
  CalendarDate,
  CalendarDateTime,
  getLocalTimeZone,
} from '@internationalized/date'
import type { CalendarProps as AriaCalendarProps } from 'react-aria-components'

export interface DateRange {
  readonly from?: Date
  readonly to?: Date
}

export type CalendarRangeValue = {
  readonly start: CalendarDate
  readonly end: CalendarDate
}

type MonthLabelDate = {
  readonly toDate: (timeZone: string) => Date
  readonly add: (duration: { months?: number }) => MonthLabelDate
}

export const localTimeZone = getLocalTimeZone()

export const toCalendarDate = (
  date?: Date | null
): CalendarDate | undefined => {
  if (!date) return undefined

  return new CalendarDate(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  )
}

export const toCalendarDateTimeValue = (
  date?: Date | null
): CalendarDateTime | undefined => {
  if (!date) return undefined

  return new CalendarDateTime(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
    date.getHours(),
    date.getMinutes()
  )
}

export const toDate = (value?: unknown): Date | undefined => {
  if (!value) return undefined

  if (
    typeof (value as { toDate?: (zone: string) => Date }).toDate === 'function'
  ) {
    return (value as { toDate: (zone: string) => Date }).toDate(localTimeZone)
  }

  const date = value as CalendarDate
  return new Date(date.year, date.month - 1, date.day)
}

export const toRangeValue = (
  range?: DateRange | null
): CalendarRangeValue | null => {
  if (!range?.from || !range.to) return null

  const start = toCalendarDate(range.from)
  const end = toCalendarDate(range.to)
  return start && end ? { start, end } : null
}

export const fromRangeValue = (
  range?: CalendarRangeValue | null
): DateRange | undefined => {
  if (!range) return undefined

  const from = toDate(range.start)
  const to = toDate(range.end)
  return from || to ? { from, to } : undefined
}

export const mapDateUnavailable = (
  predicate?: (date: Date) => boolean
): AriaCalendarProps<never>['isDateUnavailable'] => {
  if (!predicate) return undefined

  return (value) => {
    const date = toDate(value)
    return date ? predicate(date) : false
  }
}

const capitalizeFirstLetter = (value: string, locale?: string) => {
  const index = value.search(/\p{L}/u)
  if (index === -1) return value

  const letter = value[index] ?? ''
  const capitalized = locale
    ? letter.toLocaleUpperCase(locale)
    : letter.toLocaleUpperCase()
  return `${value.slice(0, index)}${capitalized}${value.slice(index + letter.length)}`
}

export const capitalizeMonthLabel = (value: string, locale?: string) =>
  value
    .split(' – ')
    .map((label) => capitalizeFirstLetter(label, locale))
    .join(' – ')

export const formatMonthRangeLabel = (
  startDate: MonthLabelDate,
  monthsVisible: number,
  formatter: Intl.DateTimeFormat,
  timeZone: string,
  locale?: string
) => {
  const count = Math.max(monthsVisible, 1)
  const start = capitalizeMonthLabel(
    formatter.format(startDate.toDate(timeZone)),
    locale
  )
  if (count === 1) return start

  const end = capitalizeMonthLabel(
    formatter.format(startDate.add({ months: count - 1 }).toDate(timeZone)),
    locale
  )
  return start === end ? start : `${start} – ${end}`
}

const normalizeDate = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

export const isWithinBounds = (date: Date, min?: Date, max?: Date) => {
  const value = normalizeDate(date).getTime()
  if (min && value < normalizeDate(min).getTime()) return false
  if (max && value > normalizeDate(max).getTime()) return false
  return true
}

export const isWithinDateTimeBounds = (date: Date, min?: Date, max?: Date) => {
  const value = date.getTime()
  if (min && value < min.getTime()) return false
  if (max && value > max.getTime()) return false
  return true
}

export const violatesDateUnavailable = (
  date: Date,
  predicate?: (date: Date) => boolean
) => predicate?.(date) ?? false
