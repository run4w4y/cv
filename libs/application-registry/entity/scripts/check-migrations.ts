import { check, generate } from 'drizzle-kit/cli'
import { Data, Effect } from 'effect'

class MigrationCheckError extends Data.TaggedError('MigrationCheckError')<{
  readonly cause?: unknown
  readonly message: string
}> {}

const drizzleConfig = 'libs/application-registry/entity/drizzle.config.ts'

const invokeDrizzleKit = <Result>(
  operation: string,
  execute: () => Promise<Result>
) =>
  Effect.tryPromise({
    try: execute,
    catch: (cause) =>
      new MigrationCheckError({
        cause,
        message: `Drizzle Kit could not ${operation} the registry migrations.`,
      }),
  })

const program = Effect.gen(function* () {
  const history = yield* invokeDrizzleKit('check', () =>
    check({ config: drizzleConfig })
  )

  if (history.status === 'error') {
    return yield* new MigrationCheckError({
      cause: history.error,
      message: `Drizzle Kit found an invalid registry migration history: ${JSON.stringify(history.error)}`,
    })
  }

  const drift = yield* invokeDrizzleKit('generate', () =>
    generate({ config: drizzleConfig, explain: true })
  )

  switch (drift.status) {
    case 'no_changes':
      return
    case 'error':
      return yield* new MigrationCheckError({
        cause: drift.error,
        message: `Drizzle Kit could not compare the registry schema and migrations: ${JSON.stringify(drift.error)}`,
      })
    case 'missing_hints':
      return yield* new MigrationCheckError({
        cause: drift.unresolved,
        message:
          'The Drizzle schema has changes that require migration hints. Generate and commit a registry migration.',
      })
    case 'ok':
      return yield* new MigrationCheckError({
        message:
          'The Drizzle schema has changes without a generated registry migration.',
      })
  }
})

await Effect.runPromise(program).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
