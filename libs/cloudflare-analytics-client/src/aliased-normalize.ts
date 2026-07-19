import * as Effect from 'effect/Effect'
import { isPlainObject } from 'es-toolkit/predicate'

import { NormalizeError } from './errors'
import { readArray, readRecord, readString } from './guards'
import type { AliasedPathData, PathAlias, Range } from './types'

type Totals = { pageViews: number; visits: number }

type MutableRecord = {
  countries: Record<string, number>
  key: string
  series: Map<string, Totals>
  totals: Totals
}

const positiveInteger = (value: unknown): number => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim().length > 0
        ? Number(value)
        : 0

  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0
}

const optionalPositiveInteger = (value: unknown): number | undefined =>
  value === undefined || value === null ? undefined : positiveInteger(value)

const readNestedMetric = (
  row: Readonly<Record<string, unknown>>,
  key: string
): number | undefined => {
  const sum = readRecord(row, 'sum')
  return optionalPositiveInteger(sum?.[key] ?? row[key])
}

const readTotals = (row: Readonly<Record<string, unknown>>): Totals => {
  const pageViews =
    optionalPositiveInteger(row.count) ??
    readNestedMetric(row, 'pageViews') ??
    readNestedMetric(row, 'pageviews') ??
    readNestedMetric(row, 'requests') ??
    0
  const visits = readNestedMetric(row, 'visits') ?? pageViews
  return { pageViews, visits }
}

const addTotals = (target: Totals, source: Totals): void => {
  target.pageViews += source.pageViews
  target.visits += source.visits
}

const dimension = (
  row: Readonly<Record<string, unknown>>,
  key: string
): string | undefined => {
  const direct = readString(row, key)
  if (direct) return direct

  const dimensions = readRecord(row, 'dimensions')
  return dimensions ? readString(dimensions, key) : undefined
}

const zoneRows = (
  payload: unknown,
  key: 'dailyPaths' | 'topPaths'
): ReadonlyArray<Record<string, unknown>> => {
  if (!isPlainObject(payload)) return []
  const data = readRecord(payload, 'data')
  const viewer = data ? readRecord(data, 'viewer') : undefined
  const zones = viewer ? readArray(viewer, 'zones') : []

  return zones.flatMap((zone) =>
    isPlainObject(zone) ? readArray(zone, key).filter(isPlainObject) : []
  )
}

const analyticsRows = (
  payload: unknown
): ReadonlyArray<Record<string, unknown>> => {
  const daily = zoneRows(payload, 'dailyPaths')
  return daily.length > 0 ? daily : zoneRows(payload, 'topPaths')
}

const sortedCounts = (counts: Readonly<Record<string, number>>) =>
  Object.fromEntries(
    Object.entries(counts).sort(
      ([leftKey, leftValue], [rightKey, rightValue]) =>
        rightValue - leftValue || leftKey.localeCompare(rightKey)
    )
  )

const validateAliases = (aliases: ReadonlyArray<PathAlias>) => {
  const paths = new Set<string>()
  const keys = new Set<string>()

  for (const alias of aliases) {
    if (!alias.key.trim() || !alias.path.startsWith('/')) {
      throw new Error(
        'Cloudflare analytics aliases require a key and absolute path.'
      )
    }
    if (paths.has(alias.path) || keys.has(alias.key)) {
      throw new Error(
        'Cloudflare analytics aliases must use unique keys and paths.'
      )
    }
    paths.add(alias.path)
    keys.add(alias.key)
  }
}

export const normalizeAliasedPaths = (
  payloads: readonly unknown[],
  range: Range,
  aliases: ReadonlyArray<PathAlias>
) =>
  Effect.try({
    try: (): AliasedPathData => {
      validateAliases(aliases)
      const aliasByPath = new Map(aliases.map((alias) => [alias.path, alias]))
      const records = new Map<string, MutableRecord>(
        aliases.map(({ key }) => [
          key,
          {
            countries: {},
            key,
            series: new Map(),
            totals: { pageViews: 0, visits: 0 },
          },
        ])
      )

      for (const row of payloads.flatMap(analyticsRows)) {
        const path = dimension(row, 'clientRequestPath')
        const alias = path ? aliasByPath.get(path) : undefined
        if (!alias) continue

        const record = records.get(alias.key)
        if (!record) continue
        const totals = readTotals(row)
        addTotals(record.totals, totals)

        const at = dimension(row, 'datetimeDay')
        if (at) {
          const point = record.series.get(at) ?? { pageViews: 0, visits: 0 }
          addTotals(point, totals)
          record.series.set(at, point)
        }

        const country = dimension(row, 'clientCountryName')?.trim()
        if (country && country.length <= 80 && totals.visits > 0) {
          record.countries[country] =
            (record.countries[country] ?? 0) + totals.visits
        }
      }

      return {
        generatedAt: new Date().toISOString(),
        range: { from: range.from, granularity: 'day', to: range.to },
        records: [...records.values()].map((record) => ({
          countries: sortedCounts(record.countries),
          key: record.key,
          series: [...record.series.entries()]
            .map(([at, totals]) => ({ at, ...totals }))
            .sort((left, right) => left.at.localeCompare(right.at)),
          totals: record.totals,
        })),
      }
    },
    catch: (cause) =>
      NormalizeError.fromCause({
        cause,
        message: 'Cloudflare aliased path analytics could not be normalized',
      }),
  })
