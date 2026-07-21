import { cn } from '@cv/internal-ui'
import { useId, useMemo } from 'react'

import {
  buildAreaPath,
  buildLinePath,
  type ChartPoint,
  createChartTicks,
  createLinearScale,
  DEFAULT_CHART_BOUNDS,
  getNiceDomain,
  getNumericExtent,
  isFiniteNumber,
  toChartTimestamp,
} from './chart-geometry'
import {
  ChartDataTable,
  ChartEmptyState,
  ChartLegend,
} from './chart-primitives'
import {
  type ChartDatum,
  type ChartSeries,
  type ChartValueFormatter,
  chartCssVars,
  defaultChartColors,
  formatChartDate,
  formatChartValue,
  formatCompactChartValue,
} from './chart-types'

interface SeriesPoint extends ChartPoint {
  readonly datumIndex: number
  readonly value: number
}

interface PositionedSeries extends ChartSeries {
  readonly color: string
  readonly segments: readonly (readonly SeriesPoint[])[]
}

export interface TimelineChartProps {
  readonly ariaLabel: string
  readonly className?: string
  readonly data: readonly ChartDatum[]
  readonly description?: string
  readonly emptyWhenAllZero?: boolean
  readonly emptyMessage?: string
  readonly series: readonly ChartSeries[]
  readonly showGrid?: boolean
  readonly showLegend?: boolean
  readonly valueFormat?: ChartValueFormatter
  readonly xDataKey?: string
  readonly xTickFormat?: (value: unknown) => string
}

const getSampledIndexes = (
  length: number,
  count: number
): readonly number[] => {
  if (length <= count) {
    return Array.from({ length }, (_, index) => index)
  }

  return Array.from(
    new Set(
      Array.from({ length: count }, (_, index) =>
        Math.round((index * (length - 1)) / (count - 1))
      )
    )
  )
}

const buildSegments = (
  data: readonly ChartDatum[],
  dataKey: string,
  xScale: (value: number) => number,
  yScale: (value: number) => number,
  xDataKey: string
): readonly (readonly SeriesPoint[])[] => {
  const segments: SeriesPoint[][] = []
  let current: SeriesPoint[] = []

  data.forEach((datum, datumIndex) => {
    const value = datum[dataKey]
    if (!isFiniteNumber(value)) {
      if (current.length > 0) {
        segments.push(current)
        current = []
      }
      return
    }

    current.push({
      datumIndex,
      value,
      x: xScale(toChartTimestamp(datum[xDataKey], datumIndex)),
      y: yScale(value),
    })
  })

  if (current.length > 0) {
    segments.push(current)
  }

  return segments
}

export const TimelineChart = ({
  ariaLabel,
  className,
  data,
  description = 'Values plotted over the selected time period.',
  emptyWhenAllZero = false,
  emptyMessage,
  series,
  showGrid = true,
  showLegend = true,
  valueFormat = formatChartValue,
  xDataKey = 'date',
  xTickFormat = formatChartDate,
}: TimelineChartProps) => {
  const descriptionId = useId()
  const gradientPrefix = useId().replaceAll(':', '')
  const { height, margin, width } = DEFAULT_CHART_BOUNDS
  const plotLeft = margin.left
  const plotRight = width - margin.right
  const plotTop = margin.top
  const plotBottom = height - margin.bottom

  const values = useMemo(
    () =>
      data.flatMap((datum) =>
        series.flatMap(({ dataKey }) => {
          const value = datum[dataKey]
          return isFiniteNumber(value) ? [value] : []
        })
      ),
    [data, series]
  )
  const valueDomain = getNumericExtent(values)
  const xDomain = getNumericExtent(
    data.map((datum, index) => toChartTimestamp(datum[xDataKey], index)),
    false
  )
  const onlyZeroValues =
    values.length > 0 && values.every((value) => value === 0)

  if (
    !valueDomain ||
    !xDomain ||
    data.length === 0 ||
    series.length === 0 ||
    (emptyWhenAllZero && onlyZeroValues)
  ) {
    return (
      <figure className={className} data-slot="timeline-chart">
        <ChartEmptyState message={emptyMessage} />
      </figure>
    )
  }

  const yDomain = getNiceDomain(valueDomain)
  const xScale = createLinearScale(xDomain, plotLeft, plotRight)
  const yScale = createLinearScale(yDomain, plotBottom, plotTop)
  const baseline = yScale(
    Math.min(yDomain.maximum, Math.max(yDomain.minimum, 0))
  )
  const positionedSeries: readonly PositionedSeries[] = series.map(
    (item, index) => ({
      ...item,
      color:
        item.color ?? defaultChartColors[index % defaultChartColors.length],
      segments: buildSegments(data, item.dataKey, xScale, yScale, xDataKey),
    })
  )
  const yTicks = createChartTicks(yDomain)
  const xTickIndexes = getSampledIndexes(data.length, 7)
  const legendItems = positionedSeries.map(({ color, label }) => ({
    color,
    label,
  }))

  return (
    <figure
      className={cn('flex min-w-0 flex-col gap-3', className)}
      data-slot="timeline-chart"
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
          <defs>
            {positionedSeries.map(({ color, dataKey }, index) => (
              <linearGradient
                id={`${gradientPrefix}-area-${index}`}
                key={dataKey}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={color} stopOpacity="0.03" />
              </linearGradient>
            ))}
          </defs>

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

          {xTickIndexes.map((index) => {
            const datum = data[index]
            if (!datum) {
              return null
            }
            const x = xScale(toChartTimestamp(datum[xDataKey], index))
            return (
              <text
                fill={chartCssVars.axis}
                fontSize="11"
                key={index}
                textAnchor="middle"
                x={x}
                y={plotBottom + 26}
              >
                {xTickFormat(datum[xDataKey])}
              </text>
            )
          })}

          {positionedSeries.flatMap((item, seriesIndex) =>
            item.area
              ? item.segments.map((points, segmentIndex) => (
                  <path
                    d={buildAreaPath(points, baseline)}
                    fill={`url(#${gradientPrefix}-area-${seriesIndex})`}
                    key={`${item.dataKey}-area-${points.at(0)?.datumIndex ?? segmentIndex}`}
                  />
                ))
              : []
          )}

          {positionedSeries.flatMap((item) =>
            item.segments.map((points, segmentIndex) => (
              <path
                d={buildLinePath(points)}
                fill="none"
                key={`${item.dataKey}-line-${points.at(0)?.datumIndex ?? segmentIndex}`}
                stroke={item.color}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
            ))
          )}

          {positionedSeries.flatMap((item) =>
            item.segments.flatMap((points) =>
              points.map((point) => {
                const datum = data[point.datumIndex]
                const xLabel = xTickFormat(datum?.[xDataKey])
                return (
                  <g
                    aria-label={`${item.label}, ${xLabel}: ${valueFormat(point.value)}`}
                    className="group outline-none"
                    key={`${item.dataKey}-${point.datumIndex}`}
                    tabIndex={0}
                  >
                    <circle
                      cx={point.x}
                      cy={point.y}
                      fill="transparent"
                      r="10"
                    />
                    <circle
                      className="transition-[r] group-focus-visible:stroke-chart-focus group-focus-visible:stroke-2"
                      cx={point.x}
                      cy={point.y}
                      fill={item.color}
                      r="3"
                      stroke="var(--background)"
                      strokeWidth="1.5"
                      vectorEffect="non-scaling-stroke"
                    />
                    <title>{`${item.label}, ${xLabel}: ${valueFormat(point.value)}`}</title>
                  </g>
                )
              })
            )
          )}
        </svg>
      </section>

      {showLegend ? <ChartLegend items={legendItems} /> : null}
      <ChartDataTable
        caption={ariaLabel}
        columns={[
          { key: xDataKey, label: 'Date', format: xTickFormat },
          ...series.map((item) => ({
            key: item.dataKey,
            label: item.label,
            format: (value: unknown) =>
              isFiniteNumber(value) ? valueFormat(value) : '—',
          })),
        ]}
        rows={data}
      />
    </figure>
  )
}
