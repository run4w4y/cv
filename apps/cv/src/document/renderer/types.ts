import type { CvDocumentV1 } from '@cv/contracts/document'

export interface CvDocumentRendererProps {
  readonly document: CvDocumentV1
  readonly publicUrl?: string
  readonly renderVersion?: string
}
