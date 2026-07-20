import { Config, Effect, type Redacted, Schema } from 'effect'
import { Path, type Path as PathService } from 'effect/Path'

import { FactsPublisherConfigError } from './errors'

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

const requiredTextSchema = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()))

const fullCommitSchema = Schema.String.pipe(
  Schema.check(
    Schema.makeFilter(
      (value) => /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(value),
      {
        message:
          'must be a full 40- or 64-character lowercase hexadecimal commit ID',
      }
    )
  )
)

const accountIdSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-f0-9]{32}$/u))
)

const bucketSchema = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u))
)

const publisherConfig = Config.all({
  compilerCommit: Config.schema(fullCommitSchema, 'FACTS_COMPILER_COMMIT'),
  compilerRepository: Config.schema(
    requiredTextSchema,
    'FACTS_COMPILER_REPOSITORY'
  ).pipe(Config.withDefault('run4w4y/cv')),
  contentRoot: Config.schema(requiredTextSchema, 'FACTS_CONTENT_ROOT'),
  r2AccessKeyId: Config.redacted('FACTS_R2_ACCESS_KEY_ID'),
  r2AccountId: Config.schema(accountIdSchema, 'FACTS_R2_ACCOUNT_ID'),
  r2Bucket: Config.schema(bucketSchema, 'FACTS_R2_BUCKET'),
  r2SecretAccessKey: Config.redacted('FACTS_R2_SECRET_ACCESS_KEY'),
  sourceCommit: Config.schema(fullCommitSchema, 'FACTS_SOURCE_COMMIT'),
  sourceRepository: Config.schema(
    requiredTextSchema,
    'FACTS_SOURCE_REPOSITORY'
  ).pipe(Config.withDefault('run4w4y/cv-content')),
})

export const readFactsPublisherConfig = Effect.fn('FactsPublisher.readConfig')(
  (): Effect.Effect<
    FactsPublisherConfig,
    FactsPublisherConfigError,
    PathService
  > =>
    Effect.gen(function* () {
      const path = yield* Path
      const config = yield* publisherConfig.pipe(
        Effect.mapError(
          (cause) =>
            new FactsPublisherConfigError({
              cause,
              message: String(cause),
            })
        )
      )
      return {
        ...config,
        contentRoot: path.resolve(config.contentRoot),
      }
    })
)
