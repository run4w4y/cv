import { Data, Effect, Schema } from 'effect'
import { FileSystem } from 'effect/FileSystem'

export class ApplicationRegistryCliInputError extends Data.TaggedError(
  'ApplicationRegistryCliInputError'
)<{ readonly message: string }> {}

const readStandardInput = Effect.tryPromise({
  try: () => Bun.stdin.text(),
  catch: (cause) =>
    new ApplicationRegistryCliInputError({
      message: `Could not read standard input: ${String(cause)}`,
    }),
})

const readInputText = (path: string) =>
  path === '-'
    ? readStandardInput
    : FileSystem.pipe(
        Effect.flatMap((fileSystem) => fileSystem.readFileString(path)),
        Effect.mapError(
          (cause) =>
            new ApplicationRegistryCliInputError({
              message: `Could not read ${path}: ${cause.message}`,
            })
        )
      )

export const decodeJsonInput = <A, I, R>(
  path: string,
  schema: Schema.Codec<A, I, R>
) =>
  readInputText(path).pipe(
    Effect.flatMap(Schema.decodeUnknownEffect(Schema.fromJsonString(schema))),
    Effect.mapError((cause) =>
      cause instanceof ApplicationRegistryCliInputError
        ? cause
        : new ApplicationRegistryCliInputError({
            message: `Could not decode registry input: ${String(cause)}`,
          })
    )
  )
