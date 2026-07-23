import { describe, expect, test } from 'bun:test'
import type { PersistedNote } from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'
import { application, note, receipt } from '../../test/support/fixtures'
import {
  annotationsCrudLayer,
  applicationsCrudLayer,
  idempotencyCrudLayer,
} from '../../test/support/layers'
import { operationRequestSignature } from '../internal/operation-request-signature'
import { AnnotationsService } from '../services/annotations'
import { AnnotationsServiceLive } from './annotations'

const request = {
  body: note.body,
  kind: note.kind,
  idempotencyKey: 'note-operation-1',
  source: note.source,
} as const

const live = (
  annotationLayer = annotationsCrudLayer(),
  operationLayer = idempotencyCrudLayer()
) =>
  AnnotationsServiceLive.pipe(
    Layer.provide(annotationLayer),
    Layer.provide(applicationsCrudLayer()),
    Layer.provide(operationLayer)
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
    expect(persisted?.noteId).toMatch(/^[\da-f-]{36}$/u)
    expect(persisted?.activityId).toMatch(/^[\da-f-]{36}$/u)
    expect(persisted?.activityId).not.toBe(persisted?.noteId)
  })

  test('loads an existing note without writing during replay', async () => {
    let wrote = false
    const signature = operationRequestSignature('application_note', {
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
            idempotencyCrudLayer({
              find: () => Effect.succeed(receipt({ requestHash: signature })),
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
            idempotencyCrudLayer({
              find: () =>
                Effect.succeed(receipt({ requestHash: 'another-request' })),
            })
          )
        )
      )
    )

    expect(error._tag).toBe('RegistryConflictError')
  })
})
