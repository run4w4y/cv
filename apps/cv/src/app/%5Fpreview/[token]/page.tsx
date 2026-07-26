import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CvDocumentRenderer } from '@/document/renderer/cv-document'
import {
  loadPrivatePublicationForRequest,
  type PrivateCvPublicationParams,
  type PrivateCvPublicationSearchParams,
  privatePublicationMetadata,
} from '@/server/load-private-publication'
import { cvRenderVersion } from '@/server/render-version'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({
  params,
  searchParams,
}: {
  readonly params: PrivateCvPublicationParams
  readonly searchParams: PrivateCvPublicationSearchParams
}): Promise<Metadata> {
  return privatePublicationMetadata(
    await loadPrivatePublicationForRequest(params, searchParams)
  )
}

export default async function CvPreviewPage({
  params,
  searchParams,
}: {
  readonly params: PrivateCvPublicationParams
  readonly searchParams: PrivateCvPublicationSearchParams
}) {
  const publication = await loadPrivatePublicationForRequest(
    params,
    searchParams
  )
  if (publication.tag === 'not-found') notFound()
  if (publication.tag !== 'success') {
    throw new Error('The CV preview is temporarily unavailable.')
  }

  return (
    <CvDocumentRenderer
      document={publication.document}
      publicUrl={publication.publicUrl}
      renderVersion={cvRenderVersion()}
    />
  )
}
