import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import { Exit } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { firstAsyncResultErrorMessage } from '@/lib/async-result'
import { preparationCommandGateKey } from '@/preparation/command-gate'
import {
  makeReadCurrentPdfAtom,
  makeRefreshCvPageAtom,
  makeRequestPdfGenerationAtom,
  makeSetPublicationAvailabilityAtom,
} from '@/preparation/data'
import { keyedCommandFamily } from '@/preparation/keyed-command'
import {
  currentCvPageAtom,
  cvPublicationCanGeneratePdf,
  cvPublicationHasReadyPdf,
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
  makeRequestPdfGenerationAtom
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
    { mode: 'promiseExit' }
  )
  const [publicationCancelResult, cancelPublication] = useAtom(
    publicationCancelCommandAtom,
    { mode: 'promiseExit' }
  )
  const [downloadResult, readCurrentPdf] = useAtom(downloadPdfCommandAtom, {
    mode: 'promiseExit',
  })
  const [availabilityResult, setAvailability] = useAtom(
    availabilityCommandAtom,
    { mode: 'promiseExit' }
  )
  const [generatePdfResult, requestPdfGeneration] = useAtom(
    generatePdfCommandAtom,
    { mode: 'promiseExit' }
  )
  const [refreshPageResult, refreshPageState] = useAtom(
    refreshPageCommandAtom,
    { mode: 'promiseExit' }
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
    await startPublication({
      applicationId: identity.applicationId,
      entry: approvedRevision.entry,
      expectedPublicationVersion: page.link.publicationVersion,
    })
  }

  const cancelPublishing = async () => {
    if (mutationPending || publicationRun === null || !publicationExecuting) {
      return
    }
    await cancelPublication({
      executionId: publicationRun.executionId,
      runId: publicationRun.runId,
    })
  }

  const downloadPdf = async () => {
    if (mutationPending || page === null || page.artifact?.status !== 'ready')
      return
    const exit = await readCurrentPdf(publicationIdentity)
    if (Exit.isFailure(exit)) return
    downloadPdfBytes({
      bytes: exit.value.bytes,
      filename: `cv-${page.link.token}.pdf`,
      mediaType: exit.value.artifact.mediaType ?? 'application/pdf',
    })
  }

  const setPublicationAvailability = async (enabled: boolean) => {
    if (mutationPending || page === null) return
    if (
      enabled &&
      (approvedRevision === null ||
        page.link.currentRevisionId !== approvedRevision.revision.id ||
        !cvPublicationHasReadyPdf(page))
    ) {
      return
    }
    await setAvailability({
      applicationId: identity.applicationId,
      entryId: page.link.contentEntryId,
      operationId: crypto.randomUUID(),
      input: {
        enabled,
        expectedPublicationVersion: page.link.publicationVersion,
        ...(!enabled
          ? { reason: 'Disabled manually from CV preparation.' }
          : {}),
      },
    })
  }

  const generatePdf = async () => {
    if (
      mutationPending ||
      page === null ||
      approvedRevision === null ||
      page.link.currentRevisionId !== approvedRevision.revision.id ||
      !cvPublicationCanGeneratePdf(page)
    ) {
      return
    }
    const operationId = crypto.randomUUID()
    await requestPdfGeneration({
      applicationId: identity.applicationId,
      entryId: page.link.contentEntryId,
      input: {
        expectedPublicationVersion: page.link.publicationVersion,
      },
      operationId,
    })
  }

  const refreshPage = async () => {
    if (mutationPending) return
    await refreshPageState(publicationIdentity)
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
    commandError: firstAsyncResultErrorMessage([
      {
        fallback: 'The CV publication Workflow could not start.',
        result: publicationStartResult,
      },
      {
        fallback: 'The CV publication Workflow could not be cancelled.',
        result: publicationCancelResult,
      },
      {
        fallback: 'The stored PDF could not be downloaded.',
        result: downloadResult,
      },
      {
        fallback: 'The public CV availability could not be changed.',
        result: availabilityResult,
      },
      {
        fallback: 'PDF generation could not be started.',
        result: generatePdfResult,
      },
      {
        fallback: 'The CV page status could not be refreshed.',
        result: refreshPageResult,
      },
    ]),
    mutationPending,
    publication: page,
    publicationExecuting,
    publicationRun,
    publish,
    publishing,
    refreshPage,
    refreshingPage,
    queryError: firstAsyncResultErrorMessage([
      {
        fallback: 'The existing CV publication could not be loaded.',
        result: publicationQueryResult,
      },
    ]),
    reset,
    runError:
      publicationRun?._tag === 'Failed' ? publicationRun.error.message : null,
    setPublicationAvailability,
  } as const
}
