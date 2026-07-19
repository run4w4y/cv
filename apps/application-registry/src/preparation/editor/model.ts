import type { ContentRevisionSource } from '@cv/application-registry-entity'
import type { CvDocumentV1 } from '@cv/contracts/document'
import type { CvPageLayoutAssessment } from '@cv/renderer'
import type { ValidationResult } from '@cv/schema-editor/core'
import type { Option } from 'effect'

import type { CoverLetterDocument } from '../cover-letter-contract'
import type { SavedContentRevision } from '../data'
import type {
  DocumentKind,
  PreparationRunStatus,
  SavedCandidate,
} from '../workflow/domain'

export type PreparationEditorIdentity = {
  readonly applicationId: string
  readonly kind: DocumentKind
  readonly locale: string
}

export type PreparationDocument = CvDocumentV1 | CoverLetterDocument

export type PreparationWorkflowCandidate =
  | { readonly _tag: 'None' }
  | {
      readonly _tag: 'Attached'
      readonly candidate: SavedCandidate
      readonly runId: string
    }
  | {
      readonly _tag: 'Detached'
      readonly candidateRevisionId: string
      readonly reason:
        | 'review-rejected'
        | 'workflow-cancelled'
        | 'workflow-failed'
        | 'workflow-runtime-reset'
      readonly runId: string
    }

/**
 * The only editor-owned state. Registry heads and Workflow runs stay in their
 * authoritative query/runtime atoms and are combined by a derived workspace.
 */
export type PreparationEditorLocalState = {
  readonly humanDraft: Option.Option<unknown>
  readonly lastMutationResult: SavedContentRevision | null
  readonly layoutAssessment: CvPageLayoutAssessment | null
  readonly layoutDocumentFingerprint: string | null
  readonly releasedDetachedCandidateRevisionId: string | null
}

export type PreparationEditorWorkflowRun = {
  readonly candidate: SavedCandidate | null
  readonly runId: string
  readonly status: PreparationRunStatus
}

export type PreparationEditorSource =
  | 'initial'
  | 'workflow'
  | ContentRevisionSource

export type PreparationEditorApprovalMode = 'direct' | 'workflow' | 'detached'

export type DerivePreparationEditorSessionInput = {
  readonly head: SavedContentRevision | null
  readonly identity: PreparationEditorIdentity
  readonly local: PreparationEditorLocalState
  readonly run: PreparationEditorWorkflowRun | null
}

export type PreparationEditorSession = PreparationEditorLocalState & {
  readonly approvalMode: PreparationEditorApprovalMode
  readonly baseRevision: SavedContentRevision | null
  readonly canApprove: boolean
  readonly canSave: boolean
  readonly detached: boolean
  readonly dirty: boolean
  readonly document: unknown
  readonly identity: PreparationEditorIdentity
  readonly isApproved: boolean
  readonly source: PreparationEditorSource
  readonly validation: ValidationResult<PreparationDocument>
  readonly workflowCandidate: PreparationWorkflowCandidate
  readonly workflowStatus: PreparationRunStatus | null
}

export type EditPreparationDraftInput = {
  readonly document: unknown
  readonly identity: PreparationEditorIdentity
}

export type RecordPreparationSaveInput = {
  readonly identity: PreparationEditorIdentity
  readonly revision: SavedContentRevision
}

export type ReleaseDetachedPreparationWorkflowInput = {
  readonly candidateRevisionId: string
  readonly identity: PreparationEditorIdentity
}

export type SetPreparationLayoutAssessmentInput = {
  readonly assessment: CvPageLayoutAssessment | null
  readonly document: unknown
  readonly identity: PreparationEditorIdentity
}
