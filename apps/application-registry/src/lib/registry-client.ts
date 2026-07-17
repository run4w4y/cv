import { ApplicationRegistryApi } from '@cv/application-registry-api-contract'
import { Layer } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'
import * as AtomHttpApi from 'effect/unstable/reactivity/AtomHttpApi'

const browserFetch: typeof globalThis.fetch = Object.assign(
  (input: RequestInfo | URL, init?: RequestInit) =>
    globalThis.fetch(input, init),
  {
    preconnect: (...args: Parameters<typeof globalThis.fetch.preconnect>) =>
      globalThis.fetch.preconnect(...args),
  }
)

const browserHttpClientLayer = FetchHttpClient.layer.pipe(
  Layer.provide(Layer.succeed(FetchHttpClient.Fetch, browserFetch))
)

/**
 * The browser's single typed registry client and atom runtime.
 *
 * Requests are generated directly from ApplicationRegistryApi. The development
 * proxy owns authorization, so the browser only needs the Fetch HTTP client.
 */
export class RegistryClient extends AtomHttpApi.Service<RegistryClient>()(
  '@cv/application-registry-management/RegistryClient',
  {
    api: ApplicationRegistryApi,
    baseUrl: '/api/registry/',
    httpClient: browserHttpClientLayer,
  }
) {}
