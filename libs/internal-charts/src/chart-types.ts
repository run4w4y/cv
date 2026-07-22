/** CSS variable references shared by every chart. */
export const chartCssVars = {
  axis: 'var(--chart-axis)',
  focus: 'var(--chart-focus)',
  grid: 'var(--chart-grid)',
  track: 'var(--chart-track)',
  series1: 'var(--chart-1)',
  series2: 'var(--chart-2)',
  series3: 'var(--chart-3)',
  series4: 'var(--chart-4)',
  series5: 'var(--chart-5)',
} as const

export const defaultChartColors = [
  chartCssVars.series1,
  chartCssVars.series2,
  chartCssVars.series3,
  chartCssVars.series4,
  chartCssVars.series5,
] as const

export type ChartDatum = Readonly<Record<string, unknown>>

export type ChartValueFormatter = (value: number) => string

export interface ChartLegendItem {
  readonly color: string
  readonly id?: string
  readonly label: string
  readonly value?: number
}

export interface ChartSeries {
  /** Fill the area between this series and the zero baseline. */
  readonly area?: boolean
  readonly color?: string
  readonly dataKey: string
  readonly label: string
}

export interface BarDatum {
  readonly color?: string
  readonly id?: string
  readonly label: string
  readonly value: number
}

export type DonutDatum = BarDatum

const compactNumberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
  notation: 'compact',
})

const readableNumberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
})

const shortDateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'short',
})

export const formatChartValue: ChartValueFormatter = (value) =>
  readableNumberFormatter.format(value)

export const formatCompactChartValue: ChartValueFormatter = (value) =>
  compactNumberFormatter.format(value)

export const formatChartDate = (value: unknown): string => {
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime())
    ? String(value ?? '')
    : shortDateFormatter.format(date)
}
