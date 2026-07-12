import type {
  AddApplicationNoteRequest,
  ListApplicationCompensationsQuery,
  ListApplicationsQuery,
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
