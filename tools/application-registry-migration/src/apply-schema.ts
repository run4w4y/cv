import { Cause, Effect, Exit } from 'effect'
import { applyRegistrySchema } from './postgres-schema'
import { readPostgresImportConfiguration } from './postgres-target'

const program = Effect.gen(function* () {
  const config = yield* readPostgresImportConfiguration
  return yield* applyRegistrySchema(config)
})

const exit = await Effect.runPromiseExit(program)
Exit.match(exit, {
  onFailure: (cause) => {
    console.error(Cause.pretty(cause))
    process.exitCode = 1
  },
  onSuccess: (result) => console.log(JSON.stringify(result, null, 2)),
})
