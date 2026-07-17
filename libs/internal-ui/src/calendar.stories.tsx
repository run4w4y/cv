import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'

import { Calendar } from './calendar'
import type { DateRange } from './calendar-utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './card'
import { DateInput } from './date-input'
import { DatePicker } from './date-picker'
import { DateRangeInput } from './date-range-input'
import { DateRangePicker } from './date-range-picker'
import { DateTimeInput } from './date-time-input'
import { DateTimeRangeInput } from './date-time-range-input'

const seedDate = new Date(2026, 6, 16, 10, 30)
const seedRange: DateRange = {
  from: new Date(2026, 6, 13, 9, 0),
  to: new Date(2026, 6, 24, 18, 30),
}

const meta = {
  title: 'Date & Time/Calendar',
  component: Calendar,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Calendar>

export default meta
type Story = StoryObj<typeof meta>

export const Single: Story = {
  args: {
    selected: seedDate,
    ariaLabel: 'Application follow-up date',
  },
}

export const Range: Story = {
  args: {
    mode: 'range',
    selected: seedRange,
    numberOfMonths: 2,
    ariaLabel: 'Application activity range',
  },
}

const PickerShowcase = () => {
  const [date, setDate] = React.useState<Date | undefined>(seedDate)
  const [range, setRange] = React.useState<DateRange | undefined>(seedRange)

  return (
    <div className="grid w-[min(44rem,calc(100vw-2rem))] gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Date picker</CardTitle>
          <CardDescription>Compact button-triggered selection.</CardDescription>
        </CardHeader>
        <CardContent>
          <DatePicker value={date} onChange={setDate} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Date range picker</CardTitle>
          <CardDescription>Two-month range selection.</CardDescription>
        </CardHeader>
        <CardContent>
          <DateRangePicker value={range} onChange={setRange} />
        </CardContent>
      </Card>
    </div>
  )
}

export const Pickers: Story = {
  render: () => <PickerShowcase />,
}

const InputShowcase = () => {
  const [date, setDate] = React.useState<Date | undefined>(seedDate)
  const [range, setRange] = React.useState<DateRange | undefined>(seedRange)
  const [dateTime, setDateTime] = React.useState<Date | undefined>(seedDate)
  const [dateTimeRange, setDateTimeRange] = React.useState<
    DateRange | undefined
  >(seedRange)

  return (
    <Card className="w-[min(48rem,calc(100vw-2rem))]">
      <CardHeader>
        <CardTitle>Segmented inputs</CardTitle>
        <CardDescription>
          Locale-aware keyboard editing with calendar selection.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2 md:grid-cols-2">
          <DateInput value={date} onChange={setDate} />
          <DateTimeInput value={dateTime} onChange={setDateTime} />
        </div>
        <DateRangeInput value={range} onChange={setRange} />
        <DateTimeRangeInput value={dateTimeRange} onChange={setDateTimeRange} />
      </CardContent>
    </Card>
  )
}

export const SegmentedInputs: Story = {
  render: () => <InputShowcase />,
}

export const ConstraintsAndStates: Story = {
  render: () => (
    <div className="grid w-[min(42rem,calc(100vw-2rem))] gap-4 md:grid-cols-2">
      <DatePicker
        placeholder="Weekdays only"
        minValue={new Date(2026, 6, 1)}
        maxValue={new Date(2026, 7, 31)}
        isDateUnavailable={(date) => [0, 6].includes(date.getDay())}
      />
      <DatePicker disabled placeholder="Disabled picker" />
      <DateInput disabled defaultValue={seedDate} />
      <DateTimeInput readOnly defaultValue={seedDate} />
    </div>
  ),
}
