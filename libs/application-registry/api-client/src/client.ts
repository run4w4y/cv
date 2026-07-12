import { ApplicationRegistryApi } from '@cv/application-registry-api-contract'
import { withBearerToken } from '@cv/effect-http-auth'
import { Context, Layer, type Redacted } from 'effect'
import * as HttpApiClient from 'effect/unstable/httpapi/HttpApiClient'

export type ApplicationRegistryHttpClientService = HttpApiClient.ForApi<
  typeof ApplicationRegistryApi
>

export class ApplicationRegistryHttpClient extends Context.Service<
  ApplicationRegistryHttpClient,
  ApplicationRegistryHttpClientService
>()('@cv/application-registry-api-client/ApplicationRegistryHttpClient') {}

export type ApplicationRegistryHttpClientConfig = {
  readonly baseUrl: URL
  readonly token: Redacted.Redacted<string>
}

export const makeApplicationRegistryHttpClient = (
  config: ApplicationRegistryHttpClientConfig
) =>
  HttpApiClient.make(ApplicationRegistryApi, {
    baseUrl: config.baseUrl,
    transformClient: withBearerToken(config.token),
  })

export const makeApplicationRegistryHttpClientLayer = (
  config: ApplicationRegistryHttpClientConfig
) =>
  Layer.effect(
    ApplicationRegistryHttpClient,
    makeApplicationRegistryHttpClient(config)
  )
