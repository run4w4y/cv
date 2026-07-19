import type {
  AddApplicationNoteRequest,
  CreateApplicationRequest,
  ListActivitiesQuery,
  ListApplicationCompensationsQuery,
  ListApplicationsQuery,
  UpdateApplicationRequest,
} from '@cv/application-registry-api-contract'
import { Effect } from 'effect'

import { ApplicationRegistryClient } from './model'

export const addApplicationNote = (
  identifier: string,
  idempotencyKey: string,
  request: AddApplicationNoteRequest
) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) =>
      client.addNote(identifier, idempotencyKey, request)
    )
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

export const listRegistryActivities = (query: ListActivitiesQuery = {}) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) => client.listActivities(query))
  )

export const updateApplication = (
  identifier: string,
  idempotencyKey: string,
  request: UpdateApplicationRequest
) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) =>
      client.update(identifier, idempotencyKey, request)
    )
  )

export const listApplicationActivities = (identifier: string) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) => client.activities(identifier))
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
