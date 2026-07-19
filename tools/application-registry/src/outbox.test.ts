import { describe, expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import { FileSystem } from 'effect/FileSystem'

import {
  ApplicationRegistryOutboxConflictError,
  ApplicationRegistryOutboxDecodeError,
} from './errors'
import { makeRegistryOutboxLayer, RegistryOutbox } from './outbox'

const command = (body = 'Follow up', idempotencyKey = 'operation-1') => ({
  _tag: 'AddApplicationNote' as const,
  idempotencyKey,
  identifier: 'application-1',
  request: {
    body,
    kind: 'general' as const,
    source: 'application-registry-cli',
  },
})

describe('application registry outbox', () => {
  test('stores v4 commands, removes completions, and preserves failures', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem
        const root = yield* fileSystem.makeTempDirectory()
        const outboxLayer = makeRegistryOutboxLayer(root)
        const program = Effect.gen(function* () {
          const outbox = yield* RegistryOutbox
          const queued = yield* outbox.enqueue({ command: command() })
          const duplicate = yield* outbox.enqueue({ command: command() })
          const conflict = yield* outbox
            .enqueue({ command: command('Different body') })
            .pipe(Effect.flip)
          const completed = yield* outbox.enqueue({
            command: command('Another note', 'operation-2'),
          })
          yield* outbox.complete(completed)
          const failed = yield* outbox.markFailure(queued, {
            disposition: 'dead-letter',
            message: 'invalid payload',
          })
          const retained = yield* outbox.list()
          return { conflict, duplicate, failed, retained }
        }).pipe(Effect.provide(outboxLayer))
        const value = yield* program
        yield* fileSystem.remove(root, { force: true, recursive: true })
        return value
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(result.duplicate.command).toEqual(command())
    expect(result.duplicate.version).toBe(4)
    expect(result.conflict).toBeInstanceOf(
      ApplicationRegistryOutboxConflictError
    )
    expect(result.failed).toMatchObject({
      attemptCount: 1,
      disposition: 'dead-letter',
      lastFailure: 'invalid payload',
    })
    expect(result.retained).toEqual([result.failed])
  })

  test('rejects obsolete serialized outbox versions', async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem
        const root = yield* fileSystem.makeTempDirectory()
        const outboxLayer = makeRegistryOutboxLayer(root)
        yield* fileSystem.writeFileString(
          `${root}/operation-1.json`,
          `${JSON.stringify({
            attemptCount: 0,
            command: command(),
            createdAt: '2026-07-10T00:00:00.000Z',
            disposition: 'pending',
            lastFailure: null,
            version: 3,
          })}\n`
        )
        const result = yield* RegistryOutbox.pipe(
          Effect.flatMap((outbox) => outbox.list()),
          Effect.flip,
          Effect.provide(outboxLayer)
        )
        yield* fileSystem.remove(root, { force: true, recursive: true })
        return result
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(error).toBeInstanceOf(ApplicationRegistryOutboxDecodeError)
  })
})
