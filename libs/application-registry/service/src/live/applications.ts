import {
  AnnotationsCrud,
  ApplicationsCrud,
  CompensationsCrud,
  OperationsCrud,
  type PersistedApplication,
  type PersistedEvent,
} from '@cv/application-registry-crud'
import type {
  ApplicationCompensation,
  ApplicationStatus,
  CurrencyCode,
  FxRate,
} from '@cv/application-registry-entity'
import { applicationListQuery } from '@cv/application-registry-entity/query'
import { FxRates } from '@cv/application-registry-fx'
import { Effect, Layer } from 'effect'
import { uniq } from 'es-toolkit'

import {
  type RegistryBadRequestError,
  RegistryConflictError,
  RegistryDatabaseError,
} from '../errors'
import {
  selectAnnualCompensation,
  toApplicationListItem,
} from '../internal/application-list-item'
import { convertCompensationForDisplay } from '../internal/compensation-conversion'
import { operationRequestSignature } from '../internal/operation-request-signature'
import { resolveRegistryQuery } from '../internal/query-resolution'
import {
  decorateCompensations,
  findRequiredApplication,
  findValidatedOperation,
  newRegistryId,
  type OperationIdentity,
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
  UpdateManagedApplicationInput,
  UpsertApplicationInput,
} from '../types'

const eventKindForManagedStatus = (
  status: ApplicationStatus
): PersistedEvent['kind'] => {
  switch (status) {
    case 'applied':
      return 'submitted'
    case 'recruiter_screen':
    case 'technical_screen':
    case 'take_home':
    case 'interview_loop':
      return 'interview_scheduled'
    case 'offer':
      return 'offer_received'
    case 'rejected':
      return 'rejected'
    case 'withdrawn':
      return 'withdrawn'
    default:
      return 'stage_changed'
  }
}

const convertForSummary = (
  original: ApplicationCompensation,
  quoteCurrency: CurrencyCode,
  rates: ReadonlyMap<CurrencyCode, FxRate>
): Effect.Effect<
  ApplicationCompensation,
  RegistryBadRequestError | RegistryDatabaseError
> => {
  const rate = rates.get(original.currencyCode)
  if (!rate) {
    return Effect.fail(
      new RegistryDatabaseError({
        cause: new Error('Resolved compensation rate disappeared.'),
        message: 'Could not resolve a compensation exchange rate.',
      })
    )
  }
  return convertCompensationForDisplay(original, quoteCurrency, rate)
}

const make = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  const annotations = yield* AnnotationsCrud
  const compensations = yield* CompensationsCrud
  const fxRates = yield* FxRates
  const operations = yield* OperationsCrud

  const find = Effect.fn('ApplicationsService.find')((identifier: string) =>
    applications
      .findByIdentifier(identifier)
      .pipe(Effect.flatMap((value) => requireApplication(value, identifier)))
  )

  const persistedApplication = Effect.fn(
    'ApplicationsService.persistedApplication'
  )(function* (request: UpsertApplicationInput, applicationId: string) {
    return {
      ...request,
      applicationId,
      compensations: decorateCompensations(request.compensations),
      recordedAt: yield* registryNow,
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
      (request: UpsertApplicationInput) =>
        Effect.gen(function* () {
          const applicationId = newRegistryId()
          const input = yield* persistedApplication(request, applicationId)
          yield* applications
            .persist(input, {
              mode: 'replace',
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
                  applications.findByJobKey(request.jobKey).pipe(
                    Effect.flatMap((existing) =>
                      Effect.gen(function* () {
                        if (existing) {
                          return yield* new RegistryConflictError({
                            message: `Application ${request.jobKey} already exists.`,
                          })
                        }
                        return yield* failure
                      })
                    )
                  )
              )
            )
          return yield* find(applicationId)
        })
    ),
    facets: Effect.fn('ApplicationsService.facets')(() =>
      applications.facets()
    ),
    find,
    list: Effect.fn('ApplicationsService.list')(
      (query: ListApplicationsInput) =>
        Effect.gen(function* () {
          const { currency, q, ...request } = query
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

          const quoteCurrency =
            currency === undefined || currency === 'original'
              ? undefined
              : currency
          const rates = quoteCurrency
            ? new Map(
                yield* Effect.forEach(
                  uniq(
                    page.items.flatMap(({ compensations }) =>
                      compensations.map(({ currencyCode }) => currencyCode)
                    )
                  ),
                  (baseCurrency) =>
                    fxRates
                      .get(baseCurrency, quoteCurrency)
                      .pipe(Effect.map((rate) => [baseCurrency, rate] as const))
                )
              )
            : undefined
          const items = yield* Effect.forEach(page.items, (item) =>
            quoteCurrency && rates
              ? Effect.forEach(item.compensations, (original) =>
                  convertForSummary(original, quoteCurrency, rates)
                ).pipe(
                  Effect.map((displayed) =>
                    toApplicationListItem(item, displayed)
                  )
                )
              : Effect.succeed(toApplicationListItem(item))
          )

          return {
            ...page,
            items,
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
    updateManaged: Effect.fn('ApplicationsService.updateManaged')(
      (identifier: string, request: UpdateManagedApplicationInput) =>
        Effect.gen(function* () {
          const application = yield* find(identifier)
          const identity: OperationIdentity = {
            applicationId: application.id,
            kind: 'managed_application_update',
            operationId: request.operationId,
            operationRequestSignature: operationRequestSignature(
              'managed_application_update',
              { applicationId: application.id, request }
            ),
          }
          const replay = yield* findValidatedOperation(operations, identity)
          if (replay) return yield* managedResult(application.id)

          if (request.expectedVersion !== application.version) {
            return yield* new RegistryConflictError({
              message: `Application version ${application.version} does not match expected version ${request.expectedVersion}.`,
            })
          }

          const {
            annualCompensation,
            expectedVersion,
            labels,
            operationId,
            ...patch
          } = request
          const recordedAt = yield* registryNow
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
          const nextStatus = patch.applicationStatus
          const statusEvent =
            nextStatus === undefined ||
            nextStatus === application.applicationStatus
              ? undefined
              : {
                  deviceId: null,
                  eventId: newRegistryId(),
                  kind: eventKindForManagedStatus(nextStatus),
                  occurredAt: recordedAt,
                  operationId,
                  operationRequestSignature: identity.operationRequestSignature,
                  payload: {
                    source: 'application_registry_management',
                    previousApplicationStatus: application.applicationStatus,
                    nextApplicationStatus: nextStatus,
                  },
                  recordedAt,
                }

          const applied = yield* applications
            .updateManaged(application.id, {
              annualCompensation: replacement,
              event: statusEvent,
              expectedVersion,
              labels,
              operationId,
              operationRequestSignature: identity.operationRequestSignature,
              patch,
              recordedAt,
            })
            .pipe(
              Effect.catchTag('RegistryDatabaseError', (failure) =>
                findValidatedOperation(operations, identity).pipe(
                  Effect.flatMap((receipt) =>
                    receipt ? Effect.succeed(false) : Effect.fail(failure)
                  )
                )
              )
            )

          if (!applied) {
            const concurrentReplay = yield* findValidatedOperation(
              operations,
              identity
            )
            if (!concurrentReplay) {
              return yield* new RegistryConflictError({
                message:
                  'The application changed while the management update was being recorded.',
              })
            }
          }

          return yield* managedResult(application.id)
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
        })
    ),
    replaceLabels: Effect.fn('ApplicationsService.replaceLabels')(
      (
        identifier: string,
        labels: readonly string[],
        expectedVersion?: number
      ) =>
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
          const replaced = yield* annotations.replaceLabels(
            application.id,
            labels,
            yield* registryNow,
            expectedVersion
          )
          if (replaced === undefined) {
            return yield* new RegistryConflictError({
              message: 'The application changed while labels were being saved.',
            })
          }
          return replaced
        })
    ),
    upsert: Effect.fn('ApplicationsService.upsert')(
      (request: UpsertApplicationInput) =>
        Effect.gen(function* () {
          const existing = yield* applications.findByJobKey(request.jobKey)
          const applicationId = existing?.id ?? newRegistryId()
          const input = yield* persistedApplication(request, applicationId)

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
