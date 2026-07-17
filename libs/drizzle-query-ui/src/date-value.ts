import type { FilterValueDescriptor } from '@cv/drizzle-query'
import type { DateRange } from '@cv/internal-ui'

export const dateFromFilterValue = (value: unknown): Date | undefined => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value
  }
  if (typeof value !== 'string' || value.length === 0) return undefined

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? undefined : parsed
}

export const filterValueFromDate = (value?: Date): string =>
  value && !Number.isNaN(value.getTime()) ? value.toISOString() : ''

type DateRangeDescriptor = {
  readonly type: 'tuple'
  readonly items: readonly [
    { readonly type: 'date' },
    { readonly type: 'date' },
  ]
}

export const isDateRangeDescriptor = (
  descriptor: FilterValueDescriptor
): descriptor is DateRangeDescriptor =>
  descriptor.type === 'tuple' &&
  descriptor.items.length === 2 &&
  descriptor.items.every((item) => item.type === 'date')

export const dateRangeFromFilterValue = (value: unknown): DateRange => {
  const values = Array.isArray(value) ? value : []
  return {
    from: dateFromFilterValue(values[0]),
    to: dateFromFilterValue(values[1]),
  }
}

export const filterValueFromDateRange = (
  value?: DateRange
): readonly [string, string] => [
  filterValueFromDate(value?.from),
  filterValueFromDate(value?.to),
]

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

export const dateFilterValueLabel = (value: unknown): string | undefined => {
  const date = dateFromFilterValue(value)
  return date ? dateTimeFormatter.format(date) : undefined
}
