import { Crypto, DateTime, Effect, Layer, Schema } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'
import { isEqual } from 'es-toolkit'

import {
  ApplicationRegistryOutboxConflictError,
  ApplicationRegistryOutboxDecodeError,
  ApplicationRegistryOutboxFileError,
} from '../errors'
import {
  RegistryOutbox,
  type RegistryOutboxEntry,
  RegistryOutboxEntrySchema,
  type RegistryOutboxService,
  registryCommandOperationId,
  registryOutboxEntryVersion,
} from './model'

const fileError = (path: string, message: string) => (cause: unknown) =>
  new ApplicationRegistryOutboxFileError({ cause, message, path })

const decodeError = (path: string, message: string) => (cause: unknown) =>
  new ApplicationRegistryOutboxDecodeError({ cause, message, path })

const stringifyEntry = (entry: RegistryOutboxEntry, path: string) =>
  Effect.try({
    try: () => `${JSON.stringify(entry, null, 2)}\n`,
    catch: decodeError(
      path,
      `Could not serialize registry outbox entry ${path}`
    ),
  })

const makeRegistryOutbox = (directory: string) =>
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto
    const fileSystem = yield* FileSystem
    const path = yield* Path

    const entryPath = (operationId: string) =>
      path.join(directory, `${operationId}.json`)

    const read = Effect.fn('RegistryOutbox.read')(function* (filePath: string) {
      const contents = yield* fileSystem
        .readFileString(filePath)
        .pipe(
          Effect.mapError(
            fileError(
              filePath,
              `Could not read registry outbox entry ${filePath}`
            )
          )
        )
      const parsed = yield* Effect.try({
        try: () => JSON.parse(contents),
        catch: decodeError(
          filePath,
          `Registry outbox entry ${filePath} is not valid JSON`
        ),
      })
      return yield* Schema.decodeUnknownEffect(RegistryOutboxEntrySchema)(
        parsed
      ).pipe(
        Effect.mapError(
          decodeError(
            filePath,
            `Registry outbox entry ${filePath} does not match the current typed command format`
          )
        )
      )
    })

    const write = Effect.fn('RegistryOutbox.write')(function* (
      entry: RegistryOutboxEntry
    ) {
      const operationId = registryCommandOperationId(entry.command)
      const finalPath = entryPath(operationId)
      const temporaryId = yield* crypto.randomUUIDv7.pipe(
        Effect.mapError(
          fileError(finalPath, 'Could not generate an outbox temporary file ID')
        )
      )
      const tempPath = path.join(
        directory,
        `.${operationId}.${temporaryId}.tmp`
      )
      const contents = yield* stringifyEntry(entry, finalPath)

      yield* fileSystem
        .makeDirectory(directory, { recursive: true })
        .pipe(
          Effect.mapError(
            fileError(
              directory,
              `Could not create registry outbox ${directory}`
            )
          )
        )
      yield* fileSystem
        .writeFileString(tempPath, contents)
        .pipe(
          Effect.mapError(
            fileError(
              tempPath,
              `Could not stage registry outbox entry ${tempPath}`
            )
          ),
          Effect.andThen(
            fileSystem
              .rename(tempPath, finalPath)
              .pipe(
                Effect.mapError(
                  fileError(
                    finalPath,
                    `Could not commit registry outbox entry ${finalPath}`
                  )
                )
              )
          ),
          Effect.ensuring(
            fileSystem.remove(tempPath, { force: true }).pipe(Effect.ignore)
          )
        )
      return entry
    })

    return {
      enqueue: Effect.fn('RegistryOutbox.enqueue')(function* (input) {
        const operationId = registryCommandOperationId(input.command)
        const finalPath = entryPath(operationId)
        const alreadyQueued = yield* fileSystem
          .exists(finalPath)
          .pipe(
            Effect.mapError(
              fileError(
                finalPath,
                `Could not inspect registry outbox entry ${finalPath}`
              )
            )
          )
        if (alreadyQueued) {
          const existing = yield* read(finalPath)
          if (!isEqual(existing.command, input.command)) {
            return yield* new ApplicationRegistryOutboxConflictError({
              message: `Registry operation ${operationId} is already queued with different command data`,
              operationId,
              path: finalPath,
            })
          }
          return existing
        }

        const now = yield* DateTime.now
        const entry = yield* Schema.decodeUnknownEffect(
          RegistryOutboxEntrySchema
        )({
          attemptCount: 0,
          command: input.command,
          createdAt: DateTime.formatIso(now),
          disposition: 'pending',
          lastFailure: null,
          version: registryOutboxEntryVersion,
        }).pipe(
          Effect.mapError(
            decodeError(
              finalPath,
              'Could not construct a valid registry outbox entry'
            )
          )
        )
        return yield* write(entry)
      }),
      list: Effect.fn('RegistryOutbox.list')(function* () {
        const exists = yield* fileSystem
          .exists(directory)
          .pipe(
            Effect.mapError(
              fileError(
                directory,
                `Could not inspect registry outbox ${directory}`
              )
            )
          )
        if (!exists) return []

        const names = yield* fileSystem
          .readDirectory(directory)
          .pipe(
            Effect.mapError(
              fileError(
                directory,
                `Could not list registry outbox ${directory}`
              )
            )
          )
        const entries = yield* Effect.forEach(
          names.filter((name) => name.endsWith('.json')).sort(),
          (name) => read(path.join(directory, name)),
          { concurrency: 8 }
        )
        return entries.sort((left, right) =>
          left.createdAt.localeCompare(right.createdAt)
        )
      }),
      markFailure: Effect.fn('RegistryOutbox.markFailure')(
        function* (entry, failure) {
          return yield* write({
            ...entry,
            attemptCount: entry.attemptCount + 1,
            disposition: failure.disposition,
            lastFailure: failure.message,
          })
        }
      ),
      markSynced: Effect.fn('RegistryOutbox.markSynced')(function* (entry) {
        return yield* write({
          ...entry,
          disposition: 'synced',
          lastFailure: null,
        })
      }),
    } satisfies RegistryOutboxService
  })

export const makeRegistryOutboxLayer = (directory: string) =>
  Layer.effect(RegistryOutbox, makeRegistryOutbox(directory))
