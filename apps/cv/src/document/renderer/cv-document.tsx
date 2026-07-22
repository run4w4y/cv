import { PdfCvRenderer } from './pdf/pdf-cv'
import type { CvDocumentRendererProps } from './types'
import { WebCvRenderer } from './web/web-cv'

export const CvDocumentRenderer = ({
  document,
  publicUrl,
  renderVersion,
}: CvDocumentRendererProps) => (
  <>
    <WebCvRenderer
      document={document}
      publicUrl={publicUrl}
      renderVersion={renderVersion}
    />
    <PdfCvRenderer
      document={document}
      presentation="print"
      publicUrl={publicUrl}
      renderVersion={renderVersion}
    />
  </>
)
