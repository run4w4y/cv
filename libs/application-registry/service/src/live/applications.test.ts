import { describe, expect, test } from 'bun:test'
import type {
  ApplicationsCrud,
  PersistedApplication,
  PersistedManagedApplicationUpdate,
} from '@cv/application-registry-crud'
import { FxRates } from '@cv/application-registry-fx'
import { SQLiteDialect } from 'drizzle-orm/sqlite-core'
import { Effect, Layer } from 'effect'
import { TestClock } from 'effect/testing'
import {
  application,
  applicationListRecord,
  compensation,
  recordedAt,
} from '../../test/support/fixtures'
import {
  annotationsCrudLayer,
  applicationsCrudLayer,
  compensationsCrudLayer,
  operationsCrudLayer,
} from '../../test/support/layers'
import { ApplicationsService } from '../services/applications'
import { ApplicationsServiceLive } from './applications'

const live = (applicationLayer = applicationsCrudLayer()) =>
  ApplicationsServiceLive.pipe(
    Layer.provide(applicationLayer),
    Layer.provide(annotationsCrudLayer()),
    Layer.provide(compensationsCrudLayer()),
    Layer.provide(operationsCrudLayer()),
    Layer.provide(
      Layer.succeed(FxRates, {
        get: (baseCurrency, quoteCurrency) =>
          Effect.succeed({
            baseCurrency,
            fetchedAt: recordedAt,
            observedAt: recordedAt,
            provider: 'test',
            quoteCurrency,
            rate: 2,
          }),
      })
    )
  )

describe('ApplicationsService', () => {
  test('resolves and forwards generic application filters', async () => {
    let observedQuery: Parameters<ApplicationsCrud['list']>[0] | undefined
    const page = await Effect.runPromise(
      ApplicationsService.use((service) =>
        service.list({
          filters: [
            {
              type: 'condition',
              field: 'updatedRevision',
              operator: 'gt',
              value: 1,
            },
          ],
          pagination: { size: 10 },
        })
      ).pipe(
        Effect.provide(
          live(
            applicationsCrudLayer({
              list: (query) => {
                observedQuery = query
                return Effect.succeed({
                  items: [applicationListRecord],
                  pageInfo: {
                    kind: 'cursor',
                    size: 10,
                    hasNextPage: false,
                    hasPreviousPage: true,
                    nextCursor: null,
                  },
                })
              },
            })
          )
        )
      )
    )

    expect(observedQuery?.filtering.where).toBeDefined()
    expect(observedQuery?.pagination.size).toBe(10)
    expect(observedQuery?.ordering.terms).toEqual([
      expect.objectContaining({ field: 'updatedRevision', direction: 'asc' }),
    ])
    expect(page.pageInfo.nextCursor).toBeNull()
  })

  test('composes the flat q parameter with canonical filters', async () => {
    let observedQuery: Parameters<ApplicationsCrud['list']>[0] | undefined

    await Effect.runPromise(
      ApplicationsService.use((service) =>
        service.list({
          filters: [
            {
              type: 'condition',
              field: 'applicationStatus',
              operator: 'ne',
              value: 'rejected',
            },
          ],
          q: '  principal  ',
        })
      ).pipe(
        Effect.provide(
          live(
            applicationsCrudLayer({
              list: (query) => {
                observedQuery = query
                return Effect.succeed({
                  items: [],
                  pageInfo: {
                    kind: 'cursor',
                    size: 50,
                    hasNextPage: false,
                    hasPreviousPage: false,
                    nextCursor: null,
                  },
                })
              },
            })
          )
        )
      )
    )

    const where = observedQuery?.filtering.where
    if (where === undefined) {
      throw new Error('Expected the query to contain a filtering expression')
    }

    const dialect = new SQLiteDialect()
    const rendered = dialect.sqlToQuery(where)

    expect(rendered.params).toContain('%principal%')
    expect(rendered.params).toContain('rejected')
  })

  test('returns an empty standard query page unchanged', async () => {
    let observedQuery: Parameters<ApplicationsCrud['list']>[0] | undefined
    const applicationLayer = applicationsCrudLayer({
      list: (query) => {
        observedQuery = query
        return Effect.succeed({
          items: [],
          pageInfo: {
            kind: 'cursor',
            size: 1,
            hasNextPage: false,
            hasPreviousPage: true,
            nextCursor: null,
          },
        })
      },
    })

    const page = await Effect.runPromise(
      ApplicationsService.use((service) =>
        service.list({ pagination: { size: 1 } })
      ).pipe(Effect.provide(live(applicationLayer)))
    )

    expect(observedQuery?.filtering.where).toBeUndefined()
    expect(page.items).toEqual([])
    expect(page.pageInfo.nextCursor).toBeNull()
  })

  test('forwards the numeric page size and exposes the next cursor', async () => {
    let observedSize: number | undefined
    const page = await Effect.runPromise(
      ApplicationsService.use((service) =>
        service.list({ pagination: { size: 100 } })
      ).pipe(
        Effect.provide(
          live(
            applicationsCrudLayer({
              list: (filter) => {
                observedSize = filter.pagination?.size
                return Effect.succeed({
                  items: [applicationListRecord],
                  pageInfo: {
                    kind: 'cursor',
                    size: 100,
                    hasNextPage: true,
                    hasPreviousPage: false,
                    nextCursor: 'inner-next',
                  },
                })
              },
            })
          )
        )
      )
    )

    expect(observedSize).toBe(100)
    expect(page.items).toHaveLength(1)
    expect(page.pageInfo.nextCursor).toBe('inner-next')
  })

  test('decorates list rows for the dashboard', async () => {
    const page = await Effect.runPromise(
      ApplicationsService.use((service) =>
        service.list({ currency: 'USD' })
      ).pipe(
        Effect.provide(
          live(
            applicationsCrudLayer({
              list: () =>
                Effect.succeed({
                  items: [
                    {
                      ...applicationListRecord,
                      compensations: [compensation],
                      counts: { captures: 1, notes: 2 },
                      followUpAt: '2026-07-12T11:00:00.000Z',
                      labels: ['priority'],
                      latestEvent: {
                        kind: 'stage_changed',
                        occurredAt: recordedAt,
                      },
                    },
                  ],
                  pageInfo: {
                    kind: 'cursor',
                    size: 50,
                    hasNextPage: false,
                    hasPreviousPage: false,
                    nextCursor: null,
                  },
                }),
            })
          )
        )
      )
    )

    expect(page.items[0]).toMatchObject({
      annualCompensation: {
        currencyCode: 'USD',
        maximumMinor: 24_000_000,
        minimumMinor: 20_000_000,
      },
      labels: ['priority'],
      latestEvent: { kind: 'stage_changed', occurredAt: recordedAt },
      counts: { captures: 1, notes: 2 },
    })
  })

  test('rejects stale versions before calling CRUD', async () => {
    let patched = false
    const error = await Effect.runPromise(
      ApplicationsService.use((service) =>
        service.patch(application.id, { expectedVersion: 9, fitScore: 42 })
      ).pipe(
        Effect.flip,
        Effect.provide(
          live(
            applicationsCrudLayer({
              patch: () => {
                patched = true
                return Effect.succeed(application)
              },
            })
          )
        )
      )
    )

    expect(error._tag).toBe('RegistryConflictError')
    expect(patched).toBe(false)
  })

  test('owns status audit semantics for one managed update', async () => {
    let persisted: PersistedManagedApplicationUpdate | undefined
    const result = await Effect.runPromise(
      ApplicationsService.use((service) =>
        service.updateManaged(application.id, {
          annualCompensation: {
            currencyCode: 'USD',
            maximumMinor: 20_000_000,
            minimumMinor: 18_000_000,
          },
          applicationStatus: 'offer',
          expectedVersion: application.version,
          labels: ['priority'],
          operationId: 'managed-update-1',
        })
      ).pipe(
        Effect.provide(
          live(
            applicationsCrudLayer({
              updateManaged: (_applicationId, input) => {
                persisted = input
                return Effect.succeed(true)
              },
            })
          )
        )
      )
    )

    expect(persisted?.patch).toEqual({ applicationStatus: 'offer' })
    expect(persisted?.labels).toEqual(['priority'])
    expect(persisted?.annualCompensation?.replacement).toMatchObject({
      currencyCode: 'USD',
      kind: 'base_salary',
      maximumMinor: 20_000_000,
      minimumMinor: 18_000_000,
      source: 'manual',
    })
    expect(persisted?.event).toMatchObject({
      kind: 'offer_received',
      operationId: 'managed-update-1',
      payload: {
        source: 'application_registry_management',
        previousApplicationStatus: application.applicationStatus,
        nextApplicationStatus: 'offer',
      },
    })
    expect(result).toEqual({
      annualCompensation: null,
      application,
      labels: [],
    })
  })

  test('allocates and persists a new application ID', async () => {
    let persisted: PersistedApplication | undefined
    let stored: typeof application | undefined
    const applicationLayer = applicationsCrudLayer({
      findByJobKey: () => Effect.succeed(stored),
      persist: (input) => {
        persisted = input
        stored = { ...application, id: input.applicationId }
        return Effect.void
      },
    })
    const testLayer = live(applicationLayer)

    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.parse(recordedAt))
        return yield* ApplicationsService.use((service) =>
          service.upsert({
            canonicalUrl: application.canonicalUrl,
            company: application.company,
            jobKey: application.jobKey,
            location: null,
            role: application.role,
            source: application.source,
            sourceJobId: null,
          })
        )
      }).pipe(Effect.provide([testLayer, TestClock.layer()]))
    )

    expect(persisted?.applicationId).toBe(result.id)
    expect(result.id).toMatch(/^[\da-f-]{36}$/u)
    expect(persisted?.recordedAt).toBe(recordedAt)
  })
})
