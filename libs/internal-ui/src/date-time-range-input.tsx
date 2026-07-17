import type { DateRange } from './calendar-utils'
import type { CalendarOptionProps } from './date-picker'
import { DateRangeField } from './date-range-input'

export interface DateTimeRangeInputProps extends CalendarOptionProps {
  readonly value?: DateRange
  readonly defaultValue?: DateRange
  readonly onChange?: (value: DateRange | undefined) => void
  readonly disabled?: boolean
  readonly className?: string
  readonly popoverClassName?: string
  readonly startAriaLabel?: string
  readonly endAriaLabel?: string
}

export const DateTimeRangeInput = (props: DateTimeRangeInputProps) => (
  <DateRangeField {...props} granularity="minute" />
)
