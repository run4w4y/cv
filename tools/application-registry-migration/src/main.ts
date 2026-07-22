import { parseArgs } from 'node:util'
import { Cause, Effect, Exit } from 'effect'

import { loadD1Source } from './d1-source'
import { migrationError } from './errors'
import {
  importD1IntoPostgres,
  readPostgresImportConfiguration,
} from './postgres-target'

const readArguments = Effect.try({
  try: () => {
    const parsed = parseArgs({
      args: process.argv.slice(2),
      allowPositionals: false,
      options: {
        sha256: { type: 'string' },
        source: { short: 's', type: 'string' },
        'validate-only': { type: 'boolean', default: false },
      },
      strict: true,
    })
    const source = parsed.values.source
    const sha256 = parsed.values.sha256
    if (source === undefined || sha256 === undefined) {
      throw new Error('--source and --sha256 are required.')
    }
    return {
      sha256,
      source,
      validateOnly: parsed.values['validate-only'],
    }
  },
  catch: migrationError(
    'read command arguments',
    'Usage: --source <d1-export.sql> --sha256 <digest> [--validate-only]'
  ),
})

const program = Effect.gen(function* () {
  const options = yield* readArguments
  const source = yield* loadD1Source(options.source, options.sha256)
  const sourceCounts = Object.fromEntries(
    Array.from(source.rows, ([table, rows]) => [table, rows.length])
  )

  if (options.validateOnly) {
    return {
      mode: 'validated' as const,
      migrations: source.migrations,
      sourceDiagnostics: source.diagnostics,
      sourceCounts,
      sourceSha256: source.sha256,
    }
  }

  const config = yield* readPostgresImportConfiguration
  const imported = yield* importD1IntoPostgres(source, config)
  return {
    mode: imported.alreadyImported
      ? ('already-imported' as const)
      : ('imported' as const),
    migrations: source.migrations,
    sourceDiagnostics: source.diagnostics,
    sourceCounts,
    ...imported,
  }
})

const exit = await Effect.runPromiseExit(program)
Exit.match(exit, {
  onFailure: (cause) => {
    console.error(Cause.pretty(cause))
    process.exitCode = 1
  },
  onSuccess: (result) => console.log(JSON.stringify(result, null, 2)),
})
