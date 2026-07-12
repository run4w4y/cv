import { describe, expect, test } from 'bun:test'
import type { PersistedApplication } from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'
import { TestClock } from 'effect/testing'
import { application, recordedAt } from '../../test/support/fixtures'
import {
  annotationsCrudLayer,
  applicationsCrudLayer,
  registryIdsLayer,
} from '../../test/support/layers'
import { ApplicationsService } from '../services/applications'
import { ApplicationsServiceLive } from './applications'

const live = (
  applicationLayer = applicationsCrudLayer(),
  idsLayer = registryIdsLayer(['unused-id'])
) =>
  ApplicationsServiceLive.pipe(
    Layer.provide(applicationLayer),
    Layer.provide(annotationsCrudLayer()),
    Layer.provide(idsLayer)
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
                  items: [application],
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

  test('allocates and persists a new application through injected services', async () => {
    let persisted: PersistedApplication | undefined
    let stored = false
    const created = { ...application, id: 'application-created' }
    const applicationLayer = applicationsCrudLayer({
      findByJobKey: () => Effect.succeed(stored ? created : undefined),
      persist: (input) => {
        persisted = input
        stored = true
        return Effect.void
      },
    })
    const testLayer = live(
      applicationLayer,
      registryIdsLayer(['application-created'])
    )

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

    expect(result.id).toBe('application-created')
    expect(persisted?.applicationId).toBe('application-created')
    expect(persisted?.recordedAt).toBe(recordedAt)
  })
})
