import type { Application } from '@cv/application-registry-entity'
import { Effect } from 'effect'

import type { RegistryClient } from '@/lib/registry-client'
import { startApplicationPreparation } from '@/preparation/application-lifecycle'
import type { PreparationApplicationDetailsInput } from '../types'
import { dataError } from './shared'

export const makePreparationApplicationRepository = (
  registry: RegistryClient['Service']
) => {
  const createPreparationApplication = Effect.fn(
    'PreparationRepository.createPreparationApplication'
  )(
    function* (postingUrl: string) {
      const url = new URL(postingUrl)
      return yield* registry.applications
        .createApplication({
          payload: {
            applicationStatus: 'preparing',
            company: url.hostname,
            location: null,
            postingUrl,
            role: 'Pending job analysis',
            targetStage: 'backlog',
          },
        })
        .pipe(
          Effect.catchTag('ConflictError', (conflict) =>
            registry.applications
              .listApplications({
                query: {
                  filters: [
                    {
                      field: 'postingUrl',
                      operator: 'eq',
                      type: 'condition',
                      value: postingUrl,
                    },
                  ],
                  pagination: { size: 2 },
                },
              })
              .pipe(
                Effect.flatMap((response) =>
                  response.items[0] === undefined
                    ? Effect.fail(conflict)
                    : Effect.succeed(response.items[0])
                )
              )
          )
        )
    },
    (effect) => effect.pipe(dataError('create-preparation-application'))
  )

  const startPreparation = Effect.fn('PreparationRepository.startPreparation')(
    (applicationId: string) =>
      startApplicationPreparation(registry, applicationId).pipe(
        dataError('start-application-preparation')
      )
  )

  const updatePreparationApplication = Effect.fn(
    'PreparationRepository.updatePreparationApplication'
  )((input: PreparationApplicationDetailsInput) =>
    registry.applications
      .updateApplication({
        headers: { 'idempotency-key': input.operationId },
        params: { id: input.application.id },
        payload: {
          company: input.company ?? input.application.company,
          expectedVersion: input.application.version,
          location: input.location,
          role: input.role,
        },
      })
      .pipe(
        Effect.map(({ application }): Application => application),
        dataError('update-preparation-application')
      )
  )

  return {
    createPreparationApplication,
    startPreparation,
    updatePreparationApplication,
  }
}
