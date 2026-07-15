import {
  AnnotationsCrud,
  ApplicationsCrud,
  type PersistedApplication,
} from '@cv/application-registry-crud'
import type {
  ApplicationCompensation,
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
import { toApplicationListItem } from '../internal/application-list-item'
import { convertCompensationForDisplay } from '../internal/compensation-conversion'
import { resolveRegistryQuery } from '../internal/query-resolution'
import {
  decorateCompensations,
  newRegistryId,
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
  const fxRates = yield* FxRates

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
          const { currency, ...request } = query
          const resolved = yield* resolveRegistryQuery(
            applicationListQuery,
            request
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
