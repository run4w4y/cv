import { describe, expect, test } from 'bun:test'
import type { PersistedApplication } from '@cv/application-registry-crud'
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
} from '../../test/support/layers'
import { ApplicationsService } from '../services/applications'
import { ApplicationsServiceLive } from './applications'

const live = (applicationLayer = applicationsCrudLayer()) =>
  ApplicationsServiceLive.pipe(
    Layer.provide(applicationLayer),
    Layer.provide(annotationsCrudLayer())
  )

describe('ApplicationsService', () => {
  test('decodes cursors before querying CRUD', async () => {
    let afterRevision: number | undefined
    const page = await Effect.runPromise(
      ApplicationsService.use((service) =>
        service.list({ after: 'revision=2', limit: 10 })
      ).pipe(
        Effect.provide(
          live(
            applicationsCrudLayer({
              list: (filter) => {
                afterRevision = filter.afterRevision
                return Effect.succeed({
                  hasNextPage: false,
                  items: [applicationListRecord],
                })
              },
            })
          )
        )
      )
    )

    expect(afterRevision).toBe(2)
    expect(page.checkpoint).toBe('revision=3')
    expect(page.nextCursor).toBeNull()
  })

  test('forwards the numeric page limit and exposes the next cursor', async () => {
    let observedLimit: number | undefined
    const page = await Effect.runPromise(
      ApplicationsService.use((service) => service.list({ limit: 100 })).pipe(
        Effect.provide(
          live(
            applicationsCrudLayer({
              list: (filter) => {
                observedLimit = filter.limit
                return Effect.succeed({
                  hasNextPage: true,
                  items: [applicationListRecord],
                })
              },
            })
          )
        )
      )
    )

    expect(observedLimit).toBe(100)
    expect(page.items).toHaveLength(1)
    expect(page.nextCursor).toBe('revision=3')
  })

  test('decorates list rows for the dashboard at one request-time instant', async () => {
    const page = await Effect.runPromise(
      Effect.gen(function* () {
        yield* TestClock.setTime(Date.parse(recordedAt))
        return yield* ApplicationsService.use((service) => service.list({}))
      }).pipe(
        Effect.provide([
          live(
            applicationsCrudLayer({
              list: () =>
                Effect.succeed({
                  hasNextPage: false,
                  items: [
                    {
                      ...applicationListRecord,
                      compensations: [compensation],
                      followUpAt: '2026-07-12T11:00:00.000Z',
                      labels: ['priority'],
                      latestEventAt: recordedAt,
                      latestEventKind: 'stage_changed',
                      noteCount: 2,
                    },
                  ],
                }),
            })
          ),
          TestClock.layer(),
        ])
      )
    )

    expect(page.items[0]).toMatchObject({
      compensationSummary: 'Base salary: EUR 100,000–120,000 / year',
      followUpState: 'overdue',
      labels: ['priority'],
      latestEventKind: 'stage_changed',
      noteCount: 2,
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
