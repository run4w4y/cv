import {
  isRevisionBoundToPreparationRun,
  ReviewDecisionSchema,
} from '@cv/application-preparation-workflow/domain'
import {
  cvDocumentV1ContractId,
  cvDocumentV1Version,
} from '@cv/contracts/document'
import { useAtom, useAtomSet } from '@effect/atom-react'
import { Exit } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { firstAsyncResultErrorMessage } from '@/lib/async-result'
import { preparationCommandGateKey } from '@/preparation/command-gate'
import {
  makeAppendPreparationRevisionAtom,
  makeApprovePreparationRevisionAtom,
} from '@/preparation/data'
import {
  editPreparationDraftAtom,
  recordPreparationSaveAtom,
  releaseDetachedPreparationWorkflowAtom,
  validCvEditorDocument,
} from '@/preparation/editor'
import { keyedCommandFamily } from '@/preparation/keyed-command'
import { makeSubmitPreparationReviewAtom } from '@/preparation/workflow/atoms'
import type { PreparationWorkspace } from '@/preparation/workspace/atoms'
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
  const [saveResult, appendRevision] = useAtom(appendRevisionCommandAtom, {
    mode: 'promiseExit',
  })
  const [approveResult, approveRevision] = useAtom(approveRevisionCommandAtom, {
    mode: 'promiseExit',
  })
  const [reviewResult, submitReview] = useAtom(submitReviewCommandAtom, {
    mode: 'promiseExit',
  })
  const resetSaveResult = useAtomSet(appendRevisionCommandAtom)
  const resetApproveResult = useAtomSet(approveRevisionCommandAtom)
  const resetReviewResult = useAtomSet(submitReviewCommandAtom)

  const saving = AsyncResult.isWaiting(saveResult)
  const approving = AsyncResult.isWaiting(approveResult)
  const reviewPending = AsyncResult.isWaiting(reviewResult)
  const mutationPending =
    AsyncResult.isWaiting(saveResult) ||
    AsyncResult.isWaiting(approveResult) ||
    AsyncResult.isWaiting(reviewResult)
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
    const exit = await appendRevision({
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
    if (Exit.isFailure(exit)) return
    recordSave({
      identity,
      revision: { ...exit.value, value: editor.validation.value },
    })
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
    if (
      editor.approvalMode === 'workflow' &&
      run?.status === 'awaiting_review'
    ) {
      await submitReview({
        decision: ReviewDecisionSchema.cases.Approved.make({
          revisionId: base.revision.id,
        }),
        runId: run.runId,
      })
      return
    }
    const exit = await approveRevision({
      applicationId: identity.applicationId,
      entry: base.entry,
      revisionId: base.revision.id,
    })
    if (Exit.isFailure(exit)) return
    recordSave({ identity, revision: { ...exit.value, value: base.value } })
  }

  const reject = async () => {
    if (mutationPending || run?.status !== 'awaiting_review') return
    await submitReview({
      decision: ReviewDecisionSchema.cases.Rejected.make({
        reason: 'Rejected during human CV review.',
      }),
      runId: run.runId,
    })
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
    document: validCvEditorDocument(editor),
    error: firstAsyncResultErrorMessage([
      {
        fallback: 'The CV revision could not be saved.',
        result: saveResult,
      },
      {
        fallback: 'The CV revision could not be approved.',
        result: approveResult,
      },
      {
        fallback: 'The Workflow review could not be recorded.',
        result: reviewResult,
      },
    ]),
    mutationPending,
    reject,
    releaseDetachedCandidate,
    reset,
    reviewPending,
    save,
    saving,
  } as const
}
