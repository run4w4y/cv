import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import * as FileSystem from 'effect/FileSystem'
import * as PlatformError from 'effect/PlatformError'

import type { DesktopDiagnosticsShape } from '../diagnostics'
import { cleanupCodexWorkingDirectory } from './service'

const cleanupError = (tag: PlatformError.SystemErrorTag) =>
  PlatformError.systemError({
    _tag: tag,
    method: 'remove',
    module: 'FileSystem',
    pathOrDescriptor: 'C:\\Temp\\cv-registry-codex-test',
  })

describe('Codex working-directory cleanup', () => {
  test('retries a transient Windows handle-release failure', async () => {
    let attempts = 0
    const events: Array<string> = []
    const fs = FileSystem.makeNoop({
      remove: () =>
        Effect.suspend(() => {
          attempts += 1
          return attempts < 3 ? Effect.fail(cleanupError('Busy')) : Effect.void
        }),
    })
    const diagnostics: DesktopDiagnosticsShape = {
      log: (_level, event) =>
        Effect.sync(() => {
          events.push(event)
        }),
    }

    await Effect.runPromise(
      cleanupCodexWorkingDirectory(
        fs,
        diagnostics,
        'C:\\Temp\\cv-registry-codex-test',
        { delay: '0 millis', times: 4 }
      )
    )

    expect(attempts).toBe(3)
    expect(events).toEqual([])
  })

  test('logs exhausted cleanup without failing the completed operation', async () => {
    let attempts = 0
    const events: Array<string> = []
    const fs = FileSystem.makeNoop({
      remove: () =>
        Effect.suspend(() => {
          attempts += 1
          return Effect.fail(cleanupError('Busy'))
        }),
    })
    const diagnostics: DesktopDiagnosticsShape = {
      log: (_level, event) =>
        Effect.sync(() => {
          events.push(event)
        }),
    }

    await Effect.runPromise(
      cleanupCodexWorkingDirectory(
        fs,
        diagnostics,
        'C:\\Temp\\cv-registry-codex-test',
        { delay: '0 millis', times: 2 }
      )
    )

    expect(attempts).toBe(3)
    expect(events).toEqual(['codex-temp-cleanup-failed'])
  })

  test('does not retry a permanent cleanup failure', async () => {
    let attempts = 0
    const events: Array<string> = []
    const fs = FileSystem.makeNoop({
      remove: () =>
        Effect.suspend(() => {
          attempts += 1
          return Effect.fail(cleanupError('InvalidData'))
        }),
    })
    const diagnostics: DesktopDiagnosticsShape = {
      log: (_level, event) =>
        Effect.sync(() => {
          events.push(event)
        }),
    }

    await Effect.runPromise(
      cleanupCodexWorkingDirectory(
        fs,
        diagnostics,
        'C:\\Temp\\cv-registry-codex-test',
        { delay: '0 millis', times: 4 }
      )
    )

    expect(attempts).toBe(1)
    expect(events).toEqual(['codex-temp-cleanup-failed'])
  })
})
