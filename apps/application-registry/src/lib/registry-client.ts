import {
  ApplicationRegistryApi,
  type ApplicationsApi,
  type AutomationApi,
  type ContentApi,
  type PublicationsApi,
} from '@cv/application-registry-api-contract'
import { type Duration, Layer } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'
import * as HttpApiClient from 'effect/unstable/httpapi/HttpApiClient'
import type * as HttpApiEndpoint from 'effect/unstable/httpapi/HttpApiEndpoint'
import type * as HttpApiMiddleware from 'effect/unstable/httpapi/HttpApiMiddleware'
import type * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import type * as Atom from 'effect/unstable/reactivity/Atom'
import * as AtomHttpApi from 'effect/unstable/reactivity/AtomHttpApi'

import { hostFetch } from '@/host/desktop'

export const hostHttpClientLayer = FetchHttpClient.layer.pipe(
  Layer.provide(Layer.succeed(FetchHttpClient.Fetch, hostFetch))
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
    baseUrl: '/',
    httpClient: hostHttpClientLayer,
  }
) {}

type RegistryGroups = {
  readonly applications: typeof ApplicationsApi
  readonly automation: typeof AutomationApi
  readonly content: typeof ContentApi
  readonly publications: typeof PublicationsApi
}
type RegistryEndpointIdentifier = {
  [Group in keyof RegistryGroups]: Extract<
    keyof RegistryGroups[Group]['endpoints'],
    string
  >
}[keyof RegistryGroups]
type RegistryEndpoint<Identifier extends RegistryEndpointIdentifier> = {
  [Group in keyof RegistryGroups]: Identifier extends keyof RegistryGroups[Group]['endpoints']
    ? Extract<
        RegistryGroups[Group]['endpoints'][Identifier],
        HttpApiEndpoint.ConstraintRequest
      >
    : never
}[keyof RegistryGroups]
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
> =>
  RegistryClient.mutation(
    endpointGroup(endpoint) as never,
    endpoint as never
  ) as never

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
    endpointGroup(endpoint) as never,
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
    baseUrl: '/',
  })
).pipe(Layer.provide(hostHttpClientLayer))

const endpointGroups = {
  addApplicationNote: 'applications',
  appendContentRevision: 'content',
  approveContentRevision: 'content',
  captureJobPostingSnapshot: 'content',
  createApplication: 'applications',
  ensureContentEntry: 'content',
  getApplication: 'applications',
  getBlob: 'content',
  getContentEntry: 'content',
  getCurrentPdfArtifact: 'publications',
  getCvAnalytics: 'applications',
  getCvLink: 'publications',
  getJobPostingSnapshot: 'content',
  getJobPostingSnapshotPayload: 'content',
  getLatestJobPostingSnapshot: 'content',
  getListingCheckRun: 'automation',
  listActivities: 'applications',
  listApplicationActivities: 'applications',
  listApplicationAnnotations: 'applications',
  listApplicationCompensations: 'applications',
  listApplicationFacets: 'applications',
  listApplicationListingChecks: 'applications',
  listApplications: 'applications',
  listContentRevisions: 'content',
  persistJobPostingSnapshot: 'content',
  stageCv: 'publications',
  putBlob: 'content',
  readContentRevision: 'content',
  readContentRevisionPayload: 'content',
  readCurrentPdfArtifact: 'publications',
  resolveApplicationListingAvailability: 'applications',
  setCvLinkAvailability: 'publications',
  requestPdfGeneration: 'publications',
  submitListingCheckFindings: 'automation',
  updateApplication: 'applications',
} as const satisfies Record<RegistryEndpointIdentifier, keyof RegistryGroups>

const endpointGroup = (endpoint: RegistryEndpointIdentifier) =>
  endpointGroups[endpoint]
