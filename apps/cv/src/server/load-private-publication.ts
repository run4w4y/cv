import 'server-only'

import type { Metadata } from 'next'
import { cache } from 'react'

import { loadCvPreviewForToken } from './load-publication'
import { decodeCvToken } from './token'

export type PrivateCvPublicationParams = Promise<{
  readonly token: string
}>

export type PrivateCvPublicationSearchParams = Promise<{
  readonly access?: string
}>

const loadPrivatePublication = cache(
  (rawToken: string, access: string | undefined) => {
    const token = decodeCvToken(rawToken)
    return token && access
      ? loadCvPreviewForToken(token, access)
      : Promise.resolve({ tag: 'not-found' as const })
  }
)

export const loadPrivatePublicationForRequest = async (
  params: PrivateCvPublicationParams,
  searchParams: PrivateCvPublicationSearchParams
) => {
  const [{ token }, { access }] = await Promise.all([params, searchParams])
  return loadPrivatePublication(token, access)
}

export const privatePublicationMetadata = (
  publication: Awaited<ReturnType<typeof loadPrivatePublicationForRequest>>
): Metadata => ({
  referrer: 'no-referrer',
  robots: { follow: false, index: false, nocache: true },
  title:
    publication.tag === 'success'
      ? `${publication.document.person.name} — CV`
      : publication.tag === 'not-found'
        ? 'CV not found'
        : 'CV unavailable',
})
