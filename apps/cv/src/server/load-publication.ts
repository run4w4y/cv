import 'server-only'

import * as BrowserCrypto from '@effect/platform-browser/BrowserCrypto'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { Effect } from 'effect'
import { cache } from 'react'

import {
  asCvPublicationLoadResult,
  loadCvPreview,
  loadCvPublication,
  makeHttpCvPublicResolver,
} from '@/lib/publication'

export const loadCvPublicationForToken = cache(async (token: string) => {
  const fixtures = await fixturePublications()
  if (fixtures) return fixtures.loadCvFixturePublication(token)

  const { env } = await getCloudflareContext({ async: true })
  return loadCvPublication(
    makeHttpCvPublicResolver(env.CV_PUBLIC_RESOLVER_URL),
    token
  ).pipe(
    asCvPublicationLoadResult,
    Effect.provide(BrowserCrypto.layer),
    Effect.runPromise
  )
})

export const loadCvPreviewForToken = cache(
  async (token: string, previewToken: string) => {
    const fixtures = await fixturePublications()
    if (fixtures) return fixtures.loadCvFixturePreview(token, previewToken)

    const { env } = await getCloudflareContext({ async: true })
    return loadCvPreview(
      makeHttpCvPublicResolver(env.CV_PUBLIC_RESOLVER_URL),
      token,
      previewToken
    ).pipe(
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
