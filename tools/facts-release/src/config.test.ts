import { describe, expect, test } from 'bun:test'
import { Effect, Redacted } from 'effect'

import { readFactsPublisherConfig } from './config'

const environment = {
  FACTS_COMPILER_COMMIT: 'b'.repeat(40),
  FACTS_CONTENT_ROOT: '/tmp/reviewed-facts',
  FACTS_SOURCE_COMMIT: 'a'.repeat(40),
  REGISTRY_API_TOKEN: 'private-token',
  REGISTRY_API_URL: 'https://registry.example.test',
}

describe('facts publisher configuration', () => {
  test('accepts full immutable commits and redacts the registry token', async () => {
    const config = await Effect.runPromise(
      readFactsPublisherConfig(environment)
    )

    expect(config.channel).toBe('production')
    expect(config.sourceCommit).toBe(environment.FACTS_SOURCE_COMMIT)
    expect(String(config.registryToken)).not.toContain(
      Redacted.value(config.registryToken)
    )
  })

  test('rejects refs and abbreviated commit IDs', async () => {
    const error = await Effect.runPromise(
      Effect.flip(
        readFactsPublisherConfig({
          ...environment,
          FACTS_SOURCE_COMMIT: 'main',
        })
      )
    )

    expect(error._tag).toBe('FactsPublisherConfigError')
    expect(error.message).toContain('full 40- or 64-character')
  })
})
