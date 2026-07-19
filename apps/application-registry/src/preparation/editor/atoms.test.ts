import { describe, expect, test } from 'bun:test'
import type {
  Application,
  ContentEntry,
  ContentRevision,
  ContentRevisionSource,
} from '@cv/application-registry-entity'
import type { CvDocumentV1 } from '@cv/contracts/document'
import * as AtomRegistry from 'effect/unstable/reactivity/AtomRegistry'

import type { CoverLetterDocument } from '../cover-letter-contract'
import type { SavedContentRevision } from '../data'
import { selectedPreparationModelAtom } from '../forms/atoms'
import type { SavedCandidate } from '../workflow/domain'
import {
  editPreparationDraftAtom,
  preparationEditorIdentityFromKey,
  preparationEditorKey,
  preparationEditorLocalStateAtom,
  recordPreparationSaveAtom,
  releaseDetachedPreparationWorkflowAtom,
  setPreparationLayoutAssessmentAtom,
} from './atoms'
import type {
  PreparationEditorIdentity,
  PreparationEditorWorkflowRun,
} from './model'
import {
  derivePreparationEditorSession,
  validCvEditorDocument,
} from './session'

const identity: PreparationEditorIdentity = {
  applicationId: 'application-1',
  kind: 'cover_letter',
  locale: 'en',
}

const application: Application = {
  applicationStatus: 'preparing',
  appliedAt: null,
  canonicalUrl: 'https://jobs.example.test/role',
  company: 'Example',
  createdAt: '2026-07-18T00:00:00.000Z',
  followUpAt: null,
  id: identity.applicationId,
  jobKey: 'example:role',
  lastContactAt: null,
  listingAvailability: 'open',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  location: null,
  personalPriority: null,
  role: 'Platform Engineer',
  source: 'example',
  sourceJobId: 'role',
  targetStage: 'backlog',
  updatedAt: '2026-07-18T00:00:00.000Z',
  updatedRevision: 1,
  version: 1,
}

const entry = (
  version: number,
  headRevisionId: string | null,
  kind: ContentEntry['kind'] = 'cover_letter'
): ContentEntry => ({
  applicationId: application.id,
  approvedRevisionId: null,
  createdAt: '2026-07-18T00:00:00.000Z',
  headRevisionId,
  id: `entry-${kind}`,
  kind,
  locale: 'en',
  state: 'draft',
  updatedAt: '2026-07-18T00:00:00.000Z',
  version,
})

const revision = (
  id: string,
  revisionNumber: number,
  source: ContentRevisionSource,
  kind: ContentEntry['kind'] = 'cover_letter',
  operationId = `${id}:save`
): ContentRevision => ({
  byteLength: 42,
  contentEntryId: `entry-${kind}`,
  contractId: kind === 'cv' ? 'cv.document.v1' : 'cover-letter.v1',
  contractVersion: '1',
  createdAt: `2026-07-18T00:0${revisionNumber}:00.000Z`,
  factsReleaseId: 'facts-release-1',
  id,
  jobSnapshotId: 'snapshot-1',
  mediaType: 'application/json',
  objectKey: `objects/${id}`,
  operationId,
  parentRevisionId:
    revisionNumber === 1 ? null : `revision-${revisionNumber - 1}`,
  revisionNumber,
  sha256: `sha-${id}`,
  source,
})

const letter = (body: string): CoverLetterDocument => ({
  $schema: 'cover-letter.v1',
  body,
  locale: 'en',
})

const saved = (
  id: string,
  revisionNumber: number,
  source: ContentRevisionSource,
  value: unknown,
  kind: ContentEntry['kind'] = 'cover_letter',
  operationId?: string
): SavedContentRevision => ({
  entry: entry(revisionNumber + 1, id, kind),
  revision: revision(id, revisionNumber, source, kind, operationId),
  value,
})

const workflowCandidate = (result: SavedContentRevision): SavedCandidate => ({
  application,
  candidate:
    result.entry.kind === 'cv'
      ? {
          _tag: 'Cv',
          document: result.value as CvDocumentV1,
          metadata: [],
        }
      : {
          _tag: 'CoverLetter',
          document: result.value as CoverLetterDocument,
          metadata: [],
        },
  result: { entry: result.entry, revision: result.revision },
})

const liveRun = (
  candidate: SavedCandidate,
  status: PreparationEditorWorkflowRun['status'] = 'awaiting_review'
): PreparationEditorWorkflowRun => ({
  candidate,
  runId: 'run-1',
  status,
})

const validCv: CvDocumentV1 = {
  $schema: 'cv.document.v1',
  additionalSections: [],
  direction: 'ltr',
  education: [],
  experience: [],
  locale: 'en',
  person: {
    contacts: [
      {
        kind: 'email',
        label: 'Email',
        value: 'ada@example.test',
      },
    ],
    headline: 'Platform engineer',
    name: 'Ada Example',
    summary: 'Builds reliable systems from reviewed evidence.',
  },
  projects: [],
  skills: [],
}

const derive = (
  registry: AtomRegistry.AtomRegistry,
  editorIdentity: PreparationEditorIdentity,
  head: SavedContentRevision | null,
  run: PreparationEditorWorkflowRun | null = null
) =>
  derivePreparationEditorSession({
    head,
    identity: editorIdentity,
    local: registry.get(preparationEditorLocalStateAtom(editorIdentity)),
    run,
  })

describe('keyed preparation editor atoms', () => {
  test('canonicalizes object identities to one primitive-key family entry', () => {
    const key = preparationEditorKey(identity)

    expect(preparationEditorIdentityFromKey(key)).toEqual(identity)
    expect(preparationEditorLocalStateAtom(identity)).toBe(
      preparationEditorLocalStateAtom({ ...identity })
    )
  })

  test('derives validation, source, dirty, save, and approval state', () => {
    const registry = AtomRegistry.make()

    const initial = derive(registry, identity, null)
    expect(initial.dirty).toBe(true)
    expect(initial.validation.valid).toBe(false)
    expect(initial.canSave).toBe(false)
    expect(initial.canApprove).toBe(false)

    const head = saved('revision-1', 1, 'ai', letter('Original letter.'))
    const hydrated = derive(registry, identity, head)
    expect(hydrated.dirty).toBe(false)
    expect(hydrated.source).toBe('ai')
    expect(hydrated.canApprove).toBe(true)

    registry.set(editPreparationDraftAtom, {
      document: letter('Human edit.'),
      identity,
    })
    const edited = derive(registry, identity, head)
    expect(edited.dirty).toBe(true)
    expect(edited.source).toBe('human')
    expect(edited.canSave).toBe(true)
    expect(edited.canApprove).toBe(false)
  })

  test('remote heads and live Workflow candidates cannot overwrite a human override', () => {
    const registry = AtomRegistry.make()
    const firstHead = saved(
      'revision-1',
      1,
      'human',
      letter('First remote head.')
    )
    const candidateRevision = saved(
      'revision-2',
      2,
      'ai',
      letter('Workflow candidate.'),
      'cover_letter',
      'run-1:candidate'
    )
    const candidate = workflowCandidate(candidateRevision)

    registry.set(editPreparationDraftAtom, {
      document: letter('Unsaved human work.'),
      identity,
    })

    const reconciled = derive(registry, identity, firstHead)
    const adopted = derive(registry, identity, firstHead, liveRun(candidate))
    expect(reconciled.document).toEqual(letter('Unsaved human work.'))
    expect(adopted.document).toEqual(letter('Unsaved human work.'))
    expect(adopted.baseRevision?.revision.id).toBe('revision-2')
    expect(adopted.workflowCandidate._tag).toBe('Attached')
    expect(adopted.dirty).toBe(true)
  })

  test('blocks editor mutations while Workflow cancellation is reconciling', () => {
    const registry = AtomRegistry.make()
    const head = saved('revision-1', 1, 'human', letter('Saved letter.'))
    registry.set(editPreparationDraftAtom, {
      document: letter('Human edit.'),
      identity,
    })

    const cancelling = derive(
      registry,
      identity,
      head,
      liveRun(workflowCandidate(head), 'cancelling')
    )

    expect(cancelling.canSave).toBe(false)
    expect(cancelling.canApprove).toBe(false)
  })

  test('a local save result wins over a replayed older Workflow candidate', () => {
    const registry = AtomRegistry.make()
    const candidateRevision = saved(
      'revision-2',
      2,
      'ai',
      letter('Workflow candidate.'),
      'cover_letter',
      'run-1:candidate'
    )
    const candidate = workflowCandidate(candidateRevision)
    const humanRevision = saved(
      'revision-3',
      3,
      'human',
      letter('Saved human descendant.')
    )

    registry.set(recordPreparationSaveAtom, {
      identity,
      revision: humanRevision,
    })
    const session = derive(
      registry,
      identity,
      candidateRevision,
      liveRun(candidate)
    )

    expect(session.baseRevision?.revision.id).toBe('revision-3')
    expect(session.document).toEqual(letter('Saved human descendant.'))
    expect(session.source).toBe('human')
    expect(session.dirty).toBe(false)
  })

  test('keeps a saved human document when Workflow approval completes that revision', () => {
    const registry = AtomRegistry.make()
    const candidateRevision = saved(
      'revision-2',
      2,
      'ai',
      letter('Original Workflow candidate.'),
      'cover_letter',
      'run-1:candidate'
    )
    const candidate = workflowCandidate(candidateRevision)
    const humanRevision = saved(
      'revision-3',
      3,
      'human',
      letter('Approved human descendant.')
    )
    registry.set(recordPreparationSaveAtom, {
      identity,
      revision: humanRevision,
    })

    const completedCandidate: SavedCandidate = {
      ...candidate,
      result: {
        entry: {
          ...humanRevision.entry,
          approvedRevisionId: humanRevision.revision.id,
          state: 'approved',
          version: humanRevision.entry.version + 1,
        },
        revision: humanRevision.revision,
      },
    }
    const session = derive(
      registry,
      identity,
      candidateRevision,
      liveRun(completedCandidate, 'approved')
    )

    expect(session.baseRevision?.revision.id).toBe('revision-3')
    expect(session.document).toEqual(letter('Approved human descendant.'))
    expect(session.isApproved).toBe(true)
  })

  test('detects a detached unapproved Workflow candidate and requires explicit release', () => {
    const registry = AtomRegistry.make()
    const candidate = saved(
      'revision-1',
      1,
      'ai',
      letter('Persisted AI candidate.'),
      'cover_letter',
      'run-lost-on-refresh:candidate'
    )

    const detached = derive(registry, identity, candidate)
    expect(detached.approvalMode).toBe('detached')
    expect(detached.detached).toBe(true)
    expect(detached.workflowCandidate).toMatchObject({
      _tag: 'Detached',
      reason: 'workflow-runtime-reset',
    })
    expect(detached.canApprove).toBe(false)

    const rejectedCandidate = saved(
      'revision-rejected',
      2,
      'ai',
      letter('Rejected AI candidate.'),
      'cover_letter',
      'run-1:candidate'
    )
    const rejected = derive(
      registry,
      identity,
      rejectedCandidate,
      liveRun(workflowCandidate(rejectedCandidate), 'rejected')
    )
    expect(rejected.workflowCandidate).toMatchObject({
      _tag: 'Detached',
      reason: 'review-rejected',
    })

    const cancelling = derive(
      registry,
      identity,
      candidate,
      liveRun(workflowCandidate(candidate), 'cancelling')
    )
    expect(cancelling.workflowCandidate._tag).toBe('Attached')
    expect(cancelling.canApprove).toBe(false)

    registry.set(releaseDetachedPreparationWorkflowAtom, {
      candidateRevisionId: candidate.revision.id,
      identity,
    })
    const released = derive(registry, identity, candidate)
    expect(released.approvalMode).toBe('direct')
    expect(released.canApprove).toBe(true)
  })

  test('requires a fitting layout before a valid CV can be approved', () => {
    const registry = AtomRegistry.make()
    const cvIdentity: PreparationEditorIdentity = {
      ...identity,
      kind: 'cv',
    }
    const head = saved('revision-cv', 1, 'ai', validCv, 'cv')

    const measured = derive(registry, cvIdentity, head)
    const measuredDocument = validCvEditorDocument(measured)
    expect(measured.validation.valid).toBe(true)
    expect(measuredDocument).toEqual(validCv)
    expect(measured.canApprove).toBe(false)

    registry.set(setPreparationLayoutAssessmentAtom, {
      assessment: {
        actualHeightPx: 100,
        actualWidthPx: 100,
        remainingHeightPx: 20,
        remainingWidthPx: 20,
        status: 'fits',
      },
      document: validCv,
      identity: cvIdentity,
    })
    const fitted = derive(registry, cvIdentity, head)
    expect(fitted.canApprove).toBe(true)
    expect(validCvEditorDocument(fitted)).toBe(measuredDocument)

    const changedDocument = {
      ...validCv,
      person: { ...validCv.person, summary: 'A newly generated summary.' },
    }
    const changedHead = saved('revision-cv-2', 2, 'ai', changedDocument, 'cv')
    const changed = derive(registry, cvIdentity, changedHead)
    expect(changed.layoutAssessment).toBeNull()
    expect(changed.canApprove).toBe(false)
  })

  test('keeps selected model state isolated by Atom registry', () => {
    const first = AtomRegistry.make()
    const second = AtomRegistry.make()

    first.set(selectedPreparationModelAtom, 'model-1')

    expect(first.get(selectedPreparationModelAtom)).toBe('model-1')
    expect(second.get(selectedPreparationModelAtom)).toBeNull()
  })
})
