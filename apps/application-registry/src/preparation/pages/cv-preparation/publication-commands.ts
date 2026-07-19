import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import { Cause } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { preparationCommandGateKey } from '@/preparation/command-gate'
import {
  makeReadCurrentPdfAtom,
  makeRefreshCvPageAtom,
  makeSetPublicationAvailabilityAtom,
  makeStartPdfGenerationAtom,
} from '@/preparation/data'
import { keyedCommandFamily } from '@/preparation/keyed-command'
import {
  currentCvPageAtom,
  cvPublicationRunAtom,
  makeCancelCvPublicationAtom,
  makeStartCvPublicationAtom,
} from '@/preparation/publication'
import type { PreparationWorkspace } from '@/preparation/workspace/atoms'
import { downloadPdf as downloadPdfBytes } from './pdf-download'
import {
  cvPublicationIsExecuting,
  resolveCurrentCvPage,
} from './publication-view'

const startPublicationFamily = keyedCommandFamily(
  'preparation/cv/command/start-publication',
  makeStartCvPublicationAtom
)
const cancelPublicationFamily = keyedCommandFamily(
  'preparation/cv/command/cancel-publication',
  makeCancelCvPublicationAtom
)
const downloadPdfFamily = keyedCommandFamily(
  'preparation/cv/command/download-pdf',
  makeReadCurrentPdfAtom
)
const publicationAvailabilityFamily = keyedCommandFamily(
  'preparation/cv/command/publication-availability',
  makeSetPublicationAvailabilityAtom
)
const generatePdfFamily = keyedCommandFamily(
  'preparation/cv/command/generate-pdf',
  makeStartPdfGenerationAtom
)
const refreshPageFamily = keyedCommandFamily(
  'preparation/cv/command/refresh-page',
  makeRefreshCvPageAtom
)

export const useCvPublicationCommands = (workspace: PreparationWorkspace) => {
  const { bootstrap, editor } = workspace
  const identity = editor.identity
  const publicationIdentity = {
    applicationId: identity.applicationId,
    entryId: bootstrap.entry.id,
  }
  const commandKey = preparationCommandGateKey(identity)
  const publicationStartCommandAtom = startPublicationFamily(commandKey)
  const publicationCancelCommandAtom = cancelPublicationFamily(commandKey)
  const downloadPdfCommandAtom = downloadPdfFamily(commandKey)
  const availabilityCommandAtom = publicationAvailabilityFamily(commandKey)
  const generatePdfCommandAtom = generatePdfFamily(commandKey)
  const refreshPageCommandAtom = refreshPageFamily(commandKey)
  const [publicationStartResult, startPublication] = useAtom(
    publicationStartCommandAtom,
    { mode: 'promise' }
  )
  const [publicationCancelResult, cancelPublication] = useAtom(
    publicationCancelCommandAtom,
    { mode: 'promise' }
  )
  const [downloadResult, readCurrentPdf] = useAtom(downloadPdfCommandAtom, {
    mode: 'promise',
  })
  const [availabilityResult, setAvailability] = useAtom(
    availabilityCommandAtom,
    { mode: 'promise' }
  )
  const [generatePdfResult, startPdfGeneration] = useAtom(
    generatePdfCommandAtom,
    { mode: 'promise' }
  )
  const [refreshPageResult, refreshPageState] = useAtom(
    refreshPageCommandAtom,
    { mode: 'promise' }
  )
  const resetPublicationStart = useAtomSet(publicationStartCommandAtom)
  const resetPublicationCancel = useAtomSet(publicationCancelCommandAtom)
  const resetDownload = useAtomSet(downloadPdfCommandAtom)
  const resetAvailability = useAtomSet(availabilityCommandAtom)
  const resetGeneratePdf = useAtomSet(generatePdfCommandAtom)
  const resetRefreshPage = useAtomSet(refreshPageCommandAtom)
  const publicationRunResult = useAtomValue(
    cvPublicationRunAtom(publicationIdentity)
  )
  const publicationQueryResult = useAtomValue(
    currentCvPageAtom(publicationIdentity)
  )
  const publicationRun =
    publicationRunResult._tag === 'Success' ? publicationRunResult.value : null
  const queriedPage =
    publicationQueryResult._tag === 'Success'
      ? publicationQueryResult.value
      : null
  const availabilityLink =
    availabilityResult._tag === 'Success' ? availabilityResult.value : null
  const page = resolveCurrentCvPage({
    availabilityLink,
    publicationRun,
    queriedPage,
  })
  const publicationExecuting = cvPublicationIsExecuting(publicationRun)
  const approvedRevision = editor.isApproved ? editor.baseRevision : null
  const publishing =
    publicationExecuting || AsyncResult.isWaiting(publicationStartResult)
  const cancellingPublication = AsyncResult.isWaiting(publicationCancelResult)
  const downloading = AsyncResult.isWaiting(downloadResult)
  const changingAvailability = AsyncResult.isWaiting(availabilityResult)
  const generatingPdf = AsyncResult.isWaiting(generatePdfResult)
  const refreshingPage = AsyncResult.isWaiting(refreshPageResult)
  const mutationPending =
    AsyncResult.isWaiting(publicationStartResult) ||
    AsyncResult.isWaiting(publicationCancelResult) ||
    AsyncResult.isWaiting(downloadResult) ||
    AsyncResult.isWaiting(availabilityResult) ||
    AsyncResult.isWaiting(generatePdfResult) ||
    AsyncResult.isWaiting(refreshPageResult)

  const publish = async () => {
    if (
      mutationPending ||
      publicationExecuting ||
      approvedRevision === null ||
      page === null ||
      page.link.currentRevisionId !== approvedRevision.revision.id
    ) {
      return
    }
    try {
      await startPublication({
        applicationId: identity.applicationId,
        entry: approvedRevision.entry,
        expectedPublicationVersion: page.link.publicationVersion,
      })
    } catch {
      // Workflow startup failures stay in the command atom.
    }
  }

  const cancelPublishing = async () => {
    if (mutationPending || publicationRun === null || !publicationExecuting) {
      return
    }
    try {
      await cancelPublication({
        executionId: publicationRun.executionId,
        runId: publicationRun.runId,
      })
    } catch {
      // The cancellation atom retains the typed failure.
    }
  }

  const downloadPdf = async () => {
    if (mutationPending || page === null || page.artifact?.status !== 'ready')
      return
    try {
      const ready = await readCurrentPdf(publicationIdentity)
      downloadPdfBytes({
        bytes: ready.bytes,
        filename: `cv-${page.link.token}.pdf`,
        mediaType: ready.artifact.mediaType ?? 'application/pdf',
      })
    } catch {
      // The command atom retains the typed failure rendered by the page.
    }
  }

  const setPublicationAvailability = async (enabled: boolean) => {
    if (mutationPending || page === null) return
    if (
      enabled &&
      (approvedRevision === null ||
        page.link.currentRevisionId !== approvedRevision.revision.id)
    ) {
      return
    }
    try {
      await setAvailability({
        applicationId: identity.applicationId,
        entryId: page.link.contentEntryId,
        input: {
          enabled,
          expectedPublicationVersion: page.link.publicationVersion,
          ...(!enabled
            ? { reason: 'Disabled manually from CV preparation.' }
            : {}),
        },
      })
    } catch {
      // The command atom retains the typed failure rendered by the page.
    }
  }

  const generatePdf = async () => {
    if (
      mutationPending ||
      page === null ||
      approvedRevision === null ||
      page.link.currentRevisionId !== approvedRevision.revision.id ||
      page.artifact?.status === 'pending'
    ) {
      return
    }
    try {
      await startPdfGeneration({
        applicationId: identity.applicationId,
        entryId: page.link.contentEntryId,
        input: {
          expectedPublicationVersion: page.link.publicationVersion,
          requestId: crypto.randomUUID(),
        },
      })
    } catch {
      // The command atom retains the typed failure rendered by the page.
    }
  }

  const refreshPage = async () => {
    if (mutationPending) return
    try {
      await refreshPageState(publicationIdentity)
    } catch {
      // The command atom retains the typed failure rendered by the page.
    }
  }

  const reset = () => {
    resetPublicationStart(Atom.Reset)
    resetPublicationCancel(Atom.Reset)
    resetDownload(Atom.Reset)
    resetAvailability(Atom.Reset)
    resetGeneratePdf(Atom.Reset)
    resetRefreshPage(Atom.Reset)
  }

  return {
    approvedRevision,
    cancelPublishing,
    cancellingPublication,
    changingAvailability,
    downloadPdf,
    downloading,
    generatePdf,
    generatingPdf,
    commandError: AsyncResult.isFailure(publicationStartResult)
      ? (Cause.prettyErrors(publicationStartResult.cause)[0]?.message ??
        'The CV publication Workflow could not start.')
      : AsyncResult.isFailure(publicationCancelResult)
        ? (Cause.prettyErrors(publicationCancelResult.cause)[0]?.message ??
          'The CV publication Workflow could not be cancelled.')
        : AsyncResult.isFailure(downloadResult)
          ? (Cause.prettyErrors(downloadResult.cause)[0]?.message ??
            'The stored PDF could not be downloaded.')
          : AsyncResult.isFailure(availabilityResult)
            ? (Cause.prettyErrors(availabilityResult.cause)[0]?.message ??
              'The public CV availability could not be changed.')
            : AsyncResult.isFailure(generatePdfResult)
              ? (Cause.prettyErrors(generatePdfResult.cause)[0]?.message ??
                'PDF generation could not be started.')
              : AsyncResult.isFailure(refreshPageResult)
                ? (Cause.prettyErrors(refreshPageResult.cause)[0]?.message ??
                  'The CV page status could not be refreshed.')
                : null,
    mutationPending,
    publication: page,
    publicationExecuting,
    publicationRun,
    publish,
    publishing,
    refreshPage,
    refreshingPage,
    queryError: AsyncResult.isFailure(publicationQueryResult)
      ? (Cause.prettyErrors(publicationQueryResult.cause)[0]?.message ??
        'The existing CV publication could not be loaded.')
      : null,
    reset,
    runError:
      publicationRun?._tag === 'Failed'
        ? publicationRun.error.message
        : publicationRun?._tag === 'Published'
          ? publicationRun.result.pdfStartError
          : null,
    setPublicationAvailability,
  } as const
}
