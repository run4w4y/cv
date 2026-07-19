import type { ReactNode } from 'react'

import { loadCvPublicationForToken } from '@/server/load-publication'
import { decodeCvToken } from '@/server/token'
import '../global.css'

export default async function PublicCvLayout({
  children,
  params,
}: {
  readonly children: ReactNode
  readonly params: Promise<{ readonly token: string }>
}) {
  const token = decodeCvToken((await params).token)
  const publication = token
    ? await loadCvPublicationForToken(token)
    : { tag: 'not-found' as const }
  const document =
    publication.tag === 'success' ? publication.document : undefined

  return (
    <html dir={document?.direction ?? 'ltr'} lang={document?.locale ?? 'en'}>
      <body>{children}</body>
    </html>
  )
}
