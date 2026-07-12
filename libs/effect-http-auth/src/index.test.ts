import { describe, expect, test } from 'bun:test'
import { Data, Effect, Redacted } from 'effect'

import { verifyBearerToken } from './index'

class Unauthorized extends Data.TaggedError('Unauthorized')<
  Record<never, never>
> {}

describe('shared bearer verification', () => {
  test('returns the application principal for a matching token', async () => {
    const principal = await Effect.runPromise(
      verifyBearerToken('secret', {
        configuredToken: Effect.succeed(Redacted.make('secret')),
        onUnauthorized: () => new Unauthorized(),
        principal: { name: 'client' },
      })
    )

    expect(principal).toEqual({ name: 'client' })
  })

  test('keeps unauthorized failures typed', async () => {
    const error = await Effect.runPromise(
      verifyBearerToken('wrong', {
        configuredToken: Effect.succeed(Redacted.make('secret')),
        onUnauthorized: () => new Unauthorized(),
        principal: undefined,
      }).pipe(Effect.flip)
    )

    expect(error).toBeInstanceOf(Unauthorized)
  })
})
