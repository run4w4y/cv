import { asyncNoop } from 'es-toolkit/function'
import { CvDocumentCore } from '@/components/cv/cv-document-core'
import type { CvContent } from '@/cv-content/model'
import { CvLinguiProvider } from '@/i18n/runtime'
import { CvDocumentProvider } from '@/lib/cv-document/context'
import type { CvPageContextValue } from '@/lib/private-content-session/page-context'
import { makePublicCvSession } from '@/lib/private-content-session/session'

type CvStaticRootProps = {
  content: CvContent
  page: CvPageContextValue
}

export const CvStaticRoot = ({ content, page }: CvStaticRootProps) => {
  const session = makePublicCvSession({
    content,
    page,
  })

  return (
    <CvLinguiProvider locale={page.locale}>
      <CvDocumentProvider
        value={{
          content,
          openFile: asyncNoop,
          page,
          session,
        }}
      >
        <CvDocumentCore />
      </CvDocumentProvider>
    </CvLinguiProvider>
  )
}
