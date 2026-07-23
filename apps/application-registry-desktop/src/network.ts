import { applicationRegistryApiPrefix } from '@cv/application-registry-api-contract'
import type {
  DesktopFetchRequest,
  DesktopFetchResponse,
} from '@cv/application-registry-desktop-contract'
import { Context, type Duration, Effect, Layer, Redacted, Schema } from 'effect'
import { HttpClient, HttpClientRequest } from 'effect/unstable/http'

import { DesktopSettings } from './settings'

export class DesktopNetworkError extends Schema.TaggedErrorClass<DesktopNetworkError>()(
  'DesktopNetworkError',
  {
    cause: Schema.Defect(),
    code: Schema.Literals([
      'invalid_request',
      'network_failed',
      'registry_not_configured',
    ]),
    message: Schema.String,
  }
) {}

const networkError = (
  code: DesktopNetworkError['code'],
  message: string,
  cause: unknown
) => new DesktopNetworkError({ cause, code, message })

export const isRegistryDesktopRequest = (url: string) =>
  url === applicationRegistryApiPrefix ||
  url.startsWith(`${applicationRegistryApiPrefix}/`)

const isResolvedRegistryTarget = (target: URL, configuredOrigin: string) => {
  try {
    const decoded = new URL(decodeURIComponent(target.pathname), target.origin)
    return (
      target.origin === new URL(configuredOrigin).origin &&
      isRegistryDesktopRequest(target.pathname) &&
      isRegistryDesktopRequest(decoded.pathname)
    )
  } catch {
    return false
  }
}

const responseHeaderEntries = (values: Readonly<Record<string, string>>) =>
  Object.entries(values)

const requestHeaders = (
  values: DesktopFetchRequest['headers'],
  authorization: string
) => ({
  ...Object.fromEntries(
    values.map(([name, value]) => [name.toLowerCase(), value])
  ),
  authorization,
})

const requestError = (cause: unknown) =>
  Schema.is(DesktopNetworkError)(cause)
    ? cause
    : networkError('network_failed', 'The network request failed.', cause)

export interface DesktopNetworkShape {
  readonly fetch: (
    request: DesktopFetchRequest
  ) => Effect.Effect<DesktopFetchResponse, DesktopNetworkError>
}

export class DesktopNetwork extends Context.Service<
  DesktopNetwork,
  DesktopNetworkShape
>()('cv-desktop/DesktopNetwork') {}

export const desktopNetworkLayer = (
  options: { readonly requestTimeout?: Duration.Input } = {}
) =>
  Layer.effect(
    DesktopNetwork,
    Effect.gen(function* () {
      const client = yield* HttpClient.HttpClient
      const settings = yield* DesktopSettings

      const fetch = Effect.fn('DesktopNetwork.fetch')(
        function* (input: DesktopFetchRequest) {
          if (!isRegistryDesktopRequest(input.url)) {
            return yield* Effect.fail(
              networkError(
                'invalid_request',
                'The desktop network bridge accepts only Registry API requests.',
                new Error(input.url)
              )
            )
          }

          const credentials = yield* settings.read.pipe(
            Effect.mapError((cause) =>
              networkError('registry_not_configured', cause.message, cause)
            )
          )
          if (credentials === null) {
            return yield* Effect.fail(
              networkError(
                'registry_not_configured',
                'The desktop Registry connection is not configured.',
                new Error('Missing credentials')
              )
            )
          }

          const headers = requestHeaders(
            input.headers,
            `Bearer ${Redacted.value(credentials.token)}`
          )
          const target = new URL(input.url, credentials.origin)
          if (!isResolvedRegistryTarget(target, credentials.origin)) {
            return yield* Effect.fail(
              networkError(
                'invalid_request',
                'The desktop network bridge accepts only Registry API requests.',
                new Error(target.href)
              )
            )
          }
          let outbound = HttpClientRequest.make(
            input.method.toUpperCase() as Parameters<
              typeof HttpClientRequest.make
            >[0]
          )(target.href, { headers })
          if (input.body !== null) {
            outbound = HttpClientRequest.bodyUint8Array(outbound, input.body)
          }

          const response = yield* client.execute(outbound)
          const body = yield* response.arrayBuffer
          return {
            body: new Uint8Array(body),
            headers: responseHeaderEntries(response.headers),
            status: response.status,
            statusText: '',
          }
        },
        (effect) =>
          effect.pipe(
            Effect.timeout(options.requestTimeout ?? '120 seconds'),
            Effect.mapError(requestError)
          )
      )

      return DesktopNetwork.of({ fetch })
    })
  )
