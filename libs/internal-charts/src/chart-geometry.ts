export interface ChartPoint {
  readonly x: number
  readonly y: number
}

export interface ChartMargin {
  readonly bottom: number
  readonly left: number
  readonly right: number
  readonly top: number
}

export interface ChartBounds {
  readonly height: number
  readonly margin: ChartMargin
  readonly width: number
}

export interface ChartDomain {
  readonly maximum: number
  readonly minimum: number
}

export const DEFAULT_CHART_BOUNDS: ChartBounds = {
  width: 720,
  height: 320,
  margin: { top: 24, right: 20, bottom: 44, left: 52 },
}

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const getNumericExtent = (
  values: readonly number[],
  includeZero = true
): ChartDomain | null => {
  let minimum = includeZero ? 0 : Number.POSITIVE_INFINITY
  let maximum = includeZero ? 0 : Number.NEGATIVE_INFINITY
  let hasValue = false

  for (const value of values) {
    if (!Number.isFinite(value)) {
      continue
    }
    minimum = Math.min(minimum, value)
    maximum = Math.max(maximum, value)
    hasValue = true
  }

  if (!hasValue) {
    return null
  }

  if (minimum === maximum) {
    const padding = Math.abs(minimum) * 0.1 || 1
    return { minimum: minimum - padding, maximum: maximum + padding }
  }

  return { minimum, maximum }
}

export const createLinearScale = (
  domain: ChartDomain,
  rangeStart: number,
  rangeEnd: number
) => {
  const domainSize = domain.maximum - domain.minimum
  const rangeSize = rangeEnd - rangeStart

  return (value: number) =>
    rangeStart + ((value - domain.minimum) / domainSize) * rangeSize
}

const getNiceStep = (domain: ChartDomain, count: number): number => {
  const roughStep = (domain.maximum - domain.minimum) / Math.max(1, count - 1)
  const power = 10 ** Math.floor(Math.log10(roughStep))
  const fraction = roughStep / power
  const niceFraction = [1, 2, 2.5, 4, 5, 10].find(
    (candidate) => candidate >= fraction
  )
  return (niceFraction ?? 10) * power
}

export const getNiceDomain = (domain: ChartDomain, count = 5): ChartDomain => {
  const step = getNiceStep(domain, count)
  return {
    minimum: Math.floor(domain.minimum / step) * step,
    maximum: Math.ceil(domain.maximum / step) * step,
  }
}

export const createChartTicks = (
  domain: ChartDomain,
  count = 5
): readonly number[] => {
  if (count <= 1) {
    return [domain.minimum]
  }

  const niceDomain = getNiceDomain(domain, count)
  const step = getNiceStep(domain, count)
  const tickCount =
    Math.round((niceDomain.maximum - niceDomain.minimum) / step) + 1
  return Array.from({ length: tickCount }, (_, index) =>
    Number((niceDomain.minimum + index * step).toPrecision(12))
  )
}

export const toChartTimestamp = (value: unknown, fallback: number): number => {
  if (value instanceof Date) {
    return value.getTime()
  }
  if (isFiniteNumber(value)) {
    return value
  }
  if (typeof value === 'string') {
    const timestamp = Date.parse(value)
    if (Number.isFinite(timestamp)) {
      return timestamp
    }
  }
  return fallback
}

export const buildLinePath = (points: readonly ChartPoint[]): string =>
  points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`
    )
    .join(' ')

export const buildAreaPath = (
  points: readonly ChartPoint[],
  baseline: number
): string => {
  const first = points.at(0)
  const last = points.at(-1)
  if (!first || !last) {
    return ''
  }

  return `${buildLinePath(points)} L ${last.x.toFixed(2)} ${baseline.toFixed(2)} L ${first.x.toFixed(2)} ${baseline.toFixed(2)} Z`
}

export const polarPoint = (
  center: number,
  radius: number,
  angle: number
): ChartPoint => ({
  x: center + radius * Math.cos(angle),
  y: center + radius * Math.sin(angle),
})

export const buildDonutArc = ({
  center,
  endAngle,
  innerRadius,
  outerRadius,
  startAngle,
}: {
  readonly center: number
  readonly endAngle: number
  readonly innerRadius: number
  readonly outerRadius: number
  readonly startAngle: number
}): string => {
  const safeEndAngle = Math.min(endAngle, startAngle + Math.PI * 2 - 0.0001)
  if (safeEndAngle <= startAngle) {
    return ''
  }

  const outerStart = polarPoint(center, outerRadius, startAngle)
  const outerEnd = polarPoint(center, outerRadius, safeEndAngle)
  const innerEnd = polarPoint(center, innerRadius, safeEndAngle)
  const innerStart = polarPoint(center, innerRadius, startAngle)
  const largeArc = safeEndAngle - startAngle > Math.PI ? 1 : 0

  return [
    `M ${outerStart.x.toFixed(3)} ${outerStart.y.toFixed(3)}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x.toFixed(3)} ${outerEnd.y.toFixed(3)}`,
    `L ${innerEnd.x.toFixed(3)} ${innerEnd.y.toFixed(3)}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x.toFixed(3)} ${innerStart.y.toFixed(3)}`,
    'Z',
  ].join(' ')
}
