import {
  cvDocumentV1ContractId,
  cvDocumentV1Version,
} from '@cv/contracts/document'
import type { CvPageLayoutAssessment } from '@cv/renderer'
import { useAtom, useAtomSet } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { useCallback } from 'react'

import {
  anyAsyncResultWaiting,
  asyncResultFailureMessage,
} from '../../async-result'
import { preparationCommandGateKey } from '../../command-gate'
import {
  makeAppendPreparationRevisionAtom,
  makeApprovePreparationRevisionAtom,
} from '../../data'
import {
  editPreparationDraftAtom,
  recordPreparationSaveAtom,
  releaseDetachedPreparationWorkflowAtom,
  setPreparationLayoutAssessmentAtom,
  validCvEditorDocument,
} from '../../editor'
import { keyedCommandFamily } from '../../keyed-command'
import { makeSubmitPreparationReviewAtom } from '../../workflow/atoms'
import { ReviewDecisionSchema } from '../../workflow/domain'
import { isRevisionBoundToPreparationRun } from '../../workflow/review'
import type { PreparationWorkspace } from '../../workspace/atoms'
import { workflowIsExecuting } from './preparation-commands'

const appendRevisionFamily = keyedCommandFamily(
  'preparation/cv/command/append-revision',
  makeAppendPreparationRevisionAtom
)
const approveRevisionFamily = keyedCommandFamily(
  'preparation/cv/command/approve-revision',
  makeApprovePreparationRevisionAtom
)
const submitReviewFamily = keyedCommandFamily(
  'preparation/cv/command/submit-review',
  makeSubmitPreparationReviewAtom
)

export const useCvEditorCommands = (workspace: PreparationWorkspace) => {
  const { bootstrap, editor, run } = workspace
  const identity = editor.identity
  const commandKey = preparationCommandGateKey(identity)
  const appendRevisionCommandAtom = appendRevisionFamily(commandKey)
  const approveRevisionCommandAtom = approveRevisionFamily(commandKey)
  const submitReviewCommandAtom = submitReviewFamily(commandKey)
  const editDraft = useAtomSet(editPreparationDraftAtom)
  const recordSave = useAtomSet(recordPreparationSaveAtom)
  const releaseDetached = useAtomSet(releaseDetachedPreparationWorkflowAtom)
  const setLayout = useAtomSet(setPreparationLayoutAssessmentAtom)
  const [saveResult, appendRevision] = useAtom(appendRevisionCommandAtom, {
    mode: 'promise',
  })
  const [approveResult, approveRevision] = useAtom(approveRevisionCommandAtom, {
    mode: 'promise',
  })
  const [reviewResult, submitReview] = useAtom(submitReviewCommandAtom, {
    mode: 'promise',
  })
  const resetSaveResult = useAtomSet(appendRevisionCommandAtom)
  const resetApproveResult = useAtomSet(approveRevisionCommandAtom)
  const resetReviewResult = useAtomSet(submitReviewCommandAtom)

  const saving = AsyncResult.isWaiting(saveResult)
  const approving = AsyncResult.isWaiting(approveResult)
  const reviewPending = AsyncResult.isWaiting(reviewResult)
  const mutationPending = anyAsyncResultWaiting(
    saveResult,
    approveResult,
    reviewResult
  )
  const workflowReviewBound =
    editor.approvalMode !== 'workflow' ||
    (editor.baseRevision !== null &&
      run !== null &&
      isRevisionBoundToPreparationRun(run, editor.baseRevision))
  const bindingError =
    editor.approvalMode === 'workflow' && !workflowReviewBound
      ? 'The selected revision is not descended from this Workflow candidate and cannot be submitted to its review.'
      : null

  const save = async () => {
    if (
      mutationPending ||
      workflowIsExecuting(run) ||
      !editor.canSave ||
      !editor.validation.valid
    ) {
      return
    }
    const base = editor.baseRevision
    try {
      const result = await appendRevision({
        applicationId: identity.applicationId,
        contractId: cvDocumentV1ContractId,
        contractVersion: String(cvDocumentV1Version),
        entry: base?.entry ?? bootstrap.entry,
        factsReleaseId:
          base?.revision.factsReleaseId ?? bootstrap.context.factsReleaseId,
        jobSnapshotId:
          base?.revision.jobSnapshotId ?? bootstrap.context.jobSnapshot.id,
        source: 'human',
        value: editor.validation.value,
      })
      recordSave({
        identity,
        revision: { ...result, value: editor.validation.value },
      })
    } catch {
      // The command atom retains the typed failure rendered by the page.
    }
  }

  const approve = async () => {
    const base = editor.baseRevision
    if (
      mutationPending ||
      !editor.canApprove ||
      base === null ||
      !workflowReviewBound
    ) {
      return
    }
    try {
      if (
        editor.approvalMode === 'workflow' &&
        run?.status === 'awaiting_review'
      ) {
        await submitReview({
          decision: ReviewDecisionSchema.cases.Approved.make({
            revisionId: base.revision.id,
          }),
          runId: run.runId,
          token: run.reviewToken,
        })
        return
      }
      const result = await approveRevision({
        applicationId: identity.applicationId,
        entry: base.entry,
        revisionId: base.revision.id,
      })
      recordSave({ identity, revision: { ...result, value: base.value } })
    } catch {
      // The command atom retains the typed failure rendered by the page.
    }
  }

  const reject = async () => {
    if (mutationPending || run?.status !== 'awaiting_review') return
    try {
      await submitReview({
        decision: ReviewDecisionSchema.cases.Rejected.make({
          reason: 'Rejected during human CV review.',
        }),
        runId: run.runId,
        token: run.reviewToken,
      })
    } catch {
      // The command atom retains the typed failure rendered by the page.
    }
  }

  const releaseDetachedCandidate = () => {
    if (
      editor.workflowCandidate._tag !== 'Detached' ||
      workflowIsExecuting(run)
    ) {
      return
    }
    releaseDetached({
      candidateRevisionId: editor.workflowCandidate.candidateRevisionId,
      identity,
    })
  }

  const changeDraft = (value: unknown) => {
    if (mutationPending || workflowIsExecuting(run)) return
    editDraft({ document: value, identity })
  }
  const changeLayout = useCallback(
    (assessment: CvPageLayoutAssessment | null) =>
      setLayout({ assessment, document: editor.document, identity }),
    [editor.document, identity, setLayout]
  )

  const reset = () => {
    resetSaveResult(Atom.Reset)
    resetApproveResult(Atom.Reset)
    resetReviewResult(Atom.Reset)
  }

  return {
    approve,
    approving,
    bindingError,
    canApprove: editor.canApprove && workflowReviewBound,
    changeDraft,
    changeLayout,
    document: validCvEditorDocument(editor),
    error:
      asyncResultFailureMessage(
        saveResult,
        'The CV revision could not be saved.'
      ) ??
      asyncResultFailureMessage(
        approveResult,
        'The CV revision could not be approved.'
      ) ??
      asyncResultFailureMessage(
        reviewResult,
        'The Workflow review could not be recorded.'
      ),
    mutationPending,
    reject,
    releaseDetachedCandidate,
    reset,
    reviewPending,
    save,
    saving,
  } as const
}
