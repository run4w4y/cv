import { isPlainObject } from 'es-toolkit/predicate'
import type { AnalyticsTotals } from './types'

export const emptyTotals = (): AnalyticsTotals => ({
  pageViews: 0,
  visits: 0,
})

export const positiveInteger = (value: unknown) => {
  const numberValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : 0

  return Number.isFinite(numberValue) && numberValue > 0
    ? Math.round(numberValue)
    : 0
}

export const addTotals = (
  target: AnalyticsTotals,
  source: Partial<AnalyticsTotals>
) => {
  target.pageViews += positiveInteger(source.pageViews)
  target.visits += positiveInteger(source.visits)
}

export const readMetric = (
  record: Record<string, unknown>,
  paths: string[][]
): number => {
  for (const path of paths) {
    let cursor: unknown = record

    for (const segment of path) {
      if (!isPlainObject(cursor)) {
        cursor = undefined
        break
      }

      cursor = cursor[segment]
    }

    const value = positiveInteger(cursor)

    if (value > 0) {
      return value
    }
  }

  return 0
}

export const readTotalsFromRecord = (record: Record<string, unknown>) => {
  const count = positiveInteger(record.count)
  const pageViews =
    count ||
    readMetric(record, [
      ['sum', 'pageViews'],
      ['sum', 'pageviews'],
      ['sum', 'requests'],
      ['pageViews'],
      ['pageviews'],
      ['requests'],
      ['views'],
    ])
  const visits =
    readMetric(record, [['sum', 'visits'], ['visits'], ['sessions']]) ||
    pageViews

  return { pageViews, visits } satisfies AnalyticsTotals
}
