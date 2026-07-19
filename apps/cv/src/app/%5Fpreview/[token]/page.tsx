import { notFound } from 'next/navigation'

import { CvDocumentRenderer } from '@/document/cv-document-renderer'
import { loadCvPreviewForToken } from '@/server/load-publication'
import { cvRenderVersion } from '@/server/render-version'
import { decodeCvToken } from '@/server/token'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function CvPreviewPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly token: string }>
  readonly searchParams: Promise<{ readonly access?: string }>
}) {
  const token = decodeCvToken((await params).token)
  const access = (await searchParams).access
  if (!token || !access) notFound()

  const publication = await loadCvPreviewForToken(token, access)
  if (publication.tag === 'not-found') notFound()
  if (publication.tag !== 'success') {
    throw new Error('The CV preview is temporarily unavailable.')
  }

  return (
    <CvDocumentRenderer
      document={publication.document}
      mode="print-preview"
      publicUrl={publication.publicUrl}
      renderVersion={cvRenderVersion()}
    />
  )
}
