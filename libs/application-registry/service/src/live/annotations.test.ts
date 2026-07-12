import { describe, expect, test } from 'bun:test'
import type { PersistedNote } from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'
import { application, note, receipt } from '../../test/support/fixtures'
import {
  annotationsCrudLayer,
  applicationsCrudLayer,
  operationsCrudLayer,
  registryIdsLayer,
} from '../../test/support/layers'
import { requestFingerprint } from '../internal/fingerprint'
import { AnnotationsService } from '../services/annotations'
import { AnnotationsServiceLive } from './annotations'

const request = {
  body: note.body,
  kind: note.kind,
  operationId: 'note-operation-1',
  source: note.source,
} as const

const live = (
  annotationLayer = annotationsCrudLayer(),
  operationLayer = operationsCrudLayer()
) =>
  AnnotationsServiceLive.pipe(
    Layer.provide(annotationLayer),
    Layer.provide(applicationsCrudLayer()),
    Layer.provide(operationLayer),
    Layer.provide(registryIdsLayer(['note-1', 'event-1']))
  )

describe('AnnotationsService', () => {
  test('persists a fresh note with service-owned IDs', async () => {
    let persisted: PersistedNote | undefined
    const result = await Effect.runPromise(
      AnnotationsService.use((service) =>
        service.addNote(application.id, request)
      ).pipe(
        Effect.provide(
          live(
            annotationsCrudLayer({
              findNote: () => Effect.succeed(note),
              persistNote: (_applicationId, input) => {
                persisted = input
                return Effect.void
              },
            })
          )
        )
      )
    )

    expect(result).toEqual({ note, replayed: false })
    expect(persisted?.noteId).toBe(note.id)
    expect(persisted?.eventId).toBe('event-1')
  })

  test('loads an existing note without writing during replay', async () => {
    let wrote = false
    const fingerprint = requestFingerprint('application_note', {
      applicationId: application.id,
      request,
    })
    const result = await Effect.runPromise(
      AnnotationsService.use((service) =>
        service.addNote(application.id, request)
      ).pipe(
        Effect.provide(
          live(
            annotationsCrudLayer({
              findNote: () => Effect.succeed(note),
              persistNote: () => {
                wrote = true
                return Effect.void
              },
            }),
            operationsCrudLayer({
              find: () =>
                Effect.succeed(receipt({ requestFingerprint: fingerprint })),
            })
          )
        )
      )
    )

    expect(result).toEqual({ note, replayed: true })
    expect(wrote).toBe(false)
  })

  test('rejects an operation ID reused for another request', async () => {
    const error = await Effect.runPromise(
      AnnotationsService.use((service) =>
        service.addNote(application.id, request)
      ).pipe(
        Effect.flip,
        Effect.provide(
          live(
            annotationsCrudLayer(),
            operationsCrudLayer({
              find: () =>
                Effect.succeed(
                  receipt({ requestFingerprint: 'another-request' })
                ),
            })
          )
        )
      )
    )

    expect(error._tag).toBe('RegistryConflictError')
  })
})
