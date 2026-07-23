import {
  ApplicationsCrud,
  CompensationsCrud,
} from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'
import { findRequiredApplication } from '../internal/shared'
import {
  CompensationsService,
  type CompensationsService as CompensationsServiceShape,
} from '../services/compensations'
import type { ApplicationCompensationsResult } from '../types'

const make = Effect.gen(function* () {
  const applications = yield* ApplicationsCrud
  const compensations = yield* CompensationsCrud

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
  } satisfies CompensationsServiceShape
})

export const CompensationsServiceLive = Layer.effect(CompensationsService, make)
