import {
  AnnotationsCrud,
  ApplicationsCrud,
  type PersistedApplication,
} from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'

import { RegistryConflictError, RegistryDatabaseError } from '../errors'
import { RegistryIds } from '../ids/service'
import { decodeCursor, encodeCursor } from '../internal/cursor'
import {
  decorateCompensations,
  registryNow,
  requireApplication,
} from '../internal/shared'
import {
  ApplicationsService,
  type ApplicationsService as ApplicationsServiceShape,
} from '../services/applications'
import type {
  ListApplicationsInput,
  PatchApplicationInput,
  UpsertApplicationInput,
} from '../types'

const make = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  const annotations = yield* AnnotationsCrud
  const ids = yield* RegistryIds

  const find = Effect.fn('ApplicationsService.find')((identifier: string) =>
    applications
      .findByIdentifier(identifier)
      .pipe(Effect.flatMap((value) => requireApplication(value, identifier)))
  )

  return {
    find,
    list: Effect.fn('ApplicationsService.list')(
      (query: ListApplicationsInput) =>
        Effect.gen(function* () {
          const cursor = yield* decodeCursor(query.after)
          const page = yield* applications.list({
            afterRevision: cursor?.revision,
            applicationStatus: query.applicationStatus,
            company: query.company,
            label: query.label,
            limit: query.limit ?? 50,
            targetStage: query.targetStage,
            url: query.url,
          })
          const last = page.items.at(-1)
          const checkpoint = last
            ? encodeCursor({ revision: last.updatedRevision })
            : (query.after ?? null)

          return {
            checkpoint,
            items: page.items,
            nextCursor: page.hasNextPage ? checkpoint : null,
          }
        })
    ),
    patch: Effect.fn('ApplicationsService.patch')(
      (identifier: string, request: PatchApplicationInput) =>
        Effect.gen(function* () {
          const current = yield* find(identifier)

          if (
            request.expectedVersion !== undefined &&
            request.expectedVersion !== current.version
          ) {
            return yield* new RegistryConflictError({
              message: `Application version ${current.version} does not match expected version ${request.expectedVersion}.`,
            })
          }

          const updated = yield* applications.patch(
            current.id,
            request,
            yield* registryNow
          )

          if (!updated) {
            return yield* new RegistryConflictError({
              message:
                'The application changed while the update was being recorded.',
            })
          }

          return updated
        })
    ),
    remove: Effect.fn('ApplicationsService.remove')((identifier: string) =>
      Effect.gen(function* () {
        const application = yield* find(identifier)
        const removed = yield* applications.remove(application.id)
        if (!removed) {
          return yield* new RegistryConflictError({
            message: 'The application changed while it was being removed.',
          })
        }
      })
    ),
    replaceLabels: Effect.fn('ApplicationsService.replaceLabels')(
      (identifier: string, labels: readonly string[]) =>
        Effect.gen(function* () {
          const application = yield* find(identifier)
          return yield* annotations.replaceLabels(
            application.id,
            labels,
            yield* registryNow
          )
        })
    ),
    upsert: Effect.fn('ApplicationsService.upsert')(
      (request: UpsertApplicationInput) =>
        Effect.gen(function* () {
          const existing = yield* applications.findByJobKey(request.jobKey)
          const applicationId = existing?.id ?? (yield* ids.next)
          const input: PersistedApplication = {
            ...request,
            applicationId,
            compensations: yield* decorateCompensations(
              request.compensations,
              ids
            ),
            recordedAt: yield* registryNow,
          }

          yield* applications
            .persist(input, {
              mode: 'replace',
              operation: 'application upsert',
            })
            .pipe(
              Effect.catchTag('RegistryDatabaseError', (failure) =>
                applications.findByJobKey(request.jobKey).pipe(
                  Effect.flatMap((winner) =>
                    winner && winner.id !== applicationId
                      ? applications.persist(
                          { ...input, applicationId: winner.id },
                          {
                            mode: 'replace',
                            operation: 'application upsert retry',
                          }
                        )
                      : Effect.fail(failure)
                  )
                )
              )
            )

          const stored = yield* applications.findByJobKey(request.jobKey)
          if (!stored) {
            return yield* new RegistryDatabaseError({
              cause: new Error('D1 returned no upserted application.'),
              message: 'Failed to upsert application',
            })
          }
          return stored
        })
    ),
  } satisfies ApplicationsServiceShape
})

export const ApplicationsServiceLive = Layer.effect(ApplicationsService, make)
