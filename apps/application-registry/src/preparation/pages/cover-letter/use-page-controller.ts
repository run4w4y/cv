import { useAtomValue } from '@effect/atom-react'
import { Cause } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import { useParams, useSearchParams } from 'react-router'

import { usePreparationCommandGate } from '@/preparation/command-gate'
import type { PreparationEditorIdentity } from '@/preparation/editor'
import {
  type PreparationWorkspace,
  preparationWorkspaceAtom,
} from '@/preparation/workspace/atoms'
import { useCoverLetterEditorCommands } from './editor-commands'
import { useCoverLetterPreparationCommands } from './preparation-commands'

export type CoverLetterWorkspace = PreparationWorkspace

export const useCoverLetterPageController = () => {
  const { applicationId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const locale = searchParams.get('locale') ?? 'en'
  const requestedRunId = searchParams.get('run')
  const identity: PreparationEditorIdentity = {
    applicationId,
    kind: 'cover_letter',
    locale,
  }
  const workspaceResult = useAtomValue(
    preparationWorkspaceAtom({ ...identity, requestedRunId })
  )
  const workspace =
    workspaceResult._tag === 'Success' ? workspaceResult.value : null
  const updateRun = (runId: string) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('run', runId)
      return next
    })
  }
  const preparation = useCoverLetterPreparationCommands({
    identity,
    onRunStarted: updateRun,
    workspace,
  })
  const editor = useCoverLetterEditorCommands({ identity, workspace })
  const commandGate = usePreparationCommandGate(identity)
  const atomActionPending =
    preparation.mutationPending || editor.mutationPending
  const actionPending = commandGate.executing || atomActionPending

  const resetMutationResults = () => {
    preparation.reset()
    editor.reset()
  }

  const execute = async (command: () => Promise<void>) => {
    if (atomActionPending || !commandGate.claim()) return
    resetMutationResults()
    try {
      await command()
    } finally {
      commandGate.release()
    }
  }

  const changeLocale = (nextLocale: string) => {
    if (nextLocale === locale || actionPending) return
    resetMutationResults()
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('locale', nextLocale)
      next.delete('run')
      return next
    })
  }

  const adoptDetachedCandidate = () => {
    if (actionPending) return
    resetMutationResults()
    editor.adoptDetachedCandidate()
  }

  const workspaceState =
    workspaceResult._tag === 'Success'
      ? ({ status: 'ready', value: workspaceResult.value } as const)
      : workspaceResult._tag === 'Failure'
        ? ({
            message:
              Cause.prettyErrors(workspaceResult.cause)[0]?.message ??
              'The preparation context could not be loaded.',
            status: 'error',
          } as const)
        : ({ status: 'loading' } as const)

  return {
    actionError: commandGate.hasStarted
      ? (preparation.error ?? editor.error)
      : null,
    actionPending,
    adoptDetachedCandidate,
    applicationId,
    approve: () => execute(editor.approve),
    approvePending: editor.approvePending,
    authenticated: preparation.authenticated,
    changeDraft: (document: unknown) => {
      if (!actionPending) editor.changeDraft(document)
    },
    changeLocale,
    generate: () => execute(preparation.generate),
    locale,
    prompt: preparation.prompt,
    refreshJobSnapshot: () => execute(preparation.refreshJobSnapshot),
    reject: () => execute(editor.reject),
    reviewPending: editor.reviewPending,
    save: () => execute(editor.save),
    savePending: editor.savePending,
    selectModel: (modelId: string) => {
      if (!actionPending) preparation.selectModel(modelId)
    },
    selectedModel: preparation.selectedModel,
    setPrompt: (prompt: string) => {
      if (!actionPending) preparation.setPrompt(prompt)
    },
    snapshotRefreshPending:
      preparation.refreshPending || AsyncResult.isWaiting(workspaceResult),
    startPending: preparation.startPending,
    workflowBindingError: editor.bindingError,
    workflowExecuting: preparation.workflowExecuting,
    workflowOpen: preparation.workflowOpen,
    workflowReviewBound: editor.workflowReviewBound,
    workspaceState,
  } as const
}

export type CoverLetterPageController = ReturnType<
  typeof useCoverLetterPageController
>
