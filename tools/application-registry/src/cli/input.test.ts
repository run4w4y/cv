import { describe, expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect, Result, Schema } from 'effect'
import { FileSystem } from 'effect/FileSystem'

import { decodeJsonInput } from './input'

const InputSchema = Schema.Struct({
  count: Schema.Int,
  name: Schema.String,
})

describe('registry CLI JSON input', () => {
  test('decodes a file through the supplied Effect schema', async () => {
    const value = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem
        const root = yield* fileSystem.makeTempDirectory()
        const path = `${root}/input.json`
        yield* fileSystem.writeFileString(
          path,
          JSON.stringify({ count: 2, ignored: true, name: 'registry' })
        )
        return yield* decodeJsonInput(path, InputSchema).pipe(
          Effect.ensuring(
            fileSystem
              .remove(root, { force: true, recursive: true })
              .pipe(Effect.ignore)
          )
        )
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(value).toEqual({ count: 2, name: 'registry' })
  })

  test('reports invalid JSON as a CLI input error', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem
        const root = yield* fileSystem.makeTempDirectory()
        const path = `${root}/input.json`
        yield* fileSystem.writeFileString(path, '{')
        return yield* Effect.result(decodeJsonInput(path, InputSchema)).pipe(
          Effect.ensuring(
            fileSystem
              .remove(root, { force: true, recursive: true })
              .pipe(Effect.ignore)
          )
        )
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(Result.isFailure(result) ? result.failure._tag : null).toBe(
      'ApplicationRegistryCliInputError'
    )
  })
})
