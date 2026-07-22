import {
  AnnotationsCrud,
  ApplicationsCrud,
  CompensationsCrud,
  IdempotencyCrud,
  type PersistedActivity,
  type PersistedApplication,
} from '@cv/application-registry-crud'
import { normalizeApplicationPostingUrl } from '@cv/application-registry-entity'
import { applicationListQuery } from '@cv/application-registry-entity/query'
import {
  RegistryEventPublisher,
  RegistryEventSchema,
} from '@cv/application-registry-events'
import { Effect, Layer } from 'effect'

import {
  RegistryBadRequestError,
  RegistryConflictError,
  type RegistryDatabaseError,
} from '../errors'
import {
  selectAnnualCompensation,
  toApplicationListItem,
} from '../internal/application-list-item'
import { operationRequestSignature } from '../internal/operation-request-signature'
import { resolveRegistryQuery } from '../internal/query-resolution'
import {
  decorateCompensations,
  findRequiredApplication,
  findValidatedIdempotency,
  type IdempotencyIdentity,
  newRegistryId,
  registryNow,
  requireApplication,
} from '../internal/shared'
import {
  ApplicationsService,
  type ApplicationsService as ApplicationsServiceShape,
} from '../services/applications'
import type {
  CreateApplicationInput,
  ListApplicationsInput,
  UpdateApplicationInput,
} from '../types'

const postingIdentity = (postingUrl: string) =>
  Effect.try({
    try: () => {
      const normalizedUrl = normalizeApplicationPostingUrl(postingUrl)
      return {
        fingerprint: normalizedUrl,
        normalizedUrl,
      }
    },
    catch: () =>
      new RegistryBadRequestError({
        message: 'postingUrl must be a valid absolute HTTP(S) URL.',
      }),
  })

const submittedStatuses = new Set([
  'applied',
  'recruiter_screen',
  'technical_screen',
  'take_home',
  'interview_loop',
  'offer',
])

const make = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  const annotations = yield* AnnotationsCrud
  const compensations = yield* CompensationsCrud
  const idempotency = yield* IdempotencyCrud
  const events = yield* RegistryEventPublisher

  const find = Effect.fn('ApplicationsService.find')((identifier: string) =>
    applications
      .findByIdentifier(identifier)
      .pipe(Effect.flatMap((value) => requireApplication(value, identifier)))
  )

  const persistedApplication = Effect.fn(
    'ApplicationsService.persistedApplication'
  )(function* (request: CreateApplicationInput, applicationId: string) {
    const identity = yield* postingIdentity(request.postingUrl)
    const recordedAt = yield* registryNow
    return {
      ...request,
      activity: {
        activityId: newRegistryId(),
        actor: 'system',
        kind: 'application_created',
        occurredAt: recordedAt,
        payload: { postingUrl: identity.normalizedUrl },
        source: 'management',
      },
      applicationId,
      postingFingerprint: identity.fingerprint,
      postingUrlNormalized: identity.normalizedUrl,
      compensations: decorateCompensations(request.compensations),
      recordedAt,
    } satisfies PersistedApplication
  })

  const managedResult = Effect.fn('ApplicationsService.managedResult')(
    (applicationId: string) =>
      Effect.gen(function* () {
        const [application, labels, storedCompensations] = yield* Effect.all([
          findRequiredApplication(applications, applicationId),
          annotations.listLabels(applicationId),
          compensations.listByApplication(applicationId),
        ])
        const annual = selectAnnualCompensation(storedCompensations)
        return {
          annualCompensation:
            annual === undefined
              ? null
              : {
                  currencyCode: annual.currencyCode,
                  maximumMinor: annual.maximumMinor,
                  minimumMinor: annual.minimumMinor,
                },
          application,
          labels: labels.map(({ label }) => label),
        }
      })
  )

  return {
    create: Effect.fn('ApplicationsService.create')(
      (request: CreateApplicationInput) =>
        Effect.gen(function* () {
          const applicationId = newRegistryId()
          const input = yield* persistedApplication(request, applicationId)
          const existing = yield* applications.findByPostingUrl(
            input.postingUrlNormalized
          )
          if (existing.length > 0) {
            return yield* new RegistryConflictError({
              message: `Posting already registered by application ${existing[0]?.id}.`,
            })
          }
          yield* applications
            .persist(input, {
              operation: 'application create',
            })
            .pipe(
              Effect.catchTag(
                'RegistryDatabaseError',
                (
                  failure
                ): Effect.Effect<
                  void,
                  RegistryConflictError | RegistryDatabaseError
                > =>
                  applications
                    .findByPostingFingerprint(input.postingFingerprint)
                    .pipe(
                      Effect.flatMap((existing) =>
                        Effect.gen(function* () {
                          if (existing) {
                            return yield* new RegistryConflictError({
                              message: `Posting already registered by application ${existing.id}.`,
                            })
                          }
                          return yield* failure
                        })
                      )
                    )
              )
            )
          const created = yield* find(applicationId)
          yield* events.publish(
            RegistryEventSchema.cases.ApplicationCreated.make({
              applicationId: created.id,
              correlationId: created.id,
              eventId: `application-created:${created.id}`,
              occurredAt: created.createdAt,
              version: 1,
            })
          )
          return created
        })
    ),
    facets: Effect.fn('ApplicationsService.facets')(() =>
      applications.facets()
    ),
    find,
    list: Effect.fn('ApplicationsService.list')(
      (query: ListApplicationsInput) =>
        Effect.gen(function* () {
          const { q, ...request } = query
          const keyword = q?.trim()
          const resolved = yield* resolveRegistryQuery(
            applicationListQuery,
            keyword
              ? {
                  ...request,
                  filters: [
                    {
                      type: 'condition',
                      field: 'q',
                      operator: 'matches',
                      value: keyword,
                    },
                    ...(request.filters ?? []),
                  ],
                }
              : request
          )
          const page = yield* applications.list(resolved)

          return {
            ...page,
            items: page.items.map(toApplicationListItem),
          }
        })
    ),
    update: Effect.fn('ApplicationsService.update')(
      (identifier: string, request: UpdateApplicationInput) =>
        Effect.gen(function* () {
          const application = yield* find(identifier)
          const identity: IdempotencyIdentity = {
            applicationId: application.id,
            scope: 'application_update',
            idempotencyKey: request.idempotencyKey,
            requestHash: operationRequestSignature('application_update', {
              applicationId: application.id,
              request,
            }),
          }
          const eventChangedFields = Object.entries(request)
            .filter(
              ([field, value]) =>
                value !== undefined &&
                field !== 'expectedVersion' &&
                field !== 'idempotencyKey'
            )
            .map(([field]) => field)
          const replay = yield* findValidatedIdempotency(idempotency, identity)
          if (replay) {
            const result = yield* managedResult(application.id)
            yield* events.publish(
              RegistryEventSchema.cases.ApplicationUpdated.make({
                applicationId: application.id,
                applicationVersion: result.application.version,
                changedFields: eventChangedFields,
                correlationId: request.idempotencyKey,
                eventId: `application-updated:${request.idempotencyKey}`,
                occurredAt: result.application.updatedAt,
                status: result.application.applicationStatus,
                version: 1,
              })
            )
            return result
          }

          if (request.expectedVersion !== application.version) {
            return yield* new RegistryConflictError({
              message: `Application version ${application.version} does not match expected version ${request.expectedVersion}.`,
            })
          }

          const {
            annualCompensation,
            expectedVersion,
            idempotencyKey,
            labels,
            ...patch
          } = request
          const recordedAt = yield* registryNow
          if (
            patch.applicationStatus !== undefined &&
            submittedStatuses.has(patch.applicationStatus) &&
            application.appliedAt === null &&
            patch.appliedAt === undefined
          ) {
            patch.appliedAt = recordedAt
          }
          const currentAnnual =
            annualCompensation === undefined
              ? undefined
              : selectAnnualCompensation(
                  yield* compensations.listByApplication(application.id)
                )
          const replacement =
            annualCompensation === undefined
              ? undefined
              : {
                  replacement:
                    annualCompensation === null
                      ? null
                      : {
                          ...annualCompensation,
                          id: newRegistryId(),
                          kind: currentAnnual?.kind ?? 'base_salary',
                          rawText: null,
                          source: 'manual',
                        },
                }
          const changedFields = Object.entries(patch)
            .filter(
              ([field, value]) =>
                value !== undefined &&
                value !== application[field as keyof typeof application]
            )
            .map(([field]) => field)
          if (labels !== undefined) changedFields.push('labels')
          if (annualCompensation !== undefined)
            changedFields.push('annualCompensation')
          const statusChanged =
            patch.applicationStatus !== undefined &&
            patch.applicationStatus !== application.applicationStatus
          const followUpChanged =
            patch.followUpAt !== undefined &&
            patch.followUpAt !== application.followUpAt
          const activity: PersistedActivity = {
            activityId: newRegistryId(),
            actor: 'user',
            kind: statusChanged
              ? 'status_changed'
              : followUpChanged
                ? 'follow_up_changed'
                : 'details_changed',
            occurredAt: recordedAt,
            payload: {
              fields: changedFields,
              ...(statusChanged
                ? {
                    from: application.applicationStatus,
                    to: patch.applicationStatus,
                  }
                : {}),
              ...(followUpChanged
                ? { from: application.followUpAt, to: patch.followUpAt }
                : {}),
            },
            source: 'management',
          }
          const nextPostingIdentity =
            patch.postingUrl === undefined ||
            patch.postingUrl === application.postingUrl
              ? undefined
              : yield* postingIdentity(patch.postingUrl)
          if (nextPostingIdentity) {
            const existing = yield* applications.findByPostingUrl(
              nextPostingIdentity.normalizedUrl
            )
            const conflict = existing.find(({ id }) => id !== application.id)
            if (conflict) {
              return yield* new RegistryConflictError({
                message: `Posting already registered by application ${conflict.id}.`,
              })
            }
          }

          const applied = yield* applications
            .updateManaged(application.id, {
              activity,
              annualCompensation: replacement,
              expectedVersion,
              idempotencyKey,
              labels,
              patch,
              postingIdentity: nextPostingIdentity,
              recordedAt,
              requestHash: identity.requestHash,
            })
            .pipe(
              Effect.catchTag('RegistryDatabaseError', (failure) =>
                findValidatedIdempotency(idempotency, identity).pipe(
                  Effect.flatMap((receipt) =>
                    receipt ? Effect.succeed(false) : Effect.fail(failure)
                  )
                )
              )
            )

          if (!applied) {
            const concurrentReplay = yield* findValidatedIdempotency(
              idempotency,
              identity
            )
            if (!concurrentReplay) {
              return yield* new RegistryConflictError({
                message:
                  'The application changed while the management update was being recorded.',
              })
            }
          }

          const result = yield* managedResult(application.id)
          yield* events.publish(
            RegistryEventSchema.cases.ApplicationUpdated.make({
              applicationId: application.id,
              applicationVersion: result.application.version,
              changedFields: eventChangedFields,
              correlationId: request.idempotencyKey,
              eventId: `application-updated:${request.idempotencyKey}`,
              occurredAt: result.application.updatedAt,
              status: result.application.applicationStatus,
              version: 1,
            })
          )
          return result
        })
    ),
    remove: Effect.fn('ApplicationsService.remove')(
      (identifier: string, expectedVersion?: number) =>
        Effect.gen(function* () {
          const application = yield* find(identifier)
          if (
            expectedVersion !== undefined &&
            expectedVersion !== application.version
          ) {
            return yield* new RegistryConflictError({
              message: `Application version ${application.version} does not match expected version ${expectedVersion}.`,
            })
          }
          const removed = yield* applications.remove(
            application.id,
            expectedVersion
          )
          if (!removed) {
            return yield* new RegistryConflictError({
              message: 'The application changed while it was being removed.',
            })
          }
          const occurredAt = yield* registryNow
          yield* events.publish(
            RegistryEventSchema.cases.ApplicationRemoved.make({
              applicationId: application.id,
              correlationId: application.id,
              eventId: `application-removed:${application.id}`,
              occurredAt,
              version: 1,
            })
          )
        })
    ),
  } satisfies ApplicationsServiceShape
})

export const ApplicationsServiceLive = Layer.effect(ApplicationsService, make)
