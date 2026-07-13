import type {
  AddApplicationNoteRequest,
  AddApplicationNoteResponse,
  AppendApplicationEventRequest,
  AppendApplicationEventResponse,
  ApplicationAnnotationsResponse,
  CreateCampaignCaptureRequest,
  CreateCampaignCaptureResponse,
  ListApplicationCapturesResponse,
  ListApplicationCompensationsQuery,
  ListApplicationCompensationsResponse,
  ListApplicationEventsResponse,
  ListApplicationsQuery,
  ListApplicationsResponse,
  SubmitListingCheckFindingsRequest,
  SubmitListingCheckFindingsResponse,
} from '@cv/application-registry-api-contract'
import type { Application } from '@cv/application-registry-entity'
import { Context, type Effect } from 'effect'

import type {
  ApplicationRegistryClientError,
  ApplicationRegistryConfigError,
  ApplicationRegistryOutboxError,
} from '../errors'
import type { RegistryOutboxDisposition } from '../outbox'

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
  readonly list: (
    query: ListApplicationsQuery
  ) => Effect.Effect<ListApplicationsResponse, RegistryReadError>
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
}

export class ApplicationRegistryClient extends Context.Service<
  ApplicationRegistryClient,
  ApplicationRegistryClientService
>()('@cv/application-registry/ApplicationRegistryClient') {}
