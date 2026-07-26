import type { CoverLetterDocument } from '@cv/application-preparation-workflow/cover-letter'

import { DocumentPaper, InlineTextField } from './semantic-fields'
import type { DocumentMutationHandlers, DocumentValidationIssue } from './types'

export const CoverLetterDocumentEditor = ({
  disabled = false,
  document,
  issues = [],
  mutations,
}: {
  readonly disabled?: boolean
  readonly document: CoverLetterDocument
  readonly issues?: ReadonlyArray<DocumentValidationIssue>
  readonly mutations: DocumentMutationHandlers
}) => (
  <DocumentPaper className="max-w-3xl" label="Editable cover letter">
    <header className="border-b border-border pb-4">
      <p className="text-xs/5 font-medium tracking-[0.14em] text-muted-foreground uppercase">
        Cover letter · {document.locale}
      </p>
    </header>
    <InlineTextField
      className="mt-6 min-h-96 px-0 py-0 text-base/7 hover:bg-transparent focus-visible:bg-transparent"
      disabled={disabled}
      issues={issues.filter((issue) => issue.path[0] === 'body')}
      label="Cover letter"
      multiline
      onChange={(value) => mutations.onEdit(['body'], value)}
      placeholder="Write the tailored cover letter here…"
      value={document.body}
    />
  </DocumentPaper>
)
