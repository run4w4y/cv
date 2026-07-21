import { ApplicationRegistryHttpClient } from '@cv/application-registry-api-client'
import type {
  CreateApplicationRequest,
  ListApplicationsQuery,
  ListApplicationsResponse,
  UpdateApplicationRequest,
  UpdateApplicationResponse,
} from '@cv/application-registry-api-contract'
import type { Application } from '@cv/application-registry-entity'
import { Context, Effect, Layer } from 'effect'

import {
  type ApplicationRegistryToolError,
  applicationRegistryToolError,
} from './errors'

export interface ApplicationRegistryGatewayService {
  readonly create: (
    request: CreateApplicationRequest
  ) => Effect.Effect<Application, ApplicationRegistryToolError>
  readonly list: (
    query: ListApplicationsQuery
  ) => Effect.Effect<ListApplicationsResponse, ApplicationRegistryToolError>
  readonly show: (
    identifier: string
  ) => Effect.Effect<Application, ApplicationRegistryToolError>
  readonly update: (
    identifier: string,
    idempotencyKey: string,
    request: UpdateApplicationRequest
  ) => Effect.Effect<UpdateApplicationResponse, ApplicationRegistryToolError>
}

export class ApplicationRegistryGateway extends Context.Service<
  ApplicationRegistryGateway,
  ApplicationRegistryGatewayService
>()('@cv/application-registry-mcp-server/ApplicationRegistryGateway') {}

const makeApplicationRegistryGateway = Effect.gen(function* () {
  const api = yield* ApplicationRegistryHttpClient

  return ApplicationRegistryGateway.of({
    create: Effect.fn('ApplicationRegistryGateway.create')((request) =>
      api.applications
        .createApplication({ payload: request })
        .pipe(Effect.mapError(applicationRegistryToolError))
    ),
    list: Effect.fn('ApplicationRegistryGateway.list')((query) =>
      api.applications
        .listApplications({ query })
        .pipe(Effect.mapError(applicationRegistryToolError))
    ),
    show: Effect.fn('ApplicationRegistryGateway.show')((identifier) =>
      api.applications
        .getApplication({ params: { id: identifier } })
        .pipe(Effect.mapError(applicationRegistryToolError))
    ),
    update: Effect.fn('ApplicationRegistryGateway.update')(
      (identifier, idempotencyKey, request) =>
        api.applications
          .updateApplication({
            headers: { 'idempotency-key': idempotencyKey },
            params: { id: identifier },
            payload: request,
          })
          .pipe(Effect.mapError(applicationRegistryToolError))
    ),
  })
})

export const ApplicationRegistryGatewayLive = Layer.effect(
  ApplicationRegistryGateway,
  makeApplicationRegistryGateway
)
