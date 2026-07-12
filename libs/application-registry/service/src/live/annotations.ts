import {
  AnnotationsCrud,
  ApplicationsCrud,
  OperationsCrud,
  type PersistedNote,
} from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'

import { RegistryIds } from '../ids/service'
import { requestFingerprint } from '../internal/fingerprint'
import {
  findRequiredApplication,
  findValidatedOperation,
  missingRegistryData,
  type OperationIdentity,
  recoverConcurrentReplay,
  registryNow,
  requireNote,
  requireReceiptNoteId,
} from '../internal/shared'
import {
  AnnotationsService,
  type AnnotationsService as AnnotationsServiceShape,
} from '../services/annotations'
import type { AddApplicationNoteInput } from '../types'

const make = Effect.gen(function* () {
  const annotations = yield* AnnotationsCrud
  const applications = yield* ApplicationsCrud
  const operations = yield* OperationsCrud
  const ids = yield* RegistryIds

  return {
    addNote: Effect.fn('AnnotationsService.addNote')(
      (identifier: string, request: AddApplicationNoteInput) =>
        Effect.gen(function* () {
          const application = yield* findRequiredApplication(
            applications,
            identifier
          )
          const identity: OperationIdentity = {
            applicationId: application.id,
            kind: 'application_note',
            operationId: request.operationId,
            requestFingerprint: requestFingerprint('application_note', {
              applicationId: application.id,
              request,
            }),
          }
          const replay = yield* findValidatedOperation(operations, identity)

          if (replay) {
            const noteId = yield* requireReceiptNoteId(replay)
            const note = yield* annotations
              .findNote(noteId)
              .pipe(Effect.flatMap((value) => requireNote(value, noteId)))
            return { note, replayed: true }
          }

          const [noteId, eventId, recordedAt] = yield* Effect.all([
            ids.next,
            ids.next,
            registryNow,
          ])
          const persisted: PersistedNote = {
            ...request,
            eventId,
            noteId,
            recordedAt,
            requestFingerprint: identity.requestFingerprint,
          }
          const replayed = yield* recoverConcurrentReplay(
            operations,
            identity,
            annotations.persistNote(application.id, persisted)
          )
          const storedNoteId = replayed
            ? yield* findValidatedOperation(operations, identity).pipe(
                Effect.flatMap((receipt) =>
                  receipt
                    ? requireReceiptNoteId(receipt)
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
