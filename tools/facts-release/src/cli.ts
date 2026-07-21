#!/usr/bin/env bun

import { type ParseArgsConfig, parseArgs } from 'node:util'
import {
  compileFactsReleaseBundle,
  encodeFactsReleaseBundle,
  verifyFactsReleaseBundle,
} from '@cv/facts-release'
import { BunServices } from '@effect/platform-bun'
import { Cause, Config, Effect, Exit } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'

import { publishFactsBundle } from './client'
import { FactsToolchainError } from './errors'
import { compileFactsCheckout } from './source'

declare const CV_FACTS_COMPILER_COMMIT: string | undefined
declare const CV_FACTS_TOOLCHAIN_VERSION: string | undefined

const compilerRepository = 'run4w4y/cv' as const
const sourceRepository = 'run4w4y/cv-content' as const
const developmentCommit = '0'.repeat(40)
const compilerCommit =
  typeof CV_FACTS_COMPILER_COMMIT === 'string'
    ? CV_FACTS_COMPILER_COMMIT
    : (process.env.CV_FACTS_COMPILER_COMMIT ?? developmentCommit)
const toolchainVersion =
  typeof CV_FACTS_TOOLCHAIN_VERSION === 'string'
    ? CV_FACTS_TOOLCHAIN_VERSION
    : (process.env.CV_FACTS_TOOLCHAIN_VERSION ?? 'development')

const usage = `cv-facts ${toolchainVersion}

Usage:
  cv-facts version [--json]
  cv-facts check [--content-root <path>]
  cv-facts build --source-commit <commit> --output <path> [--content-root <path>]
  cv-facts publish --bundle <path> --registry-url <url>

Publishing reads FACTS_PUBLISH_TOKEN from the environment.`

const toolchainError = (
  issue: FactsToolchainError['issue'],
  message: string,
  cause: unknown
) => new FactsToolchainError({ cause, issue, message })

const requireOption = (
  value: string | undefined,
  option: string
): Effect.Effect<string, FactsToolchainError> =>
  value === undefined || value.trim().length === 0
    ? Effect.fail(
        toolchainError(
          'configuration',
          `The ${option} option is required.`,
          option
        )
      )
    : Effect.succeed(value)

const validateCommit = (
  value: string,
  option: string
): Effect.Effect<string, FactsToolchainError> =>
  /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(value)
    ? Effect.succeed(value)
    : Effect.fail(
        toolchainError(
          'configuration',
          `${option} must be a full lowercase hexadecimal Git commit ID.`,
          value
        )
      )

const parseCommandOptions = <
  const Options extends NonNullable<ParseArgsConfig['options']>,
>(
  args: ReadonlyArray<string>,
  options: Options
) =>
  Effect.try({
    try: () =>
      parseArgs({
        args: [...args],
        options,
        strict: true,
      }).values,
    catch: (cause) =>
      toolchainError('configuration', 'Invalid command-line options.', cause),
  })

const check = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const values = yield* parseCommandOptions(args, {
      'content-root': { type: 'string' },
    })
    const path = yield* Path
    const contentRoot = path.resolve(values['content-root'] ?? '.')
    const release = yield* compileFactsCheckout(contentRoot, {
      compilerCommit,
      compilerRepository,
      sourceCommit: developmentCommit,
      sourceRepository,
    })
    return {
      catalogues: release.catalogues.map(({ locale }) => locale),
      releaseId: release.releaseId,
      sections: release.catalogues.reduce(
        (total, catalogue) => total + catalogue.sections.length,
        0
      ),
    }
  })

const build = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const values = yield* parseCommandOptions(args, {
      'content-root': { type: 'string' },
      output: { type: 'string' },
      'source-commit': { type: 'string' },
    })
    const path = yield* Path
    const fileSystem = yield* FileSystem
    const contentRoot = path.resolve(values['content-root'] ?? '.')
    const output = path.resolve(yield* requireOption(values.output, '--output'))
    const sourceCommit = yield* requireOption(
      values['source-commit'],
      '--source-commit'
    ).pipe(Effect.flatMap((value) => validateCommit(value, '--source-commit')))
    const release = yield* compileFactsCheckout(contentRoot, {
      compilerCommit: yield* validateCommit(
        compilerCommit,
        'embedded compiler commit'
      ),
      compilerRepository,
      sourceCommit,
      sourceRepository,
    })
    const bundle = compileFactsReleaseBundle(release)
    const bytes = yield* encodeFactsReleaseBundle(bundle)
    yield* fileSystem
      .makeDirectory(path.dirname(output), { recursive: true })
      .pipe(
        Effect.flatMap(() => fileSystem.writeFile(output, bytes)),
        Effect.mapError((cause) =>
          toolchainError(
            'io',
            `Could not write facts release bundle ${output}.`,
            cause
          )
        )
      )
    return {
      byteLength: bytes.byteLength,
      objectCount: bundle.objects.length,
      output,
      releaseId: bundle.releaseId,
      sourceCommit,
    }
  })

const publish = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const values = yield* parseCommandOptions(args, {
      bundle: { type: 'string' },
      'registry-url': { type: 'string' },
    })
    const path = yield* Path
    const fileSystem = yield* FileSystem
    const bundlePath = path.resolve(
      yield* requireOption(values.bundle, '--bundle')
    )
    const registryUrlText = yield* requireOption(
      values['registry-url'],
      '--registry-url'
    )
    const registryUrl = yield* Effect.try({
      try: () => new URL(registryUrlText),
      catch: (cause) =>
        toolchainError(
          'configuration',
          '--registry-url must be an absolute URL.',
          cause
        ),
    })
    const bytes = yield* fileSystem
      .readFile(bundlePath)
      .pipe(
        Effect.mapError((cause) =>
          toolchainError(
            'io',
            `Could not read facts release bundle ${bundlePath}.`,
            cause
          )
        )
      )
    const bundle = yield* verifyFactsReleaseBundle(bytes)
    const token = yield* Config.redacted('FACTS_PUBLISH_TOKEN').pipe(
      Effect.mapError((cause) =>
        toolchainError(
          'configuration',
          'FACTS_PUBLISH_TOKEN is required.',
          cause
        )
      )
    )
    const result = yield* publishFactsBundle({
      bundle,
      bytes,
      registryUrl,
      token,
    })
    return {
      activationStatus: result.activated.status,
      objectCount: result.registered.objectCount,
      registrationStatus: result.registered.status,
      releaseId: result.verified.releaseId,
    }
  })

const version = (args: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const values = yield* parseCommandOptions(args, {
      json: { type: 'boolean' },
    })
    const metadata = {
      compilerCommit,
      compilerRepository,
      toolchainVersion,
    }
    return values.json ? JSON.stringify(metadata) : toolchainVersion
  })

const run = Effect.fn('FactsToolchain.run')(function* (
  args: ReadonlyArray<string>
) {
  const [command, ...commandArgs] = args
  switch (command) {
    case 'build':
      return JSON.stringify(yield* build(commandArgs))
    case 'check':
      return JSON.stringify(yield* check(commandArgs))
    case 'publish':
      return JSON.stringify(yield* publish(commandArgs))
    case 'version':
      return yield* version(commandArgs)
    case '--help':
    case '-h':
    case undefined:
      return usage
    default:
      return yield* Effect.fail(
        toolchainError(
          'configuration',
          `Unknown command ${command}.\n\n${usage}`,
          command
        )
      )
  }
})

const exit = await Effect.runPromiseExit(
  Effect.provide(run(process.argv.slice(2)), BunServices.layer)
)

if (Exit.isFailure(exit)) {
  console.error(Cause.pretty(exit.cause))
  process.exitCode = 1
} else {
  process.stdout.write(`${exit.value}\n`)
}
