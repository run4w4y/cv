import type { CoverLetterDocument } from '@cv/application-preparation-workflow/cover-letter'

import { DocumentPaper } from './semantic-fields'

export const CoverLetterDocumentPreview = ({
  document,
}: {
  readonly document: CoverLetterDocument
}) => (
  <DocumentPaper className="max-w-3xl" label="Cover letter preview">
    <header className="border-b border-border pb-4">
      <p className="text-xs/5 font-medium tracking-[0.14em] text-muted-foreground uppercase">
        Cover letter · {document.locale}
      </p>
    </header>
    <div className="mt-6 whitespace-pre-wrap text-base/7">{document.body}</div>
  </DocumentPaper>
)
