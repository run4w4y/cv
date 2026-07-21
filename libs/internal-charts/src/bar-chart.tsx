import { cn } from '@cv/internal-ui'
import { useId } from 'react'

import {
  createChartTicks,
  createLinearScale,
  DEFAULT_CHART_BOUNDS,
  getNiceDomain,
  getNumericExtent,
} from './chart-geometry'
import {
  ChartDataTable,
  ChartEmptyState,
  ChartLegend,
} from './chart-primitives'
import {
  type BarDatum,
  type ChartDatum,
  type ChartValueFormatter,
  chartCssVars,
  defaultChartColors,
  formatChartValue,
  formatCompactChartValue,
} from './chart-types'

export interface BarChartProps {
  readonly ariaLabel: string
  readonly className?: string
  readonly data: readonly BarDatum[]
  readonly description?: string
  readonly emptyMessage?: string
  readonly showGrid?: boolean
  readonly showLegend?: boolean
  readonly valueFormat?: ChartValueFormatter
}

const truncateAxisLabel = (label: string) =>
  label.length > 14 ? `${label.slice(0, 13)}…` : label

export const BarChart = ({
  ariaLabel,
  className,
  data,
  description = 'Values compared across categories.',
  emptyMessage,
  showGrid = true,
  showLegend = true,
  valueFormat = formatChartValue,
}: BarChartProps) => {
  const descriptionId = useId()
  const { height, margin, width } = DEFAULT_CHART_BOUNDS
  const plotLeft = margin.left
  const plotRight = width - margin.right
  const plotTop = margin.top
  const plotBottom = height - margin.bottom
  const valueDomain = getNumericExtent(data.map(({ value }) => value))

  if (!valueDomain || data.length === 0) {
    return (
      <figure className={className} data-slot="bar-chart">
        <ChartEmptyState message={emptyMessage} />
      </figure>
    )
  }

  const domain = getNiceDomain(valueDomain)
  const yScale = createLinearScale(domain, plotBottom, plotTop)
  const baseline = yScale(Math.min(domain.maximum, Math.max(domain.minimum, 0)))
  const yTicks = createChartTicks(domain)
  const slotWidth = (plotRight - plotLeft) / data.length
  const barWidth = Math.max(2, Math.min(56, slotWidth * 0.64))
  const rows: readonly ChartDatum[] = data.map(({ id, label, value }) => ({
    category: label,
    id,
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
      className={cn('flex min-w-0 flex-col gap-3', className)}
      data-slot="bar-chart"
    >
      <section
        aria-label={`${ariaLabel} plot`}
        className="max-w-full overflow-x-auto pb-1"
        data-slot="chart-scroll-area"
      >
        <svg
          aria-describedby={descriptionId}
          aria-label={ariaLabel}
          className="h-auto min-w-180 w-full overflow-visible"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          viewBox={`0 0 ${width} ${height}`}
        >
          <desc id={descriptionId}>{description}</desc>

          {showGrid
            ? yTicks.map((tick) => {
                const y = yScale(tick)
                return (
                  <line
                    key={tick}
                    stroke={chartCssVars.grid}
                    strokeWidth="1"
                    x1={plotLeft}
                    x2={plotRight}
                    y1={y}
                    y2={y}
                  />
                )
              })
            : null}

          {yTicks.map((tick) => (
            <text
              fill={chartCssVars.axis}
              fontSize="11"
              key={tick}
              textAnchor="end"
              x={plotLeft - 10}
              y={yScale(tick) + 4}
            >
              {formatCompactChartValue(tick)}
            </text>
          ))}

          {data.map((item, index) => {
            const centerX = plotLeft + slotWidth * index + slotWidth / 2
            const valueY = yScale(item.value)
            const rectY = Math.min(valueY, baseline)
            const rectHeight = Math.max(1, Math.abs(baseline - valueY))
            const color =
              item.color ??
              defaultChartColors[index % defaultChartColors.length]
            const label = `${item.label}: ${valueFormat(item.value)}`

            return (
              <g
                aria-label={label}
                className="group outline-none"
                key={item.id ?? `${item.label}-${index}`}
                tabIndex={0}
              >
                <rect
                  className="transition-opacity group-hover:opacity-80 group-focus-visible:stroke-chart-focus group-focus-visible:stroke-2"
                  fill={color}
                  height={rectHeight}
                  rx="5"
                  width={barWidth}
                  x={centerX - barWidth / 2}
                  y={rectY}
                />
                <text
                  fill={chartCssVars.axis}
                  fontSize="11"
                  textAnchor="middle"
                  x={centerX}
                  y={plotBottom + 26}
                >
                  {truncateAxisLabel(item.label)}
                </text>
                {data.length <= 12 ? (
                  <text
                    fill="var(--foreground)"
                    fontSize="11"
                    fontWeight="600"
                    textAnchor="middle"
                    x={centerX}
                    y={item.value >= 0 ? rectY - 7 : rectY + rectHeight + 14}
                  >
                    {formatCompactChartValue(item.value)}
                  </text>
                ) : null}
                <title>{label}</title>
              </g>
            )
          })}
        </svg>
      </section>

      {showLegend ? (
        <ChartLegend items={legendItems} valueFormat={valueFormat} />
      ) : null}
      <ChartDataTable
        caption={ariaLabel}
        columns={[
          { key: 'category', label: 'Category' },
          {
            key: 'value',
            label: 'Value',
            format: (value) =>
              typeof value === 'number' ? valueFormat(value) : '—',
          },
        ]}
        rows={rows}
      />
    </figure>
  )
}
