import {
  cvAuthoringSourceForGeneration,
  cvProvenanceIssues,
  cvWritingIssues,
} from '@cv/application-preparation-workflow'
import type { DocumentKind } from '@cv/application-preparation-workflow/domain'
import type {
  CvDocumentV1,
  CvGenerationGuidanceV1,
} from '@cv/contracts/document'
import type { FactsCatalogueV1 } from '@cv/contracts/facts'
import type { Schema } from 'effect'

import type { DocumentPolicy, DocumentStudioDocument } from './session'

type AssistantContextInput = {
  readonly company: string | null
  readonly factsCatalogue: FactsCatalogueV1
  readonly jobContext: Schema.Json
  readonly postingUrl: string
  readonly role: string | null
}

export const documentAssistantContext = ({
  company,
  factsCatalogue,
  jobContext,
  postingUrl,
  role,
}: AssistantContextInput): Schema.Json => ({
  capturedJobPosting: jobContext,
  company,
  postingUrl,
  reviewedCvSource: cvAuthoringSourceForGeneration(factsCatalogue),
  role,
})

export const cvDocumentPolicy =
  (
    factsCatalogue: FactsCatalogueV1,
    guidance: CvGenerationGuidanceV1,
    company: string | null
  ): DocumentPolicy =>
  (document: DocumentStudioDocument) => [
    ...cvProvenanceIssues(factsCatalogue, document as CvDocumentV1).map(
      (issue) => ({ ...issue, severity: 'error' as const })
    ),
    ...cvWritingIssues(guidance, company, document as CvDocumentV1).map(
      (issue) => ({ ...issue, severity: 'warning' as const })
    ),
  ]

export const documentAssistantInstructions = (
  kind: DocumentKind,
  guidance: CvGenerationGuidanceV1
): string =>
  kind === 'cv'
    ? [
        'Treat the following pinned CV generation guidance as authoritative application instructions for every assessment and edit.',
        JSON.stringify(guidance, null, 2),
        'Write finished recruiter-facing CV copy. Never leak analysis language such as targeting, application, posting, requirements, evidence, proof, match, or fit into the document.',
        'Use the target role in the headline. Keep languages, test scores, relocation, visa needs, and domain interest in additional sections by default rather than the professional summary.',
      ].join('\n\n')
    : 'Write finished, natural cover-letter copy. Use only the reviewed facts and approved document context supplied with the request.'
