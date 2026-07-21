import type { PreparationRun } from '@cv/application-preparation-workflow/domain'
import { useAtom, useAtomSet } from '@effect/atom-react'
import { Exit } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { isDesktopHost } from '@/host/desktop'
import { firstAsyncResultErrorMessage } from '@/lib/async-result'
import { preparationCommandGateKey } from '@/preparation/command-gate'
import type { PreparationEditorIdentity } from '@/preparation/editor'
import { coverLetterPromptAtom } from '@/preparation/forms/atoms'
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
  const codexAvailable = isDesktopHost()
  const [prompt, setPrompt] = useAtom(coverLetterPromptAtom(commandKey))
  const [startResult, startPreparation] = useAtom(startCommandAtom, {
    mode: 'promiseExit',
  })
  const [refreshResult, requestJobSnapshotRefresh] = useAtom(
    refreshCommandAtom,
    { mode: 'promiseExit' }
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
      !codexAvailable ||
      prompt.trim().length === 0 ||
      workflowOpen ||
      mutationPending
    ) {
      return
    }
    const exit = await startPreparation({
      coverLetterPrompt: prompt,
      cvGenerationGuidance: null,
      kind: 'cover_letter',
      locale: identity.locale,
      source: {
        _tag: 'ReviewedContext',
        applicationId: identity.applicationId,
        factsReleaseId: workspace.bootstrap.context.factsReleaseId,
        jobSnapshotId: workspace.bootstrap.context.jobSnapshot.id,
        url: workspace.bootstrap.context.jobSnapshot.requestedUrl,
      },
    })
    if (Exit.isSuccess(exit)) onRunStarted(exit.value.runId)
  }

  const refreshJobSnapshot = async () => {
    if (
      identity.applicationId.length === 0 ||
      mutationPending ||
      workflowExecuting
    ) {
      return
    }
    await requestJobSnapshotRefresh(identity.applicationId)
  }

  const reset = () => {
    resetStartResult(Atom.Reset)
    resetRefreshResult(Atom.Reset)
  }

  return {
    codexAvailable,
    error: firstAsyncResultErrorMessage([
      {
        fallback: 'The cover-letter preparation Workflow could not start.',
        result: startResult,
      },
      {
        fallback: 'The job posting could not be refreshed.',
        result: refreshResult,
      },
    ]),
    generate,
    mutationPending,
    prompt,
    refreshJobSnapshot,
    refreshPending,
    reset,
    setPrompt,
    startPending,
    workflowExecuting,
    workflowOpen,
  } as const
}
