import 'server-only'

import * as BrowserCrypto from '@effect/platform-browser/BrowserCrypto'
import { Config, Effect } from 'effect'
import { cache } from 'react'

import {
  asCvPublicationLoadResult,
  loadCvPreview,
  loadCvPublication,
  makeHttpCvPublicResolver,
} from '@/lib/publication'

const resolverUrl = () =>
  Config.nonEmptyString('CV_PUBLIC_RESOLVER_URL').pipe(
    Config.withDefault('http://127.0.0.1:3001'),
    Effect.flatMap((value) =>
      Effect.try({
        try: () => new URL(value),
        catch: () =>
          new Error('CV_PUBLIC_RESOLVER_URL must be an absolute URL.'),
      })
    ),
    Effect.orDie
  )

export const loadCvPublicationForToken = cache(async (token: string) => {
  const fixtures = await fixturePublications()
  if (fixtures) return fixtures.loadCvFixturePublication(token)

  return Effect.gen(function* () {
    const origin = yield* resolverUrl()
    return yield* loadCvPublication(makeHttpCvPublicResolver(origin), token)
  }).pipe(
    asCvPublicationLoadResult,
    Effect.provide(BrowserCrypto.layer),
    Effect.runPromise
  )
})

export const loadCvPreviewForToken = cache(
  async (token: string, previewToken: string) => {
    const fixtures = await fixturePublications()
    if (fixtures) return fixtures.loadCvFixturePreview(token, previewToken)

    return Effect.gen(function* () {
      const origin = yield* resolverUrl()
      return yield* loadCvPreview(
        makeHttpCvPublicResolver(origin),
        token,
        previewToken
      )
    }).pipe(
      asCvPublicationLoadResult,
      Effect.provide(BrowserCrypto.layer),
      Effect.runPromise
    )
  }
)

const fixturePublications = async () => {
  if (process.env.NODE_ENV !== 'development') return null

  const fixtures = await import('./fixture-publications')
  return fixtures.isCvFixtureModeEnabled() ? fixtures : null
}
