import { describe, expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { ConfigProvider, Effect, Redacted } from 'effect'

import { readFactsPublisherConfig } from './config'

const environment = {
  FACTS_COMPILER_COMMIT: 'b'.repeat(40),
  FACTS_CONTENT_ROOT: '/tmp/reviewed-facts',
  FACTS_R2_ACCESS_KEY_ID: 'access-key',
  FACTS_R2_ACCOUNT_ID: 'c'.repeat(32),
  FACTS_R2_BUCKET: 'cv-facts',
  FACTS_R2_SECRET_ACCESS_KEY: 'private-token',
  FACTS_SOURCE_COMMIT: 'a'.repeat(40),
}

const readConfig = (values: Readonly<Record<string, string>>) =>
  readFactsPublisherConfig().pipe(
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(values))),
    Effect.provide(BunServices.layer)
  )

describe('facts publisher configuration', () => {
  test('accepts full immutable commits and redacts the R2 credentials', async () => {
    const config = await Effect.runPromise(readConfig(environment))

    expect(config.sourceCommit).toBe(environment.FACTS_SOURCE_COMMIT)
    expect(String(config.r2SecretAccessKey)).not.toContain(
      Redacted.value(config.r2SecretAccessKey)
    )
    expect(config.r2Bucket).toBe('cv-facts')
  })

  test('rejects refs and abbreviated commit IDs', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        readConfig({
          ...environment,
          FACTS_SOURCE_COMMIT: 'main',
        })
      )
    )

    expect(error._tag).toBe('FactsPublisherConfigError')
    expect(error.message).toContain('full 40- or 64-character')
  })
})
