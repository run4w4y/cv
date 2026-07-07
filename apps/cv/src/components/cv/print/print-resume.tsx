import { PrintCoverPage } from '@/components/cv/print/cover-page'
import { PrintDetailsPage } from '@/components/cv/print/details-page'
import { PrintRoot } from '@/components/cv/print/primitives'

export const PrintResume = () => (
  <PrintRoot>
    <PrintCoverPage />
    <PrintDetailsPage />
  </PrintRoot>
)
