import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { ensureDirectory } from './files'

const runWithPlatform = <A, E>(
  effect: Effect.Effect<A, E, BunServices.BunServices>
) => Effect.runPromise(effect.pipe(Effect.provide(BunServices.layer)))

describe('pdf export file helpers', () => {
  test('creates directories and writes text through Effect platform', async () => {
    const text = await runWithPlatform(
      FileSystem.pipe(
        Effect.flatMap((fileSystem) =>
          Effect.acquireUseRelease(
            fileSystem.makeTempDirectory(),
            (tempDir) => {
              const outputDir = join(tempDir, 'nested', 'pdf')
              const outputFile = join(outputDir, 'fixture.txt')

              return ensureDirectory(outputDir).pipe(
                Effect.andThen(
                  fileSystem.writeFileString(outputFile, 'hello platform fs')
                ),
                Effect.andThen(fileSystem.readFileString(outputFile))
              )
            },
            (tempDir) =>
              fileSystem
                .remove(tempDir, { recursive: true, force: true })
                .pipe(Effect.catch(() => Effect.void))
          )
        )
      )
    )

    expect(text).toBe('hello platform fs')
  })
})
