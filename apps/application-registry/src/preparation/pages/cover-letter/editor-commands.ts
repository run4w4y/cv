import { useAtom, useAtomSet } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'

import {
  anyAsyncResultWaiting,
  asyncResultFailureMessage,
} from '../../async-result'
import { preparationCommandGateKey } from '../../command-gate'
import {
  coverLetterContractId,
  coverLetterContractVersion,
} from '../../cover-letter-contract'
import {
  makeAppendPreparationRevisionAtom,
  makeApprovePreparationRevisionAtom,
} from '../../data'
import {
  editPreparationDraftAtom,
  type PreparationEditorIdentity,
  recordPreparationSaveAtom,
  releaseDetachedPreparationWorkflowAtom,
} from '../../editor'
import { keyedCommandFamily } from '../../keyed-command'
import { makeSubmitPreparationReviewAtom } from '../../workflow/atoms'
import { ReviewDecisionSchema } from '../../workflow/domain'
import { isRevisionBoundToPreparationRun } from '../../workflow/review'
import type { PreparationWorkspace } from '../../workspace/atoms'
import { workflowIsExecuting } from './preparation-commands'

const appendRevisionFamily = keyedCommandFamily(
  'preparation/cover-letter/command/append-revision',
  makeAppendPreparationRevisionAtom
)
const approveRevisionFamily = keyedCommandFamily(
  'preparation/cover-letter/command/approve-revision',
  makeApprovePreparationRevisionAtom
)
const submitReviewFamily = keyedCommandFamily(
  'preparation/cover-letter/command/submit-review',
  makeSubmitPreparationReviewAtom
)

export const useCoverLetterEditorCommands = ({
  identity,
  workspace,
}: {
  readonly identity: PreparationEditorIdentity
  readonly workspace: PreparationWorkspace | null
}) => {
  const commandKey = preparationCommandGateKey(identity)
  const appendRevisionCommandAtom = appendRevisionFamily(commandKey)
  const approveRevisionCommandAtom = approveRevisionFamily(commandKey)
  const submitReviewCommandAtom = submitReviewFamily(commandKey)
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
  const editDraft = useAtomSet(editPreparationDraftAtom)
  const recordSave = useAtomSet(recordPreparationSaveAtom)
  const releaseDetachedCandidate = useAtomSet(
    releaseDetachedPreparationWorkflowAtom
  )
  const run = workspace?.run ?? null
  const saving = AsyncResult.isWaiting(saveResult)
  const approving = AsyncResult.isWaiting(approveResult)
  const reviewPending = AsyncResult.isWaiting(reviewResult)
  const mutationPending = anyAsyncResultWaiting(
    saveResult,
    approveResult,
    reviewResult
  )
  const workflowReviewBound =
    workspace === null ||
    workspace.editor.approvalMode !== 'workflow' ||
    (workspace.editor.baseRevision !== null &&
      run !== null &&
      isRevisionBoundToPreparationRun(run, workspace.editor.baseRevision))
  const bindingError =
    workspace?.editor.approvalMode === 'workflow' && !workflowReviewBound
      ? 'The selected revision does not belong to this Workflow review. Save an edit descended from the candidate or return to the bound candidate before submitting a decision.'
      : null

  const changeDraft = (document: unknown) => {
    if (mutationPending || workflowIsExecuting(run)) return
    editDraft({ document, identity })
  }

  const save = async () => {
    if (
      workspace === null ||
      mutationPending ||
      workflowIsExecuting(run) ||
      !workspace.editor.canSave ||
      !workspace.editor.validation.valid
    ) {
      return
    }
    const base = workspace.editor.baseRevision
    try {
      const result = await appendRevision({
        applicationId: identity.applicationId,
        contractId: coverLetterContractId,
        contractVersion: coverLetterContractVersion,
        entry: base?.entry ?? workspace.bootstrap.entry,
        factsReleaseId:
          base?.revision.factsReleaseId ??
          workspace.bootstrap.context.factsReleaseId,
        jobSnapshotId:
          base?.revision.jobSnapshotId ??
          workspace.bootstrap.context.jobSnapshot.id,
        source: 'human',
        value: workspace.editor.validation.value,
      })
      recordSave({
        identity,
        revision: { ...result, value: workspace.editor.validation.value },
      })
    } catch {
      // The keyed command atom retains the typed failure rendered by the page.
    }
  }

  const approve = async () => {
    const revision = workspace?.editor.baseRevision ?? null
    if (
      workspace === null ||
      mutationPending ||
      !workspace.editor.canApprove ||
      !workspace.editor.validation.valid ||
      revision === null ||
      !workflowReviewBound
    ) {
      return
    }
    try {
      if (workspace.editor.approvalMode === 'workflow') {
        if (run?.status !== 'awaiting_review') return
        await submitReview({
          decision: ReviewDecisionSchema.cases.Approved.make({
            revisionId: revision.revision.id,
          }),
          runId: run.runId,
          token: run.reviewToken,
        })
        return
      }
      const result = await approveRevision({
        applicationId: identity.applicationId,
        entry: revision.entry,
        revisionId: revision.revision.id,
      })
      recordSave({
        identity,
        revision: { ...result, value: revision.value },
      })
    } catch {
      // The keyed command atom retains the typed failure rendered by the page.
    }
  }

  const reject = async () => {
    if (mutationPending || run?.status !== 'awaiting_review') return
    try {
      await submitReview({
        decision: ReviewDecisionSchema.cases.Rejected.make({
          reason: 'Rejected during human cover-letter review.',
        }),
        runId: run.runId,
        token: run.reviewToken,
      })
    } catch {
      // The keyed command atom retains the typed failure rendered by the page.
    }
  }

  const adoptDetachedCandidate = () => {
    const candidate = workspace?.editor.workflowCandidate
    if (
      candidate?._tag !== 'Detached' ||
      mutationPending ||
      workflowIsExecuting(run)
    ) {
      return
    }
    releaseDetachedCandidate({
      candidateRevisionId: candidate.candidateRevisionId,
      identity,
    })
  }

  const reset = () => {
    resetSaveResult(Atom.Reset)
    resetApproveResult(Atom.Reset)
    resetReviewResult(Atom.Reset)
  }

  return {
    adoptDetachedCandidate,
    approve,
    approvePending: approving,
    bindingError,
    changeDraft,
    error:
      asyncResultFailureMessage(
        saveResult,
        'The cover-letter revision could not be saved.'
      ) ??
      asyncResultFailureMessage(
        approveResult,
        'The cover-letter revision could not be approved.'
      ) ??
      asyncResultFailureMessage(
        reviewResult,
        'The Workflow review decision could not be recorded.'
      ),
    mutationPending,
    reject,
    reset,
    reviewPending,
    save,
    savePending: saving,
    workflowReviewBound,
  } as const
}
