import type { CvDocumentV1 } from '@cv/contracts/document'

export type CvRendererMode = 'responsive' | 'print-preview'

export interface CvDocumentRendererProps {
  readonly document: CvDocumentV1
  readonly publicUrl?: string
  readonly mode?: CvRendererMode
  readonly renderVersion?: string
}
