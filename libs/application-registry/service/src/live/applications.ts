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
import { decodeCursor, encodeCursor } from '../internal/cursor'
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

const asArray = <A>(
  value: A | readonly A[] | undefined
): readonly A[] | undefined =>
  value === undefined ? undefined : Array.isArray(value) ? value : [value as A]

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

  return {
    facets: Effect.fn('ApplicationsService.facets')(() =>
      applications.facets()
    ),
    find,
    list: Effect.fn('ApplicationsService.list')(
      (query: ListApplicationsInput) =>
        Effect.gen(function* () {
          const cursor = yield* decodeCursor(query.after)
          const now = yield* registryNow
          const page = yield* applications.list({
            afterRevision: cursor?.revision,
            applicationStatus: asArray(query.applicationStatus),
            company: query.company,
            followUpState: asArray(query.followUpState),
            label: asArray(query.label),
            limit: query.limit ?? 50,
            location: query.location,
            now,
            personalPriority: asArray(query.personalPriority),
            role: query.role,
            targetStage: asArray(query.targetStage),
            url: query.url,
          })
          const last = page.items.at(-1)
          const checkpoint = last
            ? encodeCursor({ revision: last.updatedRevision })
            : (query.after ?? null)

          const quoteCurrency =
            query.currency === undefined || query.currency === 'original'
              ? undefined
              : query.currency
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
                    toApplicationListItem(item, now, displayed)
                  )
                )
              : Effect.succeed(toApplicationListItem(item, now))
          )

          return {
            checkpoint,
            items,
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
          const applicationId = existing?.id ?? newRegistryId()
          const input: PersistedApplication = {
            ...request,
            applicationId,
            compensations: decorateCompensations(request.compensations),
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
