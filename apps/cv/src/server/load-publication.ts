import 'server-only'

import * as BrowserCrypto from '@effect/platform-browser/BrowserCrypto'
import { getCloudflareContext } from '@opennextjs/cloudflare'
import { Effect } from 'effect'
import { cache } from 'react'

import {
  asCvPublicationLoadResult,
  loadCvPreview,
  loadCvPublication,
} from '@/lib/publication'

export const loadCvPublicationForToken = cache(async (token: string) => {
  const { env } = await getCloudflareContext({ async: true })
  return loadCvPublication(env.CV_PUBLIC_RESOLVER, token).pipe(
    asCvPublicationLoadResult,
    Effect.provide(BrowserCrypto.layer),
    Effect.runPromise
  )
})

export const loadCvPreviewForToken = cache(
  async (token: string, previewToken: string) => {
    const { env } = await getCloudflareContext({ async: true })
    return loadCvPreview(env.CV_PUBLIC_RESOLVER, token, previewToken).pipe(
      asCvPublicationLoadResult,
      Effect.provide(BrowserCrypto.layer),
      Effect.runPromise
    )
  }
)
