import { usePreparationCommandGate } from '@/preparation/command-gate'
import type { PreparationWorkspace } from '@/preparation/workspace/atoms'
import { useCvEditorCommands } from './editor-commands'
import { useCvPreparationCommands } from './preparation-commands'
import { useCvPublicationCommands } from './publication-commands'

/**
 * Thin page facade. Domain commands own their atoms and validation; this hook
 * only coordinates one keyed transaction and preserves the component API.
 */
export const useCvPreparationActions = ({
  onCommandStarted,
  onRunStarted,
  workspace,
}: {
  readonly onCommandStarted?: (() => void) | undefined
  readonly onRunStarted: (runId: string) => void
  readonly workspace: PreparationWorkspace
}) => {
  const preparation = useCvPreparationCommands({ onRunStarted, workspace })
  const editor = useCvEditorCommands(workspace)
  const publication = useCvPublicationCommands(workspace)
  const commandGate = usePreparationCommandGate(workspace.editor.identity)
  const atomCommandPending =
    preparation.mutationPending ||
    editor.mutationPending ||
    publication.mutationPending
  const commandPending = commandGate.executing || atomCommandPending

  const resetCommandResults = () => {
    preparation.reset()
    editor.reset()
    publication.reset()
  }

  const execute = async (command: () => Promise<void>) => {
    if (atomCommandPending || !commandGate.claim()) return
    onCommandStarted?.()
    resetCommandResults()
    try {
      await command()
    } finally {
      commandGate.release()
    }
  }

  const releaseDetachedCandidate = () => {
    if (commandPending) return
    onCommandStarted?.()
    resetCommandResults()
    editor.releaseDetachedCandidate()
  }

  return {
    approve: () => execute(editor.approve),
    approvedRevision: publication.approvedRevision,
    approving: editor.approving,
    codexAvailable: preparation.codexAvailable,
    canApprove: editor.canApprove,
    cancelPublishing: () => execute(publication.cancelPublishing),
    cancellingPublication: publication.cancellingPublication,
    changeDraft: (value: unknown) => {
      if (!commandPending) editor.changeDraft(value)
    },
    changingAvailability: publication.changingAvailability,
    commandPending,
    document: editor.document,
    downloadPdf: () => execute(publication.downloadPdf),
    downloading: publication.downloading,
    error:
      editor.bindingError ??
      publication.runError ??
      (commandGate.hasStarted
        ? (preparation.error ?? editor.error ?? publication.commandError)
        : null) ??
      publication.queryError,
    generate: () => execute(preparation.generate),
    baseGuidance: preparation.baseGuidance,
    cvGenerationGuidance: preparation.cvGenerationGuidance,
    factsReleaseId: preparation.factsReleaseId,
    guidanceValid: preparation.guidanceValid,
    generatePdf: () => execute(publication.generatePdf),
    generatingPdf: publication.generatingPdf,
    publication: publication.publication,
    publicationExecuting: publication.publicationExecuting,
    publicationRun: publication.publicationRun,
    publish: () => execute(publication.publish),
    publishing: publication.publishing,
    refreshPublication: () => execute(publication.refreshPage),
    refreshingPublication: publication.refreshingPage,
    reject: () => execute(editor.reject),
    releaseDetachedCandidate,
    resetCommandResults,
    reviewPending: editor.reviewPending,
    save: () => execute(editor.save),
    saving: editor.saving,
    setPublicationAvailability: (enabled: boolean) =>
      execute(() => publication.setPublicationAvailability(enabled)),
    startPending: preparation.startPending,
    workflowExecuting: preparation.workflowExecuting,
    workflowOpen: preparation.workflowOpen,
  } as const
}

export type CvPreparationActions = ReturnType<typeof useCvPreparationActions>
