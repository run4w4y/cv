import { describe, expect, test } from 'bun:test'
import {
  CvAnalyticsCrud,
  type CvAnalyticsLinkRecord,
} from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'
import { TestClock } from 'effect/testing'

import { RegistryAnalyticsError } from '../errors'
import {
  CvAnalyticsService,
  CvAnalyticsTrafficSource,
} from '../services/cv-analytics'
import { CvAnalyticsServiceLive } from './cv-analytics'

const now = '2026-07-19T12:00:00.000Z'

const linkRecord = (
  id: string,
  company: string,
  enabled: boolean
): CvAnalyticsLinkRecord => ({
  application: {
    appliedAt: null,
    applicationStatus: 'preparing',
    canonicalUrl: `https://example.test/jobs/${id}`,
    company,
    createdAt: '2026-07-01T00:00:00.000Z',
    id: `application-${id}`,
    listingAvailability: 'open',
    role: 'Engineer',
  },
  labels: ['priority'],
  link: {
    contentEntryId: `content-${id}`,
    createdAt: '2026-07-10T00:00:00.000Z',
    enabled,
    id,
    publishedRevisionId: `revision-${id}`,
    token: `secret-${id}`,
    updatedAt: '2026-07-11T00:00:00.000Z',
  },
  locale: 'en',
})

const live = (
  read: CvAnalyticsTrafficSource['read'],
  records: readonly CvAnalyticsLinkRecord[] = [
    linkRecord('link-a', 'Alpha', true),
    linkRecord('link-b', 'Beta', false),
  ]
) =>
  CvAnalyticsServiceLive.pipe(
    Layer.provide(
      Layer.succeed(CvAnalyticsCrud, {
        listLinks: () => Effect.succeed(records),
      })
    ),
    Layer.provide(Layer.succeed(CvAnalyticsTrafficSource, { read }))
  )

describe('CvAnalyticsService', () => {
  test('joins link traffic to application data and keeps zero-view links', async () => {
    let observedAliases:
      | readonly { readonly key: string; readonly path: string }[]
      | undefined
    let observedRange:
      | { readonly from: string; readonly to: string }
      | undefined

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.parse(now))
        return yield* CvAnalyticsService.use((service) => service.read({}))
      }).pipe(
        Effect.provide([
          live((aliases, range) => {
            observedAliases = aliases
            observedRange = range
            return Effect.succeed({
              generatedAt: now,
              range: { ...range, granularity: 'day' as const },
              records: [
                {
                  countries: { DE: 2, US: 1 },
                  key: 'link-a',
                  series: [
                    { at: '2026-07-17', pageViews: 3, visits: 2 },
                    { at: '2026-07-19', pageViews: 2, visits: 1 },
                  ],
                  totals: { pageViews: 5, visits: 3 },
                },
              ],
            })
          }),
          TestClock.layer(),
        ])
      )
    )

    expect(observedAliases).toEqual([
      { key: 'link-a', path: '/c/secret-link-a' },
      { key: 'link-b', path: '/c/secret-link-b' },
    ])
    expect(observedRange).toEqual({
      from: '2026-07-12T12:00:00.000Z',
      to: now,
    })
    expect(result.summary).toEqual({
      enabledLinks: 1,
      pageViews: 5,
      publishedLinks: 2,
      unviewedLinks: 1,
      viewedLinks: 1,
      visits: 3,
    })
    expect(result.items.map(({ link, totals }) => ({ link, totals }))).toEqual([
      {
        link: expect.objectContaining({ enabled: true, id: 'link-a' }),
        totals: { pageViews: 5, visits: 3 },
      },
      {
        link: expect.objectContaining({ enabled: false, id: 'link-b' }),
        totals: { pageViews: 0, visits: 0 },
      },
    ])
    expect(result.countries).toEqual([
      { name: 'DE', visits: 2 },
      { name: 'US', visits: 1 },
    ])
    expect(result.series).toEqual([
      { at: '2026-07-12', pageViews: 0, visits: 0 },
      { at: '2026-07-13', pageViews: 0, visits: 0 },
      { at: '2026-07-14', pageViews: 0, visits: 0 },
      { at: '2026-07-15', pageViews: 0, visits: 0 },
      { at: '2026-07-16', pageViews: 0, visits: 0 },
      { at: '2026-07-17', pageViews: 3, visits: 2 },
      { at: '2026-07-18', pageViews: 0, visits: 0 },
      { at: '2026-07-19', pageViews: 2, visits: 1 },
    ])
    expect(
      result.items.map(({ firstSeenOn, lastSeenOn }) => ({
        firstSeenOn,
        lastSeenOn,
      }))
    ).toEqual([
      { firstSeenOn: '2026-07-17', lastSeenOn: '2026-07-19' },
      { firstSeenOn: null, lastSeenOn: null },
    ])
    expect(JSON.stringify(result)).not.toContain('secret-link')
    expect(JSON.stringify(result)).not.toContain('/c/')
  })

  test('preserves analytics-provider failures', async () => {
    const failure = new RegistryAnalyticsError({
      cause: new Error('provider unavailable'),
      message: 'CV traffic analytics are currently unavailable.',
    })

    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.parse(now))
        return yield* Effect.exit(
          CvAnalyticsService.use((service) => service.read({ days: 1 }))
        )
      }).pipe(
        Effect.provide([
          live(() => Effect.fail(failure), [linkRecord('a', 'A', true)]),
          TestClock.layer(),
        ])
      )
    )

    expect(exit._tag).toBe('Failure')
    expect(exit.toString()).toContain('RegistryAnalyticsError')
  })
})
