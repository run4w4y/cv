import type {
  AddApplicationNoteRequest,
  AddApplicationNoteResponse,
  ApplicationAnnotationsResponse,
  ApplicationFacetsResponse,
  CreateApplicationRequest,
  HealthResponse,
  ListActivitiesQuery,
  ListActivitiesResponse,
  ListApplicationActivitiesResponse,
  ListApplicationCompensationsQuery,
  ListApplicationCompensationsResponse,
  ListApplicationListingChecksResponse,
  ListApplicationsQuery,
  ListApplicationsResponse,
  SubmitListingCheckFindingsRequest,
  SubmitListingCheckFindingsResponse,
  UpdateApplicationRequest,
  UpdateApplicationResponse,
} from '@cv/application-registry-api-contract'
import type {
  Application,
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
  | { readonly response: A; readonly status: 'synced' }
  | {
      readonly disposition: 'retry'
      readonly failure: string
      readonly operationId: string
      readonly status: 'queued'
    }

export type RegistrySyncFailure = {
  readonly disposition: Exclude<RegistryOutboxDisposition, 'pending'>
  readonly error: string
  readonly operationId: string
}

export type RegistrySyncResult = {
  readonly attempted: number
  readonly blocked: number
  readonly deadLetter: number
  readonly failed: readonly RegistrySyncFailure[]
  readonly synced: number
}

type RegistryReadError =
  | ApplicationRegistryClientError
  | ApplicationRegistryConfigError

type RegistryDurableWriteError =
  | RegistryReadError
  | ApplicationRegistryOutboxError

export type ApplicationRegistryClientService = {
  readonly activities: (
    identifier: string
  ) => Effect.Effect<ListApplicationActivitiesResponse, RegistryReadError>
  readonly addNote: (
    identifier: string,
    idempotencyKey: string,
    request: AddApplicationNoteRequest
  ) => Effect.Effect<
    RegistryWriteResult<AddApplicationNoteResponse>,
    RegistryDurableWriteError
  >
  readonly annotations: (
    identifier: string
  ) => Effect.Effect<ApplicationAnnotationsResponse, RegistryReadError>
  readonly create: (
    request: CreateApplicationRequest
  ) => Effect.Effect<Application, RegistryReadError>
  readonly compensations: (
    identifier: string,
    query?: ListApplicationCompensationsQuery
  ) => Effect.Effect<ListApplicationCompensationsResponse, RegistryReadError>
  readonly facets: () => Effect.Effect<
    ApplicationFacetsResponse,
    RegistryReadError
  >
  readonly health: () => Effect.Effect<HealthResponse, RegistryReadError>
  readonly list: (
    query: ListApplicationsQuery
  ) => Effect.Effect<ListApplicationsResponse, RegistryReadError>
  readonly listActivities: (
    query: ListActivitiesQuery
  ) => Effect.Effect<ListActivitiesResponse, RegistryReadError>
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
  readonly show: (
    identifier: string
  ) => Effect.Effect<Application, RegistryReadError>
  readonly submitListingCheckFindings: (
    runId: string,
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
  readonly update: (
    identifier: string,
    idempotencyKey: string,
    request: UpdateApplicationRequest
  ) => Effect.Effect<UpdateApplicationResponse, RegistryReadError>
}

export class ApplicationRegistryClient extends Context.Service<
  ApplicationRegistryClient,
  ApplicationRegistryClientService
>()('@cv/application-registry/ApplicationRegistryClient') {}
