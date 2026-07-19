import {
  AnnotationsCrud,
  ApplicationsCrud,
  IdempotencyCrud,
  type PersistedNote,
} from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'

import { operationRequestSignature } from '../internal/operation-request-signature'
import {
  findRequiredApplication,
  findValidatedIdempotency,
  type IdempotencyIdentity,
  missingRegistryData,
  newRegistryId,
  recoverConcurrentReplay,
  registryNow,
  requireNote,
  requireReceiptResourceId,
} from '../internal/shared'
import {
  AnnotationsService,
  type AnnotationsService as AnnotationsServiceShape,
} from '../services/annotations'
import type { AddApplicationNoteInput } from '../types'

const make = Effect.gen(function* () {
  const annotations = yield* AnnotationsCrud
  const applications = yield* ApplicationsCrud
  const idempotency = yield* IdempotencyCrud

  return {
    addNote: Effect.fn('AnnotationsService.addNote')(
      (identifier: string, request: AddApplicationNoteInput) =>
        Effect.gen(function* () {
          const application = yield* findRequiredApplication(
            applications,
            identifier
          )
          const identity: IdempotencyIdentity = {
            applicationId: application.id,
            scope: 'application_note',
            idempotencyKey: request.idempotencyKey,
            requestHash: operationRequestSignature('application_note', {
              applicationId: application.id,
              request,
            }),
          }
          const replay = yield* findValidatedIdempotency(idempotency, identity)

          if (replay) {
            const noteId = yield* requireReceiptResourceId(replay)
            const note = yield* annotations
              .findNote(noteId)
              .pipe(Effect.flatMap((value) => requireNote(value, noteId)))
            return { note, replayed: true }
          }

          const noteId = newRegistryId()
          const activityId = newRegistryId()
          const recordedAt = yield* registryNow
          const persisted: PersistedNote = {
            ...request,
            activityId,
            idempotencyKey: identity.idempotencyKey,
            noteId,
            recordedAt,
            requestHash: identity.requestHash,
          }
          const replayed = yield* recoverConcurrentReplay(
            idempotency,
            identity,
            annotations.persistNote(application.id, persisted)
          )
          const storedNoteId = replayed
            ? yield* findValidatedIdempotency(idempotency, identity).pipe(
                Effect.flatMap((receipt) =>
                  receipt
                    ? requireReceiptResourceId(receipt)
                    : Effect.fail(
                        missingRegistryData(
                          'Concurrent note receipt disappeared.'
                        )
                      )
                )
              )
            : noteId
          const note = yield* annotations
            .findNote(storedNoteId)
            .pipe(Effect.flatMap((value) => requireNote(value, storedNoteId)))

          return { note, replayed }
        })
    ),
    list: Effect.fn('AnnotationsService.list')((identifier: string) =>
      Effect.gen(function* () {
        const application = yield* findRequiredApplication(
          applications,
          identifier
        )
        const [labels, notes] = yield* Effect.all([
          annotations.listLabels(application.id),
          annotations.listNotes(application.id),
        ])
        return { labels, notes }
      })
    ),
  } satisfies AnnotationsServiceShape
})

export const AnnotationsServiceLive = Layer.effect(AnnotationsService, make)
