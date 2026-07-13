import type {
  AddApplicationNoteRequest,
  AddApplicationNoteResponse,
  AppendApplicationEventRequest,
  AppendApplicationEventResponse,
  ApplicationAnnotationsResponse,
  ApplicationFacetsResponse,
  CreateApplicationRequest,
  CreateCampaignCaptureRequest,
  CreateCampaignCaptureResponse,
  HealthResponse,
  ListApplicationCapturesResponse,
  ListApplicationCompensationsQuery,
  ListApplicationCompensationsResponse,
  ListApplicationEventsResponse,
  ListApplicationLabelsResponse,
  ListApplicationListingChecksResponse,
  ListApplicationsQuery,
  ListApplicationsResponse,
  ListEventsQuery,
  ListEventsResponse,
  PatchApplicationRequest,
  ReplaceApplicationLabelsRequest,
  SubmitListingCheckFindingsRequest,
  SubmitListingCheckFindingsResponse,
} from '@cv/application-registry-api-contract'
import type {
  Application,
  ApplicationLabel,
  ListingCheckRun,
} from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type {
  ApplicationRegistryClientError,
  ApplicationRegistryConfigError,
  ApplicationRegistryOutboxError,
} from '../errors'
import type { RegistryOutboxDisposition, RegistryOutboxEntry } from '../outbox'

export type RegistryWriteResult<A> =
  | {
      readonly status: 'synced'
      readonly response: A
    }
  | {
      readonly status: 'queued'
      readonly operationId: string
      readonly failure: string
      readonly disposition: 'retry'
    }

export type RegistrySyncFailure = {
  readonly operationId: string
  readonly error: string
  readonly disposition: Exclude<RegistryOutboxDisposition, 'pending'>
}

export type RegistrySyncResult = {
  readonly attempted: number
  readonly blocked: number
  readonly deadLetter: number
  readonly failed: readonly RegistrySyncFailure[]
  readonly retainedSynced: number
  readonly synced: number
}

type RegistryReadError =
  | ApplicationRegistryClientError
  | ApplicationRegistryConfigError

type RegistryDurableWriteError =
  | RegistryReadError
  | ApplicationRegistryOutboxError

export type ApplicationRegistryClientService = {
  readonly addNote: (
    identifier: string,
    request: AddApplicationNoteRequest
  ) => Effect.Effect<
    RegistryWriteResult<AddApplicationNoteResponse>,
    RegistryDurableWriteError
  >
  readonly annotations: (
    identifier: string
  ) => Effect.Effect<ApplicationAnnotationsResponse, RegistryReadError>
  readonly appendEvent: (
    identifier: string,
    request: AppendApplicationEventRequest
  ) => Effect.Effect<
    RegistryWriteResult<AppendApplicationEventResponse>,
    RegistryDurableWriteError
  >
  readonly create: (
    request: CreateApplicationRequest
  ) => Effect.Effect<Application, RegistryReadError>
  readonly capture: (
    request: CreateCampaignCaptureRequest
  ) => Effect.Effect<
    RegistryWriteResult<CreateCampaignCaptureResponse>,
    RegistryDurableWriteError
  >
  readonly captures: (
    identifier: string
  ) => Effect.Effect<ListApplicationCapturesResponse, RegistryReadError>
  readonly compensations: (
    identifier: string,
    query?: ListApplicationCompensationsQuery
  ) => Effect.Effect<ListApplicationCompensationsResponse, RegistryReadError>
  readonly events: (
    identifier: string
  ) => Effect.Effect<ListApplicationEventsResponse, RegistryReadError>
  readonly facets: () => Effect.Effect<
    ApplicationFacetsResponse,
    RegistryReadError
  >
  readonly health: () => Effect.Effect<HealthResponse, RegistryReadError>
  readonly labels: (
    identifier: string
  ) => Effect.Effect<ListApplicationLabelsResponse, RegistryReadError>
  readonly list: (
    query: ListApplicationsQuery
  ) => Effect.Effect<ListApplicationsResponse, RegistryReadError>
  readonly listEvents: (
    query: ListEventsQuery
  ) => Effect.Effect<ListEventsResponse, RegistryReadError>
  readonly listingCheckRun: (
    identifier: string
  ) => Effect.Effect<ListingCheckRun, RegistryReadError>
  readonly listingChecks: (
    identifier: string
  ) => Effect.Effect<ListApplicationListingChecksResponse, RegistryReadError>
  readonly outbox: () => Effect.Effect<
    readonly RegistryOutboxEntry[],
    RegistryDurableWriteError
  >
  readonly patch: (
    identifier: string,
    request: PatchApplicationRequest
  ) => Effect.Effect<Application, RegistryReadError>
  readonly remove: (
    identifier: string,
    expectedVersion?: number
  ) => Effect.Effect<void, RegistryReadError>
  readonly replaceLabels: (
    identifier: string,
    request: ReplaceApplicationLabelsRequest
  ) => Effect.Effect<readonly ApplicationLabel[], RegistryReadError>
  readonly show: (
    identifier: string
  ) => Effect.Effect<Application, RegistryReadError>
  readonly submitListingCheckFindings: (
    batchId: string,
    request: SubmitListingCheckFindingsRequest
  ) => Effect.Effect<
    RegistryWriteResult<SubmitListingCheckFindingsResponse>,
    RegistryDurableWriteError
  >
  readonly sync: () => Effect.Effect<
    RegistrySyncResult,
    RegistryDurableWriteError
  >
  readonly upsert: (
    request: CreateApplicationRequest
  ) => Effect.Effect<Application, RegistryReadError>
}

export class ApplicationRegistryClient extends Context.Service<
  ApplicationRegistryClient,
  ApplicationRegistryClientService
>()('@cv/application-registry/ApplicationRegistryClient') {}
