import type { PreparationRun } from '@cv/application-preparation-workflow/domain'
import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import { Cause } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { chatGptAuthenticatedAtom } from '@/preparation/auth/atoms'
import { preparationCommandGateKey } from '@/preparation/command-gate'
import { selectedPreparationModelAtom } from '@/preparation/forms/atoms'
import { keyedCommandFamily } from '@/preparation/keyed-command'
import { makeStartPreparationAtom } from '@/preparation/workflow/atoms'
import type { PreparationWorkspace } from '@/preparation/workspace/atoms'

const startPreparationFamily = keyedCommandFamily(
  'preparation/cv/command/start',
  makeStartPreparationAtom
)

export const workflowIsExecuting = (run: PreparationRun | null): boolean =>
  run?.status === 'queued' ||
  run?.status === 'running' ||
  run?.status === 'review_submitted' ||
  run?.status === 'cancelling'

export const workflowIsOpen = (run: PreparationRun | null): boolean =>
  workflowIsExecuting(run) || run?.status === 'awaiting_review'

export const useCvPreparationCommands = ({
  onRunStarted,
  workspace,
}: {
  readonly onRunStarted: (runId: string) => void
  readonly workspace: PreparationWorkspace
}) => {
  const [selectedModel, selectModel] = useAtom(selectedPreparationModelAtom)
  const authenticated = useAtomValue(chatGptAuthenticatedAtom)
  const startCommandAtom = startPreparationFamily(
    preparationCommandGateKey(workspace.editor.identity)
  )
  const [startResult, startPreparation] = useAtom(startCommandAtom, {
    mode: 'promise',
  })
  const resetStartResult = useAtomSet(startCommandAtom)
  const workflowExecuting = workflowIsExecuting(workspace.run)
  const workflowOpen = workflowIsOpen(workspace.run)
  const startPending = AsyncResult.isWaiting(startResult)

  const generate = async () => {
    const { bootstrap, editor } = workspace
    if (
      !authenticated ||
      editor.identity.kind !== 'cv' ||
      selectedModel === null ||
      workflowOpen ||
      startPending
    ) {
      return
    }
    try {
      const started = await startPreparation({
        coverLetterPrompt: null,
        kind: 'cv',
        locale: editor.identity.locale,
        modelId: selectedModel,
        source: {
          _tag: 'ReviewedContext',
          applicationId: editor.identity.applicationId,
          factsReleaseId: bootstrap.context.factsReleaseId,
          jobSnapshotId: bootstrap.context.jobSnapshot.id,
          url: bootstrap.context.jobSnapshot.requestedUrl,
        },
      })
      onRunStarted(started.runId)
    } catch {
      // The command atom retains the typed failure rendered by the page.
    }
  }

  return {
    authenticated,
    error: AsyncResult.isFailure(startResult)
      ? (Cause.prettyErrors(startResult.cause)[0]?.message ??
        'The CV preparation Workflow could not start.')
      : null,
    generate,
    mutationPending: startPending,
    reset: () => resetStartResult(Atom.Reset),
    selectModel,
    selectedModel,
    startPending,
    workflowExecuting,
    workflowOpen,
  } as const
}
