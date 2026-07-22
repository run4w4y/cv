import {
  ApplicationsCrud,
  CompensationsCrud,
} from '@cv/application-registry-crud'
import {
  RegistryEventPublisher,
  RegistryEventSchema,
} from '@cv/application-registry-events'
import { Effect, Layer } from 'effect'
import { RegistryConflictError } from '../errors'
import { selectAnnualCompensation } from '../internal/application-list-item'
import {
  findRequiredApplication,
  newRegistryId,
  registryNow,
} from '../internal/shared'
import {
  CompensationsService,
  type CompensationsService as CompensationsServiceShape,
} from '../services/compensations'
import type {
  ApplicationCompensationsResult,
  ReplaceAnnualCompensationInput,
  ReplaceAnnualCompensationResult,
} from '../types'

const make = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  const compensations = yield* CompensationsCrud
  const events = yield* RegistryEventPublisher

  const findApplication = Effect.fn('CompensationsService.findApplication')(
    (identifier: string) => findRequiredApplication(applications, identifier)
  )

  return {
    listByApplication: Effect.fn('CompensationsService.listByApplication')(
      (identifier: string) =>
        Effect.gen(function* () {
          const application = yield* findRequiredApplication(
            applications,
            identifier
          )
          const originals = yield* compensations.listByApplication(
            application.id
          )

          return { items: originals } satisfies ApplicationCompensationsResult
        })
    ),
    replaceAnnual: Effect.fn('CompensationsService.replaceAnnual')(
      (identifier: string, input: ReplaceAnnualCompensationInput) =>
        Effect.gen(function* () {
          const application = yield* findApplication(identifier)
          if (application.version !== input.expectedVersion) {
            return yield* new RegistryConflictError({
              message: `Application version ${application.version} does not match expected version ${input.expectedVersion}.`,
            })
          }

          const originals = yield* compensations.listByApplication(
            application.id
          )
          const selected = selectAnnualCompensation(originals)
          const recordedAt = yield* registryNow
          const replacement =
            input.annualCompensation === null
              ? null
              : {
                  ...input.annualCompensation,
                  id: newRegistryId(),
                  kind: selected?.kind ?? ('base_salary' as const),
                  rawText: null,
                  source: 'manual',
                }
          const replaced = yield* compensations.replaceAnnual(
            application.id,
            input.expectedVersion,
            replacement,
            recordedAt
          )
          if (!replaced) {
            return yield* new RegistryConflictError({
              message:
                'The application changed while annual compensation was being recorded.',
            })
          }

          const updated = yield* findApplication(application.id)
          const eventId = `compensation-changed:${application.id}:${updated.version}`
          yield* events.publish(
            RegistryEventSchema.cases.CompensationChanged.make({
              applicationId: application.id,
              correlationId: eventId,
              eventId,
              occurredAt: updated.updatedAt,
              version: 1,
            })
          )
          return {
            annualCompensation: input.annualCompensation,
            application: updated,
          } satisfies ReplaceAnnualCompensationResult
        })
    ),
  } satisfies CompensationsServiceShape
})

export const CompensationsServiceLive = Layer.effect(CompensationsService, make)
