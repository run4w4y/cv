import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { PdfCvRenderer } from '@/document/renderer/pdf/pdf-cv'
import { loadCvPreviewForToken } from '@/server/load-publication'
import { cvRenderVersion } from '@/server/render-version'
import { decodeCvToken } from '@/server/token'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const loadPreview = cache((rawToken: string, access?: string) => {
  const token = decodeCvToken(rawToken)
  return token && access
    ? loadCvPreviewForToken(token, access)
    : Promise.resolve({ tag: 'not-found' as const })
})

const previewForRequest = async (
  params: Promise<{ readonly token: string }>,
  searchParams: Promise<{ readonly access?: string }>
) => {
  const [{ token }, { access }] = await Promise.all([params, searchParams])
  return loadPreview(token, access)
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly token: string }>
  readonly searchParams: Promise<{ readonly access?: string }>
}): Promise<Metadata> {
  const publication = await previewForRequest(params, searchParams)

  return {
    referrer: 'no-referrer',
    robots: { follow: false, index: false, nocache: true },
    title:
      publication.tag === 'success'
        ? `${publication.document.person.name} — CV`
        : publication.tag === 'not-found'
          ? 'CV not found'
          : 'CV unavailable',
  }
}

export default async function CvPreviewPage({
  params,
  searchParams,
}: {
  readonly params: Promise<{ readonly token: string }>
  readonly searchParams: Promise<{ readonly access?: string }>
}) {
  const publication = await previewForRequest(params, searchParams)
  if (publication.tag === 'not-found') notFound()
  if (publication.tag !== 'success') {
    throw new Error('The CV preview is temporarily unavailable.')
  }

  return (
    <main className="cv-preview-shell">
      <PdfCvRenderer
        document={publication.document}
        presentation="preview"
        publicUrl={publication.publicUrl}
        renderVersion={cvRenderVersion()}
      />
    </main>
  )
}
