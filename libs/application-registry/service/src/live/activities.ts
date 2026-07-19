import { ActivitiesCrud, ApplicationsCrud } from '@cv/application-registry-crud'
import { activityListQuery } from '@cv/application-registry-entity/query'
import { Effect, Layer } from 'effect'

import { resolveRegistryQuery } from '../internal/query-resolution'
import { findRequiredApplication } from '../internal/shared'
import {
  ActivitiesService,
  type ActivitiesService as ActivitiesServiceShape,
} from '../services/activities'
import type { ListActivitiesInput } from '../types'

const make = Effect.gen(function* () {
  const activities = yield* ActivitiesCrud
  const applications = yield* ApplicationsCrud

  return {
    list: Effect.fn('ActivitiesService.list')((query: ListActivitiesInput) =>
      resolveRegistryQuery(activityListQuery, query).pipe(
        Effect.flatMap((resolved) => activities.list(resolved))
      )
    ),
    listByApplication: Effect.fn('ActivitiesService.listByApplication')(
      (identifier: string) =>
        Effect.gen(function* () {
          const application = yield* findRequiredApplication(
            applications,
            identifier
          )
          return {
            items: yield* activities.listByApplication(application.id),
          }
        })
    ),
  } satisfies ActivitiesServiceShape
})

export const ActivitiesServiceLive = Layer.effect(ActivitiesService, make)
