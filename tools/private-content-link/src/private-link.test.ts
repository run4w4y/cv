import { describe, expect, test } from 'bun:test'
import { WebCryptoApiLayer } from '@cv/private-content-crypto'
import { Effect, Layer } from 'effect'
import { mintPrivateContentLink, PrivateContentLinkLive } from './private-link'

const env = {
  CONTENT_ID_SALT: 'test-salt',
  PRIVATE_CONTENT_AUDIENCE_KEY:
    'test-private-audience-key-with-at-least-thirty-two-bytes',
  PRIVATE_CONTENT_ROOT_KEY:
    'base64url:AQIDBAUGBwgJCgsMDQ4PEBESExQVFhcYGRobHB0eHyA',
}

const run = <A, E>(effect: Effect.Effect<A, E, never>) =>
  Effect.runPromise(effect)

const serviceLayer = PrivateContentLinkLive.pipe(
  Layer.provide(WebCryptoApiLayer)
)

describe('private content link service', () => {
  test('mints without filesystem services', async () => {
    const link = await run(
      mintPrivateContentLink({
        audience: 'Acme',
        baseUrl: new URL('https://cv.example.test/'),
        env,
        locale: 'en',
        profile: 'frontend',
      }).pipe(Effect.provide(serviceLayer))
    )

    expect(link.profile).toBe('frontend')
    expect(link.url).toStartWith('https://cv.example.test/en/a/')
  })

  test('preserves configuration failures as a typed error', async () => {
    const exit = await Effect.runPromiseExit(
      mintPrivateContentLink({
        audience: 'Acme',
        env: {},
        locale: 'en',
        profile: 'frontend',
      }).pipe(Effect.provide(serviceLayer))
    )

    expect(exit.toString()).toContain('PrivateContentLinkConfigError')
  })
})
