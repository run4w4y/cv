import { CvAnalyticsCrud } from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'

import { RegistryBadRequestError } from '../errors'
import { registryNow } from '../internal/shared'
import {
  CvAnalyticsService,
  type CvAnalyticsService as CvAnalyticsServiceShape,
  CvAnalyticsTrafficSource,
} from '../services/cv-analytics'
import type {
  CvAnalyticsCountry,
  CvAnalyticsItem,
  CvAnalyticsRangeInput,
  CvAnalyticsSeriesPoint,
  CvAnalyticsTotals,
  CvAnalyticsTrafficCapabilities,
  CvAnalyticsTrafficData,
} from '../types'

const emptyTotals = (): CvAnalyticsTotals => ({ pageViews: 0, visits: 0 })
const dayMs = 24 * 60 * 60 * 1000
const defaultRangeDays = 7

const addTotals = (
  target: CvAnalyticsTotals,
  source: CvAnalyticsTotals
): CvAnalyticsTotals => ({
  pageViews: target.pageViews + source.pageViews,
  visits: target.visits + source.visits,
})

const sortedCountries = (
  countries: Readonly<Record<string, number>>
): readonly CvAnalyticsCountry[] =>
  Object.entries(countries)
    .map(([name, visits]) => ({ name, visits }))
    .sort(
      (left, right) =>
        right.visits - left.visits || left.name.localeCompare(right.name)
    )

const mergeSeries = (
  series: ReadonlyArray<readonly CvAnalyticsSeriesPoint[]>
): readonly CvAnalyticsSeriesPoint[] => {
  const totalsByDate = new Map<string, CvAnalyticsTotals>()

  for (const points of series) {
    for (const point of points) {
      totalsByDate.set(
        point.at,
        addTotals(totalsByDate.get(point.at) ?? emptyTotals(), point)
      )
    }
  }

  return [...totalsByDate.entries()]
    .map(([at, totals]) => ({ at, ...totals }))
    .sort((left, right) => left.at.localeCompare(right.at))
}

const rangeDays = (range: {
  readonly from: string
  readonly to: string
}): readonly string[] => {
  const from = new Date(range.from)
  const to = Date.parse(range.to)
  if (
    Number.isNaN(from.getTime()) ||
    Number.isNaN(to) ||
    to <= from.getTime()
  ) {
    return []
  }

  const days: string[] = []
  let cursor = Date.UTC(
    from.getUTCFullYear(),
    from.getUTCMonth(),
    from.getUTCDate()
  )
  while (cursor < to) {
    days.push(new Date(cursor).toISOString().slice(0, 10))
    cursor += dayMs
  }
  return days
}

const fillSeries = (
  series: readonly CvAnalyticsSeriesPoint[],
  range: { readonly from: string; readonly to: string }
): readonly CvAnalyticsSeriesPoint[] => {
  const totalsByDate = new Map(series.map((point) => [point.at, point]))
  return rangeDays(range).map((at) => ({
    at,
    ...(totalsByDate.get(at) ?? emptyTotals()),
  }))
}

const mergeCountries = (
  countries: ReadonlyArray<Readonly<Record<string, number>>>
): readonly CvAnalyticsCountry[] => {
  const totals = new Map<string, number>()

  for (const counts of countries) {
    for (const [name, visits] of Object.entries(counts)) {
      totals.set(name, (totals.get(name) ?? 0) + visits)
    }
  }

  return sortedCountries(Object.fromEntries(totals))
}

const utcDayStart = (timestamp: number) => {
  const date = new Date(timestamp)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

const utcDayCeiling = (timestamp: number) => {
  const start = utcDayStart(timestamp)
  return start === timestamp ? start : start + dayMs
}

const formatAnalyticsDate = (timestamp: number) =>
  new Date(timestamp).toISOString().slice(0, 10)

const parseAnalyticsDate = (value: string) => {
  const timestamp = Date.parse(`${value}T00:00:00.000Z`)
  return Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
    ? timestamp
    : undefined
}

const invalidRange = (message: string) =>
  Effect.fail(new RegistryBadRequestError({ message }))

const requestedRange = (
  now: string,
  input: CvAnalyticsRangeInput,
  capabilities: CvAnalyticsTrafficCapabilities
): Effect.Effect<
  {
    readonly availability: { readonly from: string; readonly to: string }
    readonly range: { readonly from: string; readonly to: string }
  },
  RegistryBadRequestError
> =>
  Effect.suspend(() => {
    const nowTimestamp = Date.parse(now)
    if (!Number.isFinite(nowTimestamp)) {
      return invalidRange('The analytics clock is invalid.')
    }

    const hasFrom = input.from !== undefined
    const hasTo = input.to !== undefined
    if (hasFrom !== hasTo) {
      return invalidRange(
        'A custom analytics range requires both a start and an end date.'
      )
    }
    if (input.days !== undefined && hasFrom) {
      return invalidRange(
        'Choose either a preset or a custom analytics range, not both.'
      )
    }

    const today = utcDayStart(nowTimestamp)
    const earliest = utcDayCeiling(nowTimestamp - capabilities.retentionMs)
    if (earliest > today) {
      return invalidRange(
        'The analytics provider does not expose a complete UTC calendar day.'
      )
    }
    const availability = {
      from: formatAnalyticsDate(earliest),
      to: formatAnalyticsDate(today),
    }

    if (!hasFrom || input.from === undefined || input.to === undefined) {
      const availableDays = (today - earliest) / dayMs + 1
      const days = input.days ?? Math.min(defaultRangeDays, availableDays)
      const from = today - (days - 1) * dayMs
      if (from < earliest) {
        return invalidRange(
          `Analytics are available from ${availability.from} through ${availability.to}.`
        )
      }
      return Effect.succeed({
        availability,
        range: {
          from: new Date(from).toISOString(),
          to: now,
        },
      })
    }

    const from = parseAnalyticsDate(input.from)
    const to = parseAnalyticsDate(input.to)
    if (from === undefined || to === undefined) {
      return invalidRange('Analytics ranges must use valid calendar dates.')
    }
    if (to < from) {
      return invalidRange(
        'The analytics range end must not be before its start.'
      )
    }
    if (from < earliest) {
      return invalidRange(
        `Analytics are available from ${availability.from} through ${availability.to}.`
      )
    }
    if (to > today) {
      return invalidRange('The analytics range cannot include future dates.')
    }

    const effectiveTo = Math.min(to + dayMs, nowTimestamp)
    if (effectiveTo <= from) {
      return invalidRange('The analytics range must begin before now.')
    }

    return Effect.succeed({
      availability,
      range: {
        from: new Date(from).toISOString(),
        to: new Date(effectiveTo).toISOString(),
      },
    })
  })

const emptyTraffic = (
  generatedAt: string,
  range: { readonly from: string; readonly to: string }
): CvAnalyticsTrafficData => ({
  generatedAt,
  range: { ...range, granularity: 'day' },
  records: [],
})

const make = Effect.gen(function* () {
  const analytics = yield* CvAnalyticsCrud
  const trafficSource = yield* CvAnalyticsTrafficSource

  return {
    read: Effect.fn('CvAnalyticsService.read')(function* (input) {
      const now = yield* registryNow
      const capabilities = yield* trafficSource.capabilities()
      const requested = yield* requestedRange(now, input, capabilities)
      const { availability, range } = requested
      const links = yield* analytics.listLinks()
      const traffic =
        links.length === 0
          ? emptyTraffic(now, range)
          : yield* trafficSource.read(
              links.map(({ link }) => ({
                key: link.id,
                path: `/c/${encodeURIComponent(link.token)}`,
              })),
              range
            )
      const trafficByLink = new Map(
        traffic.records.map((record) => [record.key, record])
      )
      const items: CvAnalyticsItem[] = links.map((record) => {
        const itemTraffic = trafficByLink.get(record.link.id)
        const observedSeries = itemTraffic?.series ?? []
        const observedTraffic = observedSeries.filter(
          ({ pageViews, visits }) => pageViews > 0 || visits > 0
        )
        const series = fillSeries(observedSeries, traffic.range)
        const totals = itemTraffic?.totals ?? emptyTotals()

        return {
          application: record.application,
          countries: sortedCountries(itemTraffic?.countries ?? {}),
          firstSeenOn: observedTraffic.at(0)?.at ?? null,
          labels: record.labels,
          lastSeenOn: observedTraffic.at(-1)?.at ?? null,
          link: {
            contentEntryId: record.link.contentEntryId,
            createdAt: record.link.createdAt,
            enabled: record.link.enabled,
            id: record.link.id,
            locale: record.locale,
            updatedAt: record.link.updatedAt,
          },
          series,
          totals,
        }
      })

      items.sort(
        (left, right) =>
          right.totals.pageViews - left.totals.pageViews ||
          left.application.company.localeCompare(right.application.company) ||
          left.application.role.localeCompare(right.application.role)
      )

      const totals = items.reduce(
        (current, item) => addTotals(current, item.totals),
        emptyTotals()
      )
      const viewedLinks = items.filter(
        ({ totals: itemTotals }) => itemTotals.pageViews > 0
      ).length

      return {
        availability,
        countries: mergeCountries(
          traffic.records.map((record) => record.countries)
        ),
        generatedAt: traffic.generatedAt,
        items,
        range: traffic.range,
        series: fillSeries(
          mergeSeries(items.map((item) => item.series)),
          traffic.range
        ),
        summary: {
          enabledLinks: items.filter(({ link }) => link.enabled).length,
          pageViews: totals.pageViews,
          publishedLinks: items.length,
          unviewedLinks: items.length - viewedLinks,
          viewedLinks,
          visits: totals.visits,
        },
      }
    }),
  } satisfies CvAnalyticsServiceShape
})

export const CvAnalyticsServiceLive = Layer.effect(CvAnalyticsService, make)
