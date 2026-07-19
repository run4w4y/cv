import type { PreparationRun } from '@cv/application-preparation-workflow/domain'
import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import { Cause } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { chatGptAuthenticatedAtom } from '@/preparation/auth/atoms'
import { preparationCommandGateKey } from '@/preparation/command-gate'
import type { PreparationEditorIdentity } from '@/preparation/editor'
import {
  coverLetterPromptAtom,
  selectedPreparationModelAtom,
} from '@/preparation/forms/atoms'
import { keyedCommandFamily } from '@/preparation/keyed-command'
import { refreshJobSnapshotCommandAtom } from '@/preparation/snapshot-command'
import { makeStartPreparationAtom } from '@/preparation/workflow/atoms'
import type { PreparationWorkspace } from '@/preparation/workspace/atoms'

const startPreparationFamily = keyedCommandFamily(
  'preparation/cover-letter/command/start',
  makeStartPreparationAtom
)

export const workflowIsExecuting = (run: PreparationRun | null): boolean =>
  run?.status === 'queued' ||
  run?.status === 'running' ||
  run?.status === 'review_submitted' ||
  run?.status === 'cancelling'

export const workflowIsOpen = (run: PreparationRun | null): boolean =>
  workflowIsExecuting(run) || run?.status === 'awaiting_review'

export const useCoverLetterPreparationCommands = ({
  identity,
  onRunStarted,
  workspace,
}: {
  readonly identity: PreparationEditorIdentity
  readonly onRunStarted: (runId: string) => void
  readonly workspace: PreparationWorkspace | null
}) => {
  const commandKey = preparationCommandGateKey(identity)
  const startCommandAtom = startPreparationFamily(commandKey)
  const refreshCommandAtom = refreshJobSnapshotCommandAtom(identity)
  const authenticated = useAtomValue(chatGptAuthenticatedAtom)
  const [selectedModel, selectModel] = useAtom(selectedPreparationModelAtom)
  const [prompt, setPrompt] = useAtom(coverLetterPromptAtom(commandKey))
  const [startResult, startPreparation] = useAtom(startCommandAtom, {
    mode: 'promise',
  })
  const [refreshResult, requestJobSnapshotRefresh] = useAtom(
    refreshCommandAtom,
    { mode: 'promise' }
  )
  const resetStartResult = useAtomSet(startCommandAtom)
  const resetRefreshResult = useAtomSet(refreshCommandAtom)
  const run = workspace?.run ?? null
  const workflowExecuting = workflowIsExecuting(run)
  const workflowOpen = workflowIsOpen(run)
  const startPending = AsyncResult.isWaiting(startResult)
  const refreshPending = AsyncResult.isWaiting(refreshResult)
  const mutationPending =
    AsyncResult.isWaiting(startResult) || AsyncResult.isWaiting(refreshResult)

  const generate = async () => {
    if (
      workspace === null ||
      !authenticated ||
      selectedModel === null ||
      prompt.trim().length === 0 ||
      workflowOpen ||
      mutationPending
    ) {
      return
    }
    try {
      const result = await startPreparation({
        coverLetterPrompt: prompt,
        kind: 'cover_letter',
        locale: identity.locale,
        modelId: selectedModel,
        source: {
          _tag: 'ReviewedContext',
          applicationId: identity.applicationId,
          factsReleaseId: workspace.bootstrap.context.factsReleaseId,
          jobSnapshotId: workspace.bootstrap.context.jobSnapshot.id,
          url: workspace.bootstrap.context.jobSnapshot.requestedUrl,
        },
      })
      onRunStarted(result.runId)
    } catch {
      // The keyed command atom retains the typed failure rendered by the page.
    }
  }

  const refreshJobSnapshot = async () => {
    if (
      identity.applicationId.length === 0 ||
      mutationPending ||
      workflowExecuting
    ) {
      return
    }
    try {
      await requestJobSnapshotRefresh(identity.applicationId)
    } catch {
      // The keyed command atom retains the typed failure rendered by the page.
    }
  }

  const reset = () => {
    resetStartResult(Atom.Reset)
    resetRefreshResult(Atom.Reset)
  }

  return {
    authenticated,
    error: AsyncResult.isFailure(startResult)
      ? (Cause.prettyErrors(startResult.cause)[0]?.message ??
        'The cover-letter preparation Workflow could not start.')
      : AsyncResult.isFailure(refreshResult)
        ? (Cause.prettyErrors(refreshResult.cause)[0]?.message ??
          'The job posting could not be refreshed.')
        : null,
    generate,
    mutationPending,
    prompt,
    refreshJobSnapshot,
    refreshPending,
    reset,
    selectModel,
    selectedModel,
    setPrompt,
    startPending,
    workflowExecuting,
    workflowOpen,
  } as const
}
