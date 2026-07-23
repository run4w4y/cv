import type {
  DesktopFetchRequest,
  DesktopFetchResponse,
} from '@cv/application-registry-desktop-contract'
import { Context, Effect, Layer, Redacted, Schema } from 'effect'
import { HttpClient, HttpClientRequest } from 'effect/unstable/http'

import { DesktopSettings } from './settings'

const maximumBodyBytes = 32 * 1024 * 1024
const allowedMethods = new Set([
  'DELETE',
  'GET',
  'HEAD',
  'PATCH',
  'POST',
  'PUT',
])
const forbiddenRequestHeaders = new Set([
  'connection',
  'cookie',
  'host',
  'origin',
  'proxy-authorization',
  'referer',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'transfer-encoding',
])

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
  url === '/api/registry' || url.startsWith('/api/registry/')

const isFrankfurterRatesRequest = (request: DesktopFetchRequest, url: URL) =>
  request.method === 'GET' &&
  url.protocol === 'https:' &&
  url.username === '' &&
  url.password === '' &&
  url.hostname === 'api.frankfurter.dev' &&
  url.port === '' &&
  url.pathname === '/v2/rates' &&
  url.hash === '' &&
  url.searchParams.getAll('base').length === 1 &&
  /^[A-Z]{3}$/u.test(url.searchParams.get('base') ?? '') &&
  [...url.searchParams.keys()].every((key) => key === 'base')

export const isAllowedDesktopExternalRequest = (
  request: DesktopFetchRequest,
  url: URL
) => isFrankfurterRatesRequest(request, url)

const headers = (request: DesktopFetchRequest) => {
  if (request.headers.length > 128) {
    throw new Error('Too many request headers.')
  }
  const result: Record<string, string> = {}
  for (const [rawName, rawValue] of request.headers) {
    const name = rawName.toLowerCase()
    if (
      forbiddenRequestHeaders.has(name) ||
      rawName.length > 256 ||
      rawValue.length > 16_384
    ) {
      throw new Error(`The request header ${rawName} is not allowed.`)
    }
    result[name] = rawValue
  }
  return result
}

const responseHeaderEntries = (values: Readonly<Record<string, string>>) =>
  Object.entries(values)

export interface DesktopNetworkShape {
  readonly fetch: (
    request: DesktopFetchRequest
  ) => Effect.Effect<DesktopFetchResponse, DesktopNetworkError>
}

export class DesktopNetwork extends Context.Service<
  DesktopNetwork,
  DesktopNetworkShape
>()('cv-desktop/DesktopNetwork') {}

export const desktopNetworkLayer = Layer.effect(
  DesktopNetwork,
  Effect.gen(function* () {
    const client = yield* HttpClient.HttpClient
    const settings = yield* DesktopSettings

    const fetch = Effect.fn('DesktopNetwork.fetch')(function* (
      input: DesktopFetchRequest
    ) {
      const request = yield* Effect.try({
        try: () => {
          const method = input.method.toUpperCase()
          if (!allowedMethods.has(method))
            throw new Error('Method is not allowed.')
          if ((method === 'GET' || method === 'HEAD') && input.body !== null) {
            throw new Error(`${method} requests cannot include a body.`)
          }
          if ((input.body?.byteLength ?? 0) > maximumBodyBytes) {
            throw new Error('The request body is too large.')
          }
          return { headers: headers(input), method }
        },
        catch: (cause) =>
          networkError(
            'invalid_request',
            'The network request is invalid.',
            cause
          ),
      })

      let target: URL
      if (isRegistryDesktopRequest(input.url)) {
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
        target = new URL(input.url, credentials.origin)
        request.headers.authorization = `Bearer ${Redacted.value(credentials.token)}`
      } else {
        target = yield* Effect.try({
          try: () => new URL(input.url),
          catch: (cause) =>
            networkError(
              'invalid_request',
              'The request URL is invalid.',
              cause
            ),
        })
        if (!isAllowedDesktopExternalRequest(input, target)) {
          return yield* Effect.fail(
            networkError(
              'invalid_request',
              'The desktop network bridge rejected an unrecognized destination.',
              new Error(target.origin)
            )
          )
        }
        delete request.headers.authorization
      }

      let outbound = HttpClientRequest.make(
        request.method as Parameters<typeof HttpClientRequest.make>[0]
      )(target, { headers: request.headers })
      if (input.body !== null) {
        outbound = HttpClientRequest.bodyUint8Array(outbound, input.body)
      }
      const response = yield* client.execute(outbound).pipe(
        Effect.timeout('120 seconds'),
        Effect.mapError((cause) =>
          networkError('network_failed', 'The network request failed.', cause)
        )
      )
      if (response.status >= 300 && response.status < 400) {
        return yield* Effect.fail(
          networkError(
            'network_failed',
            'The network bridge refused a redirect.',
            new Error(String(response.status))
          )
        )
      }
      const declaredLength = Number(response.headers['content-length'] ?? '0')
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > maximumBodyBytes
      ) {
        return yield* Effect.fail(
          networkError(
            'network_failed',
            'The network response is too large.',
            new Error(String(declaredLength))
          )
        )
      }
      const body = yield* response.arrayBuffer.pipe(
        Effect.mapError((cause) =>
          networkError(
            'network_failed',
            'The response body could not be read.',
            cause
          )
        )
      )
      if (body.byteLength > maximumBodyBytes) {
        return yield* Effect.fail(
          networkError(
            'network_failed',
            'The network response is too large.',
            new Error(String(body.byteLength))
          )
        )
      }
      return {
        body: new Uint8Array(body),
        headers: responseHeaderEntries(response.headers),
        status: response.status,
        statusText: '',
      }
    })

    return DesktopNetwork.of({ fetch })
  })
)
