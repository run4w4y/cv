import 'server-only'

import { getCloudflareContext } from '@opennextjs/cloudflare'
import { cache } from 'react'

import { loadCvPreview, loadCvPublication } from '@/lib/publication'

export const loadCvPublicationForToken = cache(async (token: string) => {
  const { env } = await getCloudflareContext({ async: true })
  return loadCvPublication(env.CV_PUBLIC_RESOLVER, token)
})

export const loadCvPreviewForToken = cache(
  async (token: string, previewToken: string) => {
    const { env } = await getCloudflareContext({ async: true })
    return loadCvPreview(env.CV_PUBLIC_RESOLVER, token, previewToken)
  }
)
