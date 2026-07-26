import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { PdfCvRenderer } from '@/document/renderer/pdf/pdf-cv'
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

export default async function CvPdfRenderPage({
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
    throw new Error('The CV PDF render surface is temporarily unavailable.')
  }

  return (
    <main className="cv-render-shell">
      <PdfCvRenderer
        document={publication.document}
        presentation="preview"
        publicUrl={publication.publicUrl}
        renderVersion={cvRenderVersion()}
      />
    </main>
  )
}
