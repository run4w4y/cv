import type { PreparationRun } from '@cv/application-preparation-workflow/domain'
import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import { Exit } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { isDesktopHost } from '@/host/desktop'
import { asyncResultErrorMessage } from '@/lib/async-result'
import { preparationCommandGateKey } from '@/preparation/command-gate'
import {
  cvGenerationGuidanceOverrideAtom,
  isValidCvGenerationGuidance,
} from '@/preparation/guidance/atoms'
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
  const codexAvailable = isDesktopHost()
  const factsReleaseId = workspace.bootstrap.context.factsReleaseId
  const baseGuidance = workspace.bootstrap.context.cvGenerationGuidance
  const guidanceOverride = useAtomValue(
    cvGenerationGuidanceOverrideAtom(factsReleaseId)
  )
  const cvGenerationGuidance = guidanceOverride ?? baseGuidance
  const guidanceValid = isValidCvGenerationGuidance(cvGenerationGuidance)
  const startCommandAtom = startPreparationFamily(
    preparationCommandGateKey(workspace.editor.identity)
  )
  const [startResult, startPreparation] = useAtom(startCommandAtom, {
    mode: 'promiseExit',
  })
  const resetStartResult = useAtomSet(startCommandAtom)
  const workflowExecuting = workflowIsExecuting(workspace.run)
  const workflowOpen = workflowIsOpen(workspace.run)
  const startPending = AsyncResult.isWaiting(startResult)

  const generate = async () => {
    const { bootstrap, editor } = workspace
    if (
      !codexAvailable ||
      editor.identity.kind !== 'cv' ||
      !guidanceValid ||
      workflowOpen ||
      startPending
    ) {
      return
    }
    const exit = await startPreparation({
      coverLetterPrompt: null,
      cvGenerationGuidance,
      kind: 'cv',
      locale: editor.identity.locale,
      source: {
        _tag: 'ReviewedContext',
        applicationId: editor.identity.applicationId,
        factsReleaseId: bootstrap.context.factsReleaseId,
        jobSnapshotId: bootstrap.context.jobSnapshot.id,
        url: bootstrap.context.jobSnapshot.requestedUrl,
      },
    })
    if (Exit.isSuccess(exit)) onRunStarted(exit.value.runId)
  }

  return {
    codexAvailable,
    error:
      asyncResultErrorMessage(
        startResult,
        'The CV preparation Workflow could not start.'
      ) ?? null,
    generate,
    baseGuidance,
    cvGenerationGuidance,
    factsReleaseId,
    guidanceValid,
    mutationPending: startPending,
    reset: () => resetStartResult(Atom.Reset),
    startPending,
    workflowExecuting,
    workflowOpen,
  } as const
}
