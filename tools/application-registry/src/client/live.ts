import {
  ApplicationRegistryHttpClient,
  makeApplicationRegistryHttpClientLayer,
} from '@cv/application-registry-api-client'
import type {
  AddApplicationNoteRequest,
  AppendApplicationEventRequest,
  SubmitListingCheckFindingsRequest,
} from '@cv/application-registry-api-contract'
import { Effect, Layer } from 'effect'

import type { ApplicationRegistryClientConfig } from '../config'
import {
  type ApplicationRegistryClientError,
  type ApplicationRegistryOutboxError,
  normalizeApplicationRegistryCause,
} from '../errors'
import {
  makeRegistryOutboxLayer,
  type RegistryCommand,
  RegistryOutbox,
  type RegistryOutboxEntry,
  registryCommandOperationId,
} from '../outbox'
import {
  ApplicationRegistryClient,
  type ApplicationRegistryClientService,
  type RegistryWriteResult,
} from './model'
import {
  normalizeHttpFailure,
  registryFailureDisposition,
  withTransientRetries,
} from './retry'

const makeApplicationRegistryClient = Effect.gen(function* () {
  const api = yield* ApplicationRegistryHttpClient
  const outbox = yield* RegistryOutbox

  const appendEvent = (
    identifier: string,
    request: AppendApplicationEventRequest
  ) => {
    const params = { id: identifier }

    // HttpApiClient exposes each Schema.Union member as an overload, so the
    // discriminated request must be narrowed before selecting that overload.
    return 'nextApplicationStatus' in request
      ? api.registry.appendApplicationEvent({ params, payload: request })
      : api.registry.appendApplicationEvent({ params, payload: request })
  }

  const addNote = (identifier: string, request: AddApplicationNoteRequest) =>
    api.registry.addApplicationNote({
      params: { id: identifier },
      payload: request,
    })

  const submitListingCheckFindings = (
    request: SubmitListingCheckFindingsRequest
  ) => api.registry.submitListingCheckFindings({ payload: request })

  const replay = (command: RegistryCommand) => {
    switch (command._tag) {
      case 'AddApplicationNote':
        return addNote(command.identifier, command.request).pipe(Effect.asVoid)
      case 'AppendApplicationEvent':
        return appendEvent(command.identifier, command.request).pipe(
          Effect.asVoid
        )
      case 'SubmitListingCheckFindings':
        return submitListingCheckFindings(command.request).pipe(Effect.asVoid)
    }
  }

  const write = <A>(options: {
    readonly command: RegistryCommand
    readonly operationId: string
    readonly send: Effect.Effect<A, ApplicationRegistryClientError>
  }): Effect.Effect<
    RegistryWriteResult<A>,
    ApplicationRegistryClientError | ApplicationRegistryOutboxError
  > =>
    Effect.gen(function* () {
      const entry = yield* outbox.enqueue({ command: options.command })
      return yield* withTransientRetries(options.send).pipe(
        Effect.matchEffect({
          onSuccess: (response) =>
            outbox
              .complete(entry)
              .pipe(Effect.as({ response, status: 'synced' } as const)),
          onFailure: (error) => {
            const disposition = registryFailureDisposition(error)
            const failure = normalizeApplicationRegistryCause(error)
            const persist = outbox.markFailure(entry, {
              disposition,
              message: failure,
            })
            return disposition === 'retry'
              ? persist.pipe(
                  Effect.as({
                    disposition,
                    failure,
                    operationId: options.operationId,
                    status: 'queued',
                  } as const)
                )
              : persist.pipe(Effect.andThen(Effect.fail(error)))
          },
        })
      )
    })

  const replayEntry = (entry: RegistryOutboxEntry) =>
    withTransientRetries(normalizeHttpFailure(replay(entry.command))).pipe(
      Effect.matchEffect({
        onFailure: (error) => {
          const disposition = registryFailureDisposition(error)
          const failure = normalizeApplicationRegistryCause(error)
          return outbox
            .markFailure(entry, { disposition, message: failure })
            .pipe(
              Effect.as({
                _tag: 'Failed' as const,
                disposition,
                error: failure,
                operationId: registryCommandOperationId(entry.command),
              })
            )
        },
        onSuccess: () =>
          outbox.complete(entry).pipe(
            Effect.as({
              _tag: 'Synced' as const,
              operationId: registryCommandOperationId(entry.command),
            })
          ),
      })
    )

  return {
    addNote: (identifier, request) => {
      const command = {
        _tag: 'AddApplicationNote' as const,
        identifier,
        request,
      }
      return write({
        command,
        operationId: request.operationId,
        send: normalizeHttpFailure(addNote(identifier, request)),
      })
    },
    annotations: (identifier) =>
      normalizeHttpFailure(
        api.registry.listApplicationAnnotations({
          params: { id: identifier },
        })
      ),
    appendEvent: (identifier, request) => {
      const command = {
        _tag: 'AppendApplicationEvent' as const,
        identifier,
        request,
      }
      return write({
        command,
        operationId: request.operationId,
        send: normalizeHttpFailure(appendEvent(identifier, request)),
      })
    },
    create: (request) =>
      normalizeHttpFailure(
        api.registry.createApplication({ payload: request })
      ),
    compensations: (identifier, query = {}) =>
      normalizeHttpFailure(
        api.registry.listApplicationCompensations({
          params: { id: identifier },
          query,
        })
      ),
    events: (identifier) =>
      normalizeHttpFailure(
        api.registry.listApplicationEvents({ params: { id: identifier } })
      ),
    facets: () => normalizeHttpFailure(api.registry.listApplicationFacets()),
    health: () => normalizeHttpFailure(api.health()),
    labels: (identifier) =>
      normalizeHttpFailure(
        api.registry.listApplicationLabels({ params: { id: identifier } })
      ),
    list: (query) =>
      normalizeHttpFailure(api.registry.listApplications({ query })),
    listEvents: (query) =>
      normalizeHttpFailure(api.registry.listEvents({ query })),
    listingCheckRun: (identifier) =>
      normalizeHttpFailure(
        api.registry.getListingCheckRun({ params: { id: identifier } })
      ),
    listingChecks: (identifier) =>
      normalizeHttpFailure(
        api.registry.listApplicationListingChecks({
          params: { id: identifier },
        })
      ),
    outbox: () => outbox.list(),
    patch: (identifier, request) =>
      normalizeHttpFailure(
        api.registry.patchApplication({
          params: { id: identifier },
          payload: request,
        })
      ),
    remove: (identifier, expectedVersion) =>
      normalizeHttpFailure(
        api.registry.deleteApplication({
          params: { id: identifier },
          query: { expectedVersion },
        })
      ),
    replaceLabels: (identifier, request) =>
      normalizeHttpFailure(
        api.registry.replaceApplicationLabels({
          params: { id: identifier },
          payload: request,
        })
      ),
    show: (identifier) =>
      normalizeHttpFailure(
        api.registry.getApplication({ params: { id: identifier } })
      ),
    submitListingCheckFindings: (batchId, request) => {
      const command = {
        _tag: 'SubmitListingCheckFindings' as const,
        batchId,
        request,
      }
      return write({
        command,
        operationId: batchId,
        send: normalizeHttpFailure(submitListingCheckFindings(request)),
      })
    },
    sync: Effect.fn('ApplicationRegistryClient.sync')(function* () {
      const entries = yield* outbox.list()
      const replayable = entries.filter(
        (entry) =>
          entry.disposition === 'pending' || entry.disposition === 'retry'
      )
      const results = yield* Effect.forEach(replayable, replayEntry, {
        concurrency: 1,
      })
      const failed = results.flatMap((result) =>
        result._tag === 'Failed'
          ? [
              {
                disposition: result.disposition,
                error: result.error,
                operationId: result.operationId,
              },
            ]
          : []
      )
      const retained = yield* outbox.list()
      return {
        attempted: replayable.length,
        blocked: retained.filter((entry) => entry.disposition === 'blocked')
          .length,
        deadLetter: retained.filter(
          (entry) => entry.disposition === 'dead-letter'
        ).length,
        failed,
        synced: results.length - failed.length,
      }
    }),
    upsert: (request) =>
      normalizeHttpFailure(
        api.registry.upsertApplication({ payload: request })
      ),
  } satisfies ApplicationRegistryClientService
})

export const ApplicationRegistryClientLive = Layer.effect(
  ApplicationRegistryClient,
  makeApplicationRegistryClient
)

export const makeApplicationRegistryClientLayer = (
  config: ApplicationRegistryClientConfig
) =>
  ApplicationRegistryClientLive.pipe(
    Layer.provide(
      Layer.merge(
        makeApplicationRegistryHttpClientLayer({
          baseUrl: config.apiUrl,
          token: config.token,
        }),
        makeRegistryOutboxLayer(config.outboxDirectory)
      )
    )
  )
