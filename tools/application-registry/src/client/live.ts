import {
  ApplicationRegistryHttpClient,
  makeApplicationRegistryHttpClientLayer,
} from '@cv/application-registry-api-client'
import type {
  AddApplicationNoteRequest,
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

  const addNote = (
    identifier: string,
    idempotencyKey: string,
    request: AddApplicationNoteRequest
  ) =>
    api.applications.addApplicationNote({
      headers: { 'idempotency-key': idempotencyKey },
      params: { id: identifier },
      payload: request,
    })

  const submitListingCheckFindings = (
    runId: string,
    _batchId: string,
    request: SubmitListingCheckFindingsRequest
  ) =>
    api.automation.submitListingCheckFindings({
      params: { runId },
      payload: request,
    })

  const replay = (command: RegistryCommand) => {
    switch (command._tag) {
      case 'AddApplicationNote':
        return addNote(
          command.identifier,
          command.idempotencyKey,
          command.request
        ).pipe(Effect.asVoid)
      case 'SubmitListingCheckFindings':
        return submitListingCheckFindings(
          command.runId,
          command.batchId,
          command.request
        ).pipe(Effect.asVoid)
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
    activities: (identifier) =>
      normalizeHttpFailure(
        api.applications.listApplicationActivities({
          params: { id: identifier },
        })
      ),
    addNote: (identifier, idempotencyKey, request) => {
      const command = {
        _tag: 'AddApplicationNote' as const,
        idempotencyKey,
        identifier,
        request,
      }
      return write({
        command,
        operationId: idempotencyKey,
        send: normalizeHttpFailure(
          addNote(identifier, idempotencyKey, request)
        ),
      })
    },
    annotations: (identifier) =>
      normalizeHttpFailure(
        api.applications.listApplicationAnnotations({
          params: { id: identifier },
        })
      ),
    compensations: (identifier, query = {}) =>
      normalizeHttpFailure(
        api.applications.listApplicationCompensations({
          params: { id: identifier },
          query,
        })
      ),
    create: (request) =>
      normalizeHttpFailure(
        api.applications.createApplication({ payload: request })
      ),
    facets: () =>
      normalizeHttpFailure(api.applications.listApplicationFacets()),
    health: () => normalizeHttpFailure(api.health()),
    list: (query) =>
      normalizeHttpFailure(api.applications.listApplications({ query })),
    listActivities: (query) =>
      normalizeHttpFailure(api.applications.listActivities({ query })),
    listingCheckRun: (identifier) =>
      normalizeHttpFailure(
        api.automation.getListingCheckRun({ params: { id: identifier } })
      ),
    listingChecks: (identifier) =>
      normalizeHttpFailure(
        api.applications.listApplicationListingChecks({
          params: { id: identifier },
        })
      ),
    outbox: () => outbox.list(),
    show: (identifier) =>
      normalizeHttpFailure(
        api.applications.getApplication({ params: { id: identifier } })
      ),
    submitListingCheckFindings: (runId, batchId, request) => {
      const command = {
        _tag: 'SubmitListingCheckFindings' as const,
        batchId,
        request,
        runId,
      }
      return write({
        command,
        operationId: batchId,
        send: normalizeHttpFailure(
          submitListingCheckFindings(runId, batchId, request)
        ),
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
    update: (identifier, idempotencyKey, request) =>
      normalizeHttpFailure(
        api.applications.updateApplication({
          headers: { 'idempotency-key': idempotencyKey },
          params: { id: identifier },
          payload: request,
        })
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
