import {
  ApplicationsCrud,
  EventsCrud,
  OperationsCrud,
  type PersistedEvent,
} from '@cv/application-registry-crud'
import { eventListQuery } from '@cv/application-registry-entity/query'
import { Effect, Layer } from 'effect'

import { RegistryConflictError } from '../errors'
import { operationRequestSignature } from '../internal/operation-request-signature'
import { resolveRegistryQuery } from '../internal/query-resolution'
import {
  findRequiredApplication,
  findValidatedOperation,
  newRegistryId,
  type OperationIdentity,
  registryNow,
  requireEvent,
} from '../internal/shared'
import {
  EventsService,
  type EventsService as EventsServiceShape,
} from '../services/events'
import type { AppendApplicationEventInput, ListEventsInput } from '../types'

const make = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  const events = yield* EventsCrud
  const operations = yield* OperationsCrud

  const loadResult = (identity: OperationIdentity, replayed: boolean) =>
    Effect.gen(function* () {
      const application = yield* findRequiredApplication(
        applications,
        identity.applicationId ?? ''
      )
      const event = yield* events
        .findByOperation(identity.operationId)
        .pipe(
          Effect.flatMap((value) => requireEvent(value, identity.operationId))
        )
      return { application, event, replayed }
    })

  return {
    append: Effect.fn('EventsService.append')(
      (identifier: string, request: AppendApplicationEventInput) =>
        Effect.gen(function* () {
          const application = yield* findRequiredApplication(
            applications,
            identifier
          )
          const identity: OperationIdentity = {
            applicationId: application.id,
            kind: 'application_event',
            operationId: request.operationId,
            operationRequestSignature: operationRequestSignature(
              'application_event',
              {
                applicationId: application.id,
                request,
              }
            ),
          }
          const replay = yield* findValidatedOperation(operations, identity)
          if (replay) return yield* loadResult(identity, true)

          if (
            request.expectedVersion !== null &&
            request.expectedVersion !== application.version
          ) {
            return yield* new RegistryConflictError({
              message: `Application version ${application.version} does not match expected version ${request.expectedVersion}.`,
            })
          }

          const { nextApplicationStatus, ...eventInput } = request
          const eventId = newRegistryId()
          const recordedAt = yield* registryNow
          const persisted: PersistedEvent = {
            ...eventInput,
            eventId,
            recordedAt,
            operationRequestSignature: identity.operationRequestSignature,
          }
          const replayed = yield* applications
            .persistEvent(
              application.id,
              application.version,
              nextApplicationStatus,
              persisted
            )
            .pipe(
              Effect.flatMap((applied) =>
                applied
                  ? Effect.succeed(false)
                  : findValidatedOperation(operations, identity).pipe(
                      Effect.flatMap((receipt) =>
                        receipt
                          ? Effect.succeed(true)
                          : Effect.fail(
                              new RegistryConflictError({
                                message:
                                  'The application changed while the event was being recorded.',
                              })
                            )
                      )
                    )
              ),
              Effect.catchTag('RegistryDatabaseError', (failure) =>
                findValidatedOperation(operations, identity).pipe(
                  Effect.flatMap((receipt) =>
                    receipt ? Effect.succeed(true) : Effect.fail(failure)
                  )
                )
              )
            )

          return yield* loadResult(identity, replayed)
        })
    ),
    list: Effect.fn('EventsService.list')((query: ListEventsInput) =>
      resolveRegistryQuery(eventListQuery, query).pipe(
        Effect.flatMap((resolved) => events.list(resolved))
      )
    ),
    listByApplication: Effect.fn('EventsService.listByApplication')(
      (identifier: string) =>
        Effect.gen(function* () {
          const application = yield* findRequiredApplication(
            applications,
            identifier
          )
          return { items: yield* events.listByApplication(application.id) }
        })
    ),
  } satisfies EventsServiceShape
})

export const EventsServiceLive = Layer.effect(EventsService, make)
