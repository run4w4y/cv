import { describe, expect, test } from 'bun:test'
import { CloudflareAnalytics } from '@cv/cloudflare-analytics-client'
import { Effect, Layer, Redacted } from 'effect'

import {
  CloudflareConfigLive,
  provideWorkerConfiguration,
  readChatGPTSessionSecret,
  readListingChecksConfiguration,
  readRegistryApiToken,
  workerConfigurationProviderLayer,
} from './config'

const readWith = <A, E>(
  effect: Effect.Effect<A, E>,
  environment: Record<string, unknown>
) => Effect.runPromise(effect.pipe(provideWorkerConfiguration(environment)))

const cloudflareConfigWith = (environment: Record<string, unknown>) =>
  CloudflareAnalytics.Configuration.pipe(
    Effect.provide(
      CloudflareConfigLive.pipe(
        Layer.provide(workerConfigurationProviderLayer(environment))
      )
    )
  )

describe('registry Worker configuration', () => {
  test('builds the Cloudflare client configuration layer from Worker bindings', async () => {
    const configuration = await Effect.runPromise(
      cloudflareConfigWith({
        CLOUDFLARE_ANALYTICS_API_TOKEN: ' analytics-token ',
        CLOUDFLARE_GRAPHQL_ENDPOINT: 'https://cloudflare.test/graphql',
        CLOUDFLARE_ZONE_ID: ' zone-value ',
        CV_WEB_HOST: ' cv.example.test ',
      })
    )

    expect(configuration.zoneId).toBe('zone-value')
    expect(configuration.endpoint.toString()).toBe(
      'https://cloudflare.test/graphql'
    )
    expect(configuration.host).toBe('cv.example.test')
    expect(Redacted.value(configuration.apiToken)).toBe('analytics-token')
  })

  test('rejects incomplete Cloudflare analytics bindings', async () => {
    const error = await Effect.runPromise(
      cloudflareConfigWith({ CLOUDFLARE_ZONE_ID: 'zone-value' }).pipe(
        Effect.flip
      )
    )

    expect(error._tag).toBe('Worker.ConfigurationError')
    expect(error.message).toBe('Cloudflare analytics configuration is invalid.')
  })

  test('reads, trims, and redacts secrets from the worker environment', async () => {
    const environment = {
      CHATGPT_SESSION_SECRET: '  chat-secret  ',
      REGISTRY_API_TOKEN: '  registry-token  ',
    }
    const [chatSecret, registryToken] = await Promise.all([
      readWith(readChatGPTSessionSecret, environment),
      readWith(readRegistryApiToken, environment),
    ])

    expect(Redacted.value(chatSecret)).toBe('chat-secret')
    expect(Redacted.value(registryToken)).toBe('registry-token')
    expect(String(chatSecret)).toBe('<redacted:CHATGPT_SESSION_SECRET>')
    expect(String(registryToken)).toBe('<redacted:REGISTRY_API_TOKEN>')
  })

  test('rejects missing or blank secrets', async () => {
    const missing = await Effect.runPromise(
      readRegistryApiToken.pipe(provideWorkerConfiguration({}), Effect.flip)
    )
    const blank = await Effect.runPromise(
      readChatGPTSessionSecret.pipe(
        provideWorkerConfiguration({ CHATGPT_SESSION_SECRET: '   ' }),
        Effect.flip
      )
    )

    expect(missing._tag).toBe('Worker.ConfigurationError')
    expect(blank._tag).toBe('Worker.ConfigurationError')
  })

  test('uses safe defaults for scheduled listing checks', async () => {
    await expect(readWith(readListingChecksConfiguration, {})).resolves.toEqual(
      {
        archiveEnabled: false,
        batchSize: 5,
        enabled: true,
      }
    )
  })

  test('reads explicit listing policy and caps the batch size', async () => {
    await expect(
      readWith(readListingChecksConfiguration, {
        LISTING_CHECK_ARCHIVE_ENABLED: 'true',
        LISTING_CHECK_BATCH_SIZE: '999',
        LISTING_CHECKS_ENABLED: 'false',
      })
    ).resolves.toEqual({
      archiveEnabled: true,
      batchSize: 10,
      enabled: false,
    })
  })

  test('rejects malformed listing-check values', async () => {
    const invalidBoolean = await Effect.runPromise(
      readListingChecksConfiguration.pipe(
        provideWorkerConfiguration({ LISTING_CHECKS_ENABLED: 'sometimes' }),
        Effect.flip
      )
    )
    const invalidBatchSize = await Effect.runPromise(
      readListingChecksConfiguration.pipe(
        provideWorkerConfiguration({ LISTING_CHECK_BATCH_SIZE: '0' }),
        Effect.flip
      )
    )

    expect(invalidBoolean._tag).toBe('Worker.ConfigurationError')
    expect(invalidBatchSize._tag).toBe('Worker.ConfigurationError')
  })
})
