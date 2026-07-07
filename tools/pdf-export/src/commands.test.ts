import { describe, expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import { runCommand } from './commands'

const runWithPlatform = <A, E>(
  effect: Effect.Effect<A, E, BunServices.BunServices>
) => Effect.runPromise(effect.pipe(Effect.provide(BunServices.layer)))

describe('pdf export commands', () => {
  test('runs a successful command through Effect platform', async () => {
    await runWithPlatform(
      runCommand(process.execPath, ['-e', 'process.exit(0)'])
    )
  })

  test('maps non-zero command exits to PdfProcessError', async () => {
    const result = await Effect.runPromiseExit(
      runCommand(process.execPath, ['-e', 'process.exit(7)']).pipe(
        Effect.provide(BunServices.layer)
      )
    )

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('PdfProcessError')
    expect(result.toString()).toContain('exit code 7')
  })
})
