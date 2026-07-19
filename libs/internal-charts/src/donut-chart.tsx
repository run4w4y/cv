import { cn } from '@cv/internal-ui'
import { useId } from 'react'

import { buildDonutArc } from './chart-geometry'
import {
  ChartDataTable,
  ChartEmptyState,
  ChartLegend,
} from './chart-primitives'
import {
  type ChartDatum,
  type ChartValueFormatter,
  type DonutDatum,
  defaultChartColors,
  formatChartValue,
} from './chart-types'

export interface DonutChartProps {
  readonly ariaLabel: string
  readonly centerLabel?: string
  readonly className?: string
  readonly data: readonly DonutDatum[]
  readonly description?: string
  readonly emptyMessage?: string
  readonly showLegend?: boolean
  readonly valueFormat?: ChartValueFormatter
}

const SIZE = 240
const CENTER = SIZE / 2
const OUTER_RADIUS = 104
const INNER_RADIUS = 70
const START_ANGLE = -Math.PI / 2

export const DonutChart = ({
  ariaLabel,
  centerLabel = 'Total',
  className,
  data,
  description = 'Values shown as parts of the total.',
  emptyMessage,
  showLegend = true,
  valueFormat = formatChartValue,
}: DonutChartProps) => {
  const titleId = useId()
  const descriptionId = useId()
  const total = data.reduce(
    (sum, item) =>
      sum + (Number.isFinite(item.value) ? Math.max(0, item.value) : 0),
    0
  )

  if (data.length === 0 || total <= 0) {
    return (
      <figure className={className} data-slot="donut-chart">
        <ChartEmptyState message={emptyMessage} />
      </figure>
    )
  }

  let cursor = START_ANGLE
  const segments = data.flatMap((item, index) => {
    const value = Number.isFinite(item.value) ? Math.max(0, item.value) : 0
    if (value === 0) {
      return []
    }

    const sweep = (value / total) * Math.PI * 2
    const gap = Math.min(0.025, sweep * 0.18)
    const startAngle = cursor + gap
    const endAngle = cursor + sweep - gap
    cursor += sweep

    return [
      {
        color:
          item.color ?? defaultChartColors[index % defaultChartColors.length],
        endAngle,
        item,
        startAngle,
      },
    ]
  })
  const rows: readonly ChartDatum[] = data.map(({ id, label, value }) => ({
    id,
    outcome: label,
    percentage: total > 0 ? (Math.max(0, value) / total) * 100 : 0,
    value,
  }))
  const legendItems = data.map((item, index) => ({
    color: item.color ?? defaultChartColors[index % defaultChartColors.length],
    id: item.id,
    label: item.label,
    value: item.value,
  }))

  return (
    <figure
      className={cn('flex min-w-0 flex-col gap-4', className)}
      data-slot="donut-chart"
    >
      <div className="grid place-items-center">
        <svg
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          className="col-start-1 row-start-1 h-auto w-full max-w-64 overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
        >
          <title id={titleId}>{ariaLabel}</title>
          <desc id={descriptionId}>{description}</desc>
          <circle
            cx={CENTER}
            cy={CENTER}
            fill="none"
            r={(INNER_RADIUS + OUTER_RADIUS) / 2}
            stroke="var(--chart-track)"
            strokeWidth={OUTER_RADIUS - INNER_RADIUS}
          />
          {segments.map(({ color, endAngle, item, startAngle }) => {
            const percentage = (Math.max(0, item.value) / total) * 100
            const label = `${item.label}: ${valueFormat(item.value)}, ${percentage.toFixed(1)}%`
            return (
              <path
                aria-label={label}
                className="outline-none transition-opacity hover:opacity-80 focus-visible:stroke-chart-focus focus-visible:stroke-2"
                d={buildDonutArc({
                  center: CENTER,
                  endAngle,
                  innerRadius: INNER_RADIUS,
                  outerRadius: OUTER_RADIUS,
                  startAngle,
                })}
                fill={color}
                key={item.id ?? item.label}
                tabIndex={0}
              >
                <title>{label}</title>
              </path>
            )
          })}
        </svg>
        <div
          aria-hidden="true"
          className="pointer-events-none col-start-1 row-start-1 flex flex-col items-center gap-1 text-center"
        >
          <span className="text-2xl font-semibold tabular-nums">
            {valueFormat(total)}
          </span>
          <span className="text-xs text-muted-foreground">{centerLabel}</span>
        </div>
      </div>

      {showLegend ? (
        <ChartLegend items={legendItems} valueFormat={valueFormat} />
      ) : null}
      <ChartDataTable
        caption={ariaLabel}
        columns={[
          { key: 'outcome', label: 'Outcome' },
          {
            key: 'value',
            label: 'Value',
            format: (value) =>
              typeof value === 'number' ? valueFormat(value) : '—',
          },
          {
            key: 'percentage',
            label: 'Percentage',
            format: (value) =>
              typeof value === 'number' ? `${value.toFixed(1)}%` : '—',
          },
        ]}
        rows={rows}
      />
    </figure>
  )
}

export const RingChart = DonutChart
export type RingChartProps = DonutChartProps
