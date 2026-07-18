import { resolve } from 'node:path'
import { Effect, Redacted } from 'effect'

import { FactsPublisherConfigError } from './errors'

const fullCommitPattern = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u

export type FactsPublisherConfig = {
  readonly channel: string
  readonly compilerCommit: string
  readonly compilerRepository: string
  readonly contentRoot: string
  readonly registryToken: Redacted.Redacted<string>
  readonly registryUrl: URL
  readonly sourceCommit: string
  readonly sourceRepository: string
}

export type FactsPublisherEnvironment = Readonly<
  Record<string, string | undefined>
>

const required = (environment: FactsPublisherEnvironment, name: string) => {
  const value = environment[name]?.trim()
  return value
    ? Effect.succeed(value)
    : Effect.fail(
        new FactsPublisherConfigError({
          message: `Facts publication configuration is missing ${name}.`,
        })
      )
}

const fullCommit = (value: string, name: string) =>
  fullCommitPattern.test(value)
    ? Effect.succeed(value)
    : Effect.fail(
        new FactsPublisherConfigError({
          message: `${name} must be a full 40- or 64-character lowercase hexadecimal commit ID.`,
        })
      )

const registryUrl = (value: string) =>
  Effect.try({
    try: () => new URL(value),
    catch: () =>
      new FactsPublisherConfigError({
        message: 'REGISTRY_API_URL must be an absolute HTTP(S) URL.',
      }),
  }).pipe(
    Effect.filterOrFail(
      (url) => url.protocol === 'https:' || url.protocol === 'http:',
      () =>
        new FactsPublisherConfigError({
          message: 'REGISTRY_API_URL must use HTTP or HTTPS.',
        })
    )
  )

export const readFactsPublisherConfig = Effect.fn('FactsPublisher.readConfig')(
  (environment: FactsPublisherEnvironment) =>
    Effect.gen(function* () {
      const sourceCommit = yield* required(environment, 'FACTS_SOURCE_COMMIT')
      const compilerCommit = yield* required(
        environment,
        'FACTS_COMPILER_COMMIT'
      )
      const token = yield* required(environment, 'REGISTRY_API_TOKEN')
      return {
        channel: environment.FACTS_CHANNEL?.trim() || 'production',
        compilerCommit: yield* fullCommit(
          compilerCommit,
          'FACTS_COMPILER_COMMIT'
        ),
        compilerRepository:
          environment.FACTS_COMPILER_REPOSITORY?.trim() || 'run4w4y/cv',
        contentRoot: resolve(
          yield* required(environment, 'FACTS_CONTENT_ROOT')
        ),
        registryToken: Redacted.make(token),
        registryUrl: yield* registryUrl(
          yield* required(environment, 'REGISTRY_API_URL')
        ),
        sourceCommit: yield* fullCommit(sourceCommit, 'FACTS_SOURCE_COMMIT'),
        sourceRepository:
          environment.FACTS_SOURCE_REPOSITORY?.trim() || 'run4w4y/cv-content',
      } satisfies FactsPublisherConfig
    })
)
