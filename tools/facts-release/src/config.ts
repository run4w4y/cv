import { resolve } from 'node:path'
import { Effect, Redacted } from 'effect'

import { FactsPublisherConfigError } from './errors'

const fullCommitPattern = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u

export type FactsPublisherConfig = {
  readonly compilerCommit: string
  readonly compilerRepository: string
  readonly contentRoot: string
  readonly r2AccessKeyId: Redacted.Redacted<string>
  readonly r2AccountId: string
  readonly r2Bucket: string
  readonly r2SecretAccessKey: Redacted.Redacted<string>
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

const accountIdPattern = /^[a-f0-9]{32}$/u
const bucketPattern = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u

const matching = (value: string, name: string, pattern: RegExp) =>
  pattern.test(value)
    ? Effect.succeed(value)
    : Effect.fail(
        new FactsPublisherConfigError({
          message: `${name} has an invalid value.`,
        })
      )

export const readFactsPublisherConfig = Effect.fn('FactsPublisher.readConfig')(
  (environment: FactsPublisherEnvironment) =>
    Effect.gen(function* () {
      const sourceCommit = yield* required(environment, 'FACTS_SOURCE_COMMIT')
      const compilerCommit = yield* required(
        environment,
        'FACTS_COMPILER_COMMIT'
      )
      const r2AccountId = yield* required(environment, 'FACTS_R2_ACCOUNT_ID')
      const r2Bucket = yield* required(environment, 'FACTS_R2_BUCKET')
      return {
        compilerCommit: yield* fullCommit(
          compilerCommit,
          'FACTS_COMPILER_COMMIT'
        ),
        compilerRepository:
          environment.FACTS_COMPILER_REPOSITORY?.trim() || 'run4w4y/cv',
        contentRoot: resolve(
          yield* required(environment, 'FACTS_CONTENT_ROOT')
        ),
        r2AccessKeyId: Redacted.make(
          yield* required(environment, 'FACTS_R2_ACCESS_KEY_ID')
        ),
        r2AccountId: yield* matching(
          r2AccountId,
          'FACTS_R2_ACCOUNT_ID',
          accountIdPattern
        ),
        r2Bucket: yield* matching(r2Bucket, 'FACTS_R2_BUCKET', bucketPattern),
        r2SecretAccessKey: Redacted.make(
          yield* required(environment, 'FACTS_R2_SECRET_ACCESS_KEY')
        ),
        sourceCommit: yield* fullCommit(sourceCommit, 'FACTS_SOURCE_COMMIT'),
        sourceRepository:
          environment.FACTS_SOURCE_REPOSITORY?.trim() || 'run4w4y/cv-content',
      } satisfies FactsPublisherConfig
    })
)
