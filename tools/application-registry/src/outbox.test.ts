import { describe, expect, test } from 'bun:test'
import type { AppendApplicationEventRequest } from '@cv/application-registry-api-contract'
import { BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import { FileSystem } from 'effect/FileSystem'

import {
  ApplicationRegistryOutboxConflictError,
  ApplicationRegistryOutboxDecodeError,
} from './errors'
import { makeRegistryOutboxLayer, RegistryOutbox } from './outbox'

const request = (
  applicationStatus: 'applied' | 'rejected' = 'applied',
  operationId = 'operation-1'
): AppendApplicationEventRequest => ({
  deviceId: 'test',
  expectedVersion: null,
  operationId,
  kind: 'stage_changed',
  nextApplicationStatus: applicationStatus,
  occurredAt: '2026-07-10T00:00:00.000Z',
  payload: { applicationStatus },
})

const command = (
  applicationStatus?: 'applied' | 'rejected',
  operationId?: string
) => ({
  _tag: 'AppendApplicationEvent' as const,
  identifier: 'application-1',
  request: request(applicationStatus, operationId),
})

describe('application registry outbox', () => {
  test('stores v3 commands, removes completions, and preserves failures', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem
        const root = yield* fileSystem.makeTempDirectory()
        const outboxLayer = makeRegistryOutboxLayer(root)
        const program = Effect.gen(function* () {
          const outbox = yield* RegistryOutbox
          const queued = yield* outbox.enqueue({
            command: command(),
          })
          const duplicate = yield* outbox.enqueue({
            command: command(),
          })
          const conflict = yield* outbox
            .enqueue({
              command: command('rejected'),
            })
            .pipe(Effect.flip)
          const completed = yield* outbox.enqueue({
            command: command('applied', 'operation-2'),
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
    expect(result.duplicate.version).toBe(3)
    expect(result.conflict).toBeInstanceOf(
      ApplicationRegistryOutboxConflictError
    )
    expect(result.failed.attemptCount).toBe(1)
    expect(result.failed.disposition).toBe('dead-letter')
    expect(result.failed.lastFailure).toBe('invalid payload')
    expect(result.retained).toEqual([result.failed])
  })

  test('rejects obsolete serialized outbox versions', async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem
        const root = yield* fileSystem.makeTempDirectory()
        const outboxLayer = makeRegistryOutboxLayer(root)
        const filePath = `${root}/operation-1.json`
        yield* fileSystem.writeFileString(
          filePath,
          `${JSON.stringify(
            {
              attemptCount: 0,
              command: command(),
              createdAt: '2026-07-10T00:00:00.000Z',
              disposition: 'pending',
              lastFailure: null,
              version: 2,
            },
            null,
            2
          )}\n`
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
