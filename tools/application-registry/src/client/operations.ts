import type {
  AddApplicationNoteRequest,
  CreateApplicationRequest,
  ListApplicationCompensationsQuery,
  ListApplicationsQuery,
  ListEventsQuery,
  PatchApplicationRequest,
  ReplaceApplicationLabelsRequest,
} from '@cv/application-registry-api-contract'
import { Effect } from 'effect'

import { ApplicationRegistryClient } from './model'

export const addApplicationNote = (
  identifier: string,
  request: AddApplicationNoteRequest
) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) => client.addNote(identifier, request))
  )

export const createApplication = (request: CreateApplicationRequest) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) => client.create(request))
  )

export const listApplicationAnnotations = (identifier: string) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) => client.annotations(identifier))
  )

export const listApplications = (query: ListApplicationsQuery = {}) =>
  ApplicationRegistryClient.pipe(Effect.flatMap((client) => client.list(query)))

export const showApplication = (identifier: string) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) => client.show(identifier))
  )

export const listApplicationFacets = ApplicationRegistryClient.pipe(
  Effect.flatMap((client) => client.facets())
)

export const listRegistryEvents = (query: ListEventsQuery = {}) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) => client.listEvents(query))
  )

export const patchApplication = (
  identifier: string,
  request: PatchApplicationRequest
) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) => client.patch(identifier, request))
  )

export const removeApplication = (
  identifier: string,
  expectedVersion?: number
) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) => client.remove(identifier, expectedVersion))
  )

export const replaceApplicationLabels = (
  identifier: string,
  request: ReplaceApplicationLabelsRequest
) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) => client.replaceLabels(identifier, request))
  )

export const upsertApplication = (request: CreateApplicationRequest) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) => client.upsert(request))
  )

export const listApplicationEvents = (identifier: string) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) => client.events(identifier))
  )

export const listApplicationCaptures = (identifier: string) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) => client.captures(identifier))
  )

export const listApplicationCompensations = (
  identifier: string,
  query: ListApplicationCompensationsQuery = {}
) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) => client.compensations(identifier, query))
  )

export const syncApplicationRegistry = ApplicationRegistryClient.pipe(
  Effect.flatMap((client) => client.sync())
)
