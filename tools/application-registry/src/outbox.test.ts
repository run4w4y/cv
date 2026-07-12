import { describe, expect, test } from 'bun:test'
import type { AppendApplicationEventRequest } from '@cv/application-registry-api-contract'
import { BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import { FileSystem } from 'effect/FileSystem'

import { ApplicationRegistryOutboxConflictError } from './errors'
import { makeRegistryOutboxLayer, RegistryOutbox } from './outbox'

const request = (
  applicationStatus: 'applied' | 'rejected' = 'applied'
): AppendApplicationEventRequest => ({
  deviceId: 'test',
  expectedVersion: null,
  operationId: 'operation-1',
  kind: 'stage_changed',
  nextApplicationStatus: applicationStatus,
  occurredAt: '2026-07-10T00:00:00.000Z',
  payload: { applicationStatus },
})

const command = (applicationStatus?: 'applied' | 'rejected') => ({
  _tag: 'AppendApplicationEvent' as const,
  identifier: 'application-1',
  request: request(applicationStatus),
})

describe('application registry outbox', () => {
  test('stores typed commands and preserves terminal failures', async () => {
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
          const failed = yield* outbox.markFailure(queued, {
            disposition: 'dead-letter',
            message: 'invalid payload',
          })
          const pending = yield* outbox.list()
          return { conflict, duplicate, failed, pending }
        }).pipe(Effect.provide(outboxLayer))
        const value = yield* program
        yield* fileSystem.remove(root, { force: true, recursive: true })
        return value
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(result.duplicate.command).toEqual(command())
    expect(result.conflict).toBeInstanceOf(
      ApplicationRegistryOutboxConflictError
    )
    expect(result.failed.attemptCount).toBe(1)
    expect(result.failed.disposition).toBe('dead-letter')
    expect(result.failed.lastFailure).toBe('invalid payload')
    expect(result.pending).toHaveLength(1)
  })
})
