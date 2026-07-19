import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { CvDocumentRenderer } from '@/document/cv-document-renderer'
import { loadCvPublicationForToken } from '@/server/load-publication'
import { cvRenderVersion } from '@/server/render-version'
import { decodeCvToken } from '@/server/token'

export const dynamicParams = true
export const dynamic = 'force-dynamic'
export const revalidate = 0

const publicationForParams = async (
  params: Promise<{ readonly token: string }>
) => {
  const token = decodeCvToken((await params).token)
  return token ? loadCvPublicationForToken(token) : null
}

export async function generateMetadata({
  params,
}: {
  readonly params: Promise<{ readonly token: string }>
}): Promise<Metadata> {
  const publication = await publicationForParams(params)

  return {
    referrer: 'no-referrer',
    robots: { follow: false, index: false, nocache: true },
    title:
      publication?.tag === 'success'
        ? `${publication.document.person.name} — CV`
        : publication?.tag === 'not-found'
          ? 'CV not found'
          : 'CV unavailable',
  }
}

export default async function PublicCvPage({
  params,
}: {
  readonly params: Promise<{ readonly token: string }>
}) {
  const publication = await publicationForParams(params)

  if (publication === null || publication.tag === 'not-found') notFound()
  if (publication.tag !== 'success') {
    throw new Error('The CV publication is temporarily unavailable.')
  }

  return (
    <CvDocumentRenderer
      document={publication.document}
      publicUrl={publication.publicUrl}
      renderVersion={cvRenderVersion()}
    />
  )
}
