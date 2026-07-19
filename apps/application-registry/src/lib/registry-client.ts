import {
  ApplicationRegistryApi,
  type RegistryApi,
} from '@cv/application-registry-api-contract'
import { type Duration, Layer } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'
import * as HttpApiClient from 'effect/unstable/httpapi/HttpApiClient'
import type * as HttpApiEndpoint from 'effect/unstable/httpapi/HttpApiEndpoint'
import type * as HttpApiMiddleware from 'effect/unstable/httpapi/HttpApiMiddleware'
import type * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import type * as Atom from 'effect/unstable/reactivity/Atom'
import * as AtomHttpApi from 'effect/unstable/reactivity/AtomHttpApi'

const browserFetch: typeof globalThis.fetch = Object.assign(
  (input: RequestInfo | URL, init?: RequestInit) =>
    globalThis.fetch(input, init),
  {
    preconnect: (...args: Parameters<typeof globalThis.fetch.preconnect>) =>
      globalThis.fetch.preconnect(...args),
  }
)

export const browserHttpClientLayer = FetchHttpClient.layer.pipe(
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

type RegistryEndpoints = typeof RegistryApi.endpoints
type RegistryEndpointIdentifier = Extract<keyof RegistryEndpoints, string>
type RegistryEndpoint<Identifier extends RegistryEndpointIdentifier> = Extract<
  RegistryEndpoints[Identifier],
  HttpApiEndpoint.ConstraintRequest
>
type RegistryEndpointRequest<Identifier extends RegistryEndpointIdentifier> =
  HttpApiEndpoint.ClientRequest<
    RegistryEndpoint<Identifier>['~Params'],
    RegistryEndpoint<Identifier>['~Query'],
    RegistryEndpoint<Identifier>['~Payload'],
    RegistryEndpoint<Identifier>['~Headers'],
    'decoded-only'
  >
type RegistryEndpointSuccess<Identifier extends RegistryEndpointIdentifier> =
  RegistryEndpoint<Identifier>['~Success']['Type']
type RegistryEndpointError<Identifier extends RegistryEndpointIdentifier> =
  | RegistryEndpoint<Identifier>['~Error']['Type']
  | HttpApiMiddleware.Error<RegistryEndpoint<Identifier>['~Middleware']>
  | HttpApiMiddleware.ClientError<RegistryEndpoint<Identifier>['~Middleware']>
type ReactivityKeys =
  | ReadonlyArray<unknown>
  | Readonly<Record<string, ReadonlyArray<unknown>>>

/**
 * Typed beta.99 adapters for the AtomHttpApi helpers.
 *
 * AtomHttpApi currently constrains an endpoint identifier through its generic
 * `Group` before applying that generic's concrete default, which collapses the
 * endpoint identifier to `never`. Runtime behavior is correct, so these narrow
 * adapters derive requests and responses directly from RegistryApi's endpoint
 * map while keeping the upstream implementation.
 */
export const registryMutation = <Identifier extends RegistryEndpointIdentifier>(
  endpoint: Identifier
): Atom.AtomResultFn<
  RegistryEndpointRequest<Identifier> & {
    readonly reactivityKeys?: ReactivityKeys | undefined
  },
  RegistryEndpointSuccess<Identifier>,
  RegistryEndpointError<Identifier>
> => RegistryClient.mutation('registry' as never, endpoint as never) as never

export const registryQuery = <Identifier extends RegistryEndpointIdentifier>(
  endpoint: Identifier,
  request: RegistryEndpointRequest<Identifier> & {
    readonly reactivityKeys?: ReactivityKeys | undefined
    readonly serializationKey?: string | undefined
    readonly timeToLive?: Duration.Input | undefined
  }
): Atom.Atom<
  AsyncResult.AsyncResult<
    RegistryEndpointSuccess<Identifier>,
    RegistryEndpointError<Identifier>
  >
> =>
  RegistryClient.query(
    'registry' as never,
    endpoint as never,
    request as never
  ) as never

/**
 * The same generated client as a normal Layer for non-query browser Effects.
 *
 * Preparation workflows use this layer directly so their activities keep
 * typed HttpApi errors and interruption instead of crossing a raw Promise /
 * fetch boundary. Atom queries continue to use RegistryClient.runtime.
 */
export const registryClientLayer = Layer.effect(
  RegistryClient,
  HttpApiClient.make(ApplicationRegistryApi, {
    baseUrl: '/api/registry/',
  })
).pipe(Layer.provide(browserHttpClientLayer))
