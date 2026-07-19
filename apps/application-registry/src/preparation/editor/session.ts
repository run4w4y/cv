import { type CvDocumentV1, CvDocumentV1Schema } from '@cv/contracts/document'
import {
  CoverLetterDocumentSchema,
  initialCoverLetterDraft,
} from '@cv/application-preparation-workflow/cover-letter'
import type { SavedCandidate } from '@cv/application-preparation-workflow/domain'
import {
  createInitialValue,
  inspectSchema,
  validateSchemaValue,
} from '@cv/schema-editor/core'
import { Option } from 'effect'

import type { SavedContentRevision } from '../data'
import type {
  DerivePreparationEditorSessionInput,
  PreparationEditorIdentity,
  PreparationEditorSession,
  PreparationEditorSource,
  PreparationWorkflowCandidate,
} from './model'

const cvInitialDescriptor = inspectSchema(CvDocumentV1Schema).descriptor

const initialDocument = (identity: PreparationEditorIdentity): unknown =>
  identity.kind === 'cv'
    ? createInitialValue(cvInitialDescriptor)
    : initialCoverLetterDraft(identity.locale)

const candidateRevision = (
  candidate: SavedCandidate
): SavedContentRevision => ({
  ...candidate.result,
  value: candidate.candidate.document,
})

const newerRevision = (
  left: SavedContentRevision | null,
  right: SavedContentRevision | null
): SavedContentRevision | null => {
  if (left === null) return right
  if (right === null) return left
  if (left.entry.id !== right.entry.id) return right
  if (right.revision.revisionNumber > left.revision.revisionNumber) return right
  if (right.revision.revisionNumber < left.revision.revisionNumber) return left
  if (left.revision.id === right.revision.id) {
    const rightEntryIsNewer =
      right.entry.version > left.entry.version ||
      (right.entry.version === left.entry.version &&
        right.entry.state === 'approved' &&
        left.entry.state !== 'approved')
    return {
      entry: rightEntryIsNewer ? right.entry : left.entry,
      revision: left.revision,
      value: left.value,
    }
  }
  return right
}

const detachedRunId = (revision: SavedContentRevision): string | null => {
  if (
    revision.revision.source !== 'ai' ||
    !revision.revision.operationId.endsWith(':candidate')
  ) {
    return null
  }
  const runId = revision.revision.operationId.slice(0, -':candidate'.length)
  return runId.length === 0 ? null : runId
}

const detachedReason = (
  run: DerivePreparationEditorSessionInput['run'],
  runId: string
): Extract<
  PreparationWorkflowCandidate,
  { readonly _tag: 'Detached' }
>['reason'] => {
  if (run?.runId !== runId) return 'workflow-runtime-reset'
  switch (run.status) {
    case 'rejected':
      return 'review-rejected'
    case 'cancelled':
      return 'workflow-cancelled'
    case 'failed':
      return 'workflow-failed'
    default:
      return 'workflow-runtime-reset'
  }
}

const workflowCandidateFor = (
  input: DerivePreparationEditorSessionInput,
  baseRevision: SavedContentRevision | null
): PreparationWorkflowCandidate => {
  if (
    input.run !== null &&
    input.run.candidate !== null &&
    (input.run.status === 'awaiting_review' ||
      input.run.status === 'review_submitted' ||
      input.run.status === 'cancelling')
  ) {
    return {
      _tag: 'Attached',
      candidate: input.run.candidate,
      runId: input.run.runId,
    }
  }
  if (
    baseRevision === null ||
    (baseRevision.entry.state === 'approved' &&
      baseRevision.entry.approvedRevisionId === baseRevision.revision.id)
  ) {
    return { _tag: 'None' }
  }

  const runId = detachedRunId(baseRevision)
  if (
    runId === null ||
    input.local.releasedDetachedCandidateRevisionId === baseRevision.revision.id
  ) {
    return { _tag: 'None' }
  }
  return {
    _tag: 'Detached',
    candidateRevisionId: baseRevision.revision.id,
    reason: detachedReason(input.run, runId),
    runId,
  }
}

const documentFor = (
  input: DerivePreparationEditorSessionInput,
  baseRevision: SavedContentRevision | null
): unknown =>
  Option.isSome(input.local.humanDraft)
    ? input.local.humanDraft.value
    : (baseRevision?.value ?? initialDocument(input.identity))

const sourceFor = (
  input: DerivePreparationEditorSessionInput,
  baseRevision: SavedContentRevision | null,
  workflowCandidate: PreparationWorkflowCandidate
): PreparationEditorSource => {
  if (Option.isSome(input.local.humanDraft)) return 'human'
  if (
    baseRevision !== null &&
    workflowCandidate._tag === 'Attached' &&
    workflowCandidate.candidate.result.revision.id === baseRevision.revision.id
  ) {
    return 'workflow'
  }
  return baseRevision?.revision.source ?? 'initial'
}

const validationCaches = {
  cover_letter: new WeakMap<object, PreparationEditorSession['validation']>(),
  cv: new WeakMap<object, PreparationEditorSession['validation']>(),
}

const validateDocument = (
  identity: PreparationEditorIdentity,
  document: unknown
): PreparationEditorSession['validation'] => {
  const cacheable = typeof document === 'object' && document !== null
  const cache = validationCaches[identity.kind]
  if (cacheable) {
    const cached = cache.get(document)
    if (cached !== undefined) return cached
  }
  const validation =
    identity.kind === 'cv'
      ? validateSchemaValue(CvDocumentV1Schema, document)
      : validateSchemaValue(CoverLetterDocumentSchema, document)
  if (cacheable) cache.set(document, validation)
  return validation
}

/** Pure join of query, Workflow, and editor-local state. */
export const derivePreparationEditorSession = (
  input: DerivePreparationEditorSessionInput
): PreparationEditorSession => {
  const liveCandidate =
    input.run?.candidate === null || input.run?.candidate === undefined
      ? null
      : candidateRevision(input.run.candidate)
  const queriedOrMutatedHead = newerRevision(
    input.head,
    input.local.lastMutationResult
  )
  const baseRevision = newerRevision(queriedOrMutatedHead, liveCandidate)
  const workflowCandidate = workflowCandidateFor(input, baseRevision)
  const document = documentFor(input, baseRevision)
  const validation = validateDocument(input.identity, document)
  const dirty = Option.isSome(input.local.humanDraft) || baseRevision === null
  const isApproved =
    baseRevision !== null &&
    baseRevision.entry.state === 'approved' &&
    baseRevision.entry.approvedRevisionId === baseRevision.revision.id
  const detached = workflowCandidate._tag === 'Detached'
  const workflowBlocksMutation =
    input.run?.status === 'queued' ||
    input.run?.status === 'running' ||
    input.run?.status === 'review_submitted' ||
    input.run?.status === 'cancelling'

  return {
    ...input.local,
    approvalMode:
      workflowCandidate._tag === 'Attached'
        ? 'workflow'
        : detached
          ? 'detached'
          : 'direct',
    baseRevision,
    canApprove:
      baseRevision !== null &&
      !dirty &&
      validation.valid &&
      !isApproved &&
      !detached &&
      !workflowBlocksMutation,
    canSave: dirty && validation.valid && !workflowBlocksMutation,
    detached,
    dirty,
    document,
    identity: input.identity,
    isApproved,
    source: sourceFor(input, baseRevision, workflowCandidate),
    validation,
    workflowCandidate,
    workflowStatus: input.run?.status ?? null,
  }
}

export const validCvEditorDocument = (
  session: PreparationEditorSession
): CvDocumentV1 | null =>
  session.identity.kind === 'cv' && session.validation.valid
    ? (session.validation.value as CvDocumentV1)
    : null
