import { cvRendererVersion } from '@cv/renderer'
import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'

import {
  anyAsyncResultWaiting,
  asyncResultFailureMessage,
} from '../../async-result'
import { preparationCommandGateKey } from '../../command-gate'
import { publicCvBaseUrl } from '../../config'
import {
  makeReadCurrentPdfAtom,
  makeSetPublicationAvailabilityAtom,
} from '../../data'
import { keyedCommandFamily } from '../../keyed-command'
import {
  currentPublishedCvAtom,
  cvPublicationRunAtom,
  makeCancelCvPublicationAtom,
  makeStartCvPublicationAtom,
} from '../../publication'
import type { PreparationWorkspace } from '../../workspace/atoms'
import { downloadBase64Pdf } from './pdf-download'
import {
  cvPublicationIsExecuting,
  resolveCurrentCvPublication,
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
  const resetPublicationStart = useAtomSet(publicationStartCommandAtom)
  const resetPublicationCancel = useAtomSet(publicationCancelCommandAtom)
  const resetDownload = useAtomSet(downloadPdfCommandAtom)
  const resetAvailability = useAtomSet(availabilityCommandAtom)
  const publicationRunResult = useAtomValue(
    cvPublicationRunAtom(publicationIdentity)
  )
  const publicationQueryResult = useAtomValue(
    currentPublishedCvAtom({
      ...publicationIdentity,
      rendererVersion: cvRendererVersion,
    })
  )
  const publicationRun =
    publicationRunResult._tag === 'Success' ? publicationRunResult.value : null
  const queriedPublication =
    publicationQueryResult._tag === 'Success'
      ? publicationQueryResult.value
      : null
  const availabilityLink =
    availabilityResult._tag === 'Success' ? availabilityResult.value : null
  const publication = resolveCurrentCvPublication({
    availabilityLink,
    publicationRun,
    queriedPublication,
  })
  const publicationExecuting = cvPublicationIsExecuting(publicationRun)
  const approvedRevision = editor.isApproved ? editor.baseRevision : null
  const publishing =
    publicationExecuting || AsyncResult.isWaiting(publicationStartResult)
  const cancellingPublication = AsyncResult.isWaiting(publicationCancelResult)
  const downloading = AsyncResult.isWaiting(downloadResult)
  const changingAvailability = AsyncResult.isWaiting(availabilityResult)
  const mutationPending = anyAsyncResultWaiting(
    publicationStartResult,
    publicationCancelResult,
    downloadResult,
    availabilityResult
  )

  const publish = async () => {
    if (
      mutationPending ||
      publicationExecuting ||
      approvedRevision === null ||
      editor.layoutAssessment?.status !== 'fits'
    ) {
      return
    }
    try {
      await startPublication({
        applicationId: identity.applicationId,
        entry: approvedRevision.entry,
        publicBaseUrl: publicCvBaseUrl(),
        rendererVersion: cvRendererVersion,
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
    if (mutationPending || publication === null) return
    try {
      const ready = await readCurrentPdf({
        ...publicationIdentity,
        rendererVersion: cvRendererVersion,
      })
      downloadBase64Pdf({
        data: ready.payload.data,
        filename: `cv-${publication.link.token}.pdf`,
        mediaType: ready.payload.mediaType,
      })
    } catch {
      // The command atom retains the typed failure rendered by the page.
    }
  }

  const setPublicationAvailability = async (enabled: boolean) => {
    if (mutationPending || publication === null) return
    try {
      await setAvailability({
        applicationId: identity.applicationId,
        entryId: publication.link.contentEntryId,
        input: {
          enabled,
          expectedPublicationVersion: publication.link.publicationVersion,
          ...(!enabled
            ? { reason: 'Disabled manually from CV preparation.' }
            : {}),
        },
      })
    } catch {
      // The command atom retains the typed failure rendered by the page.
    }
  }

  const reset = () => {
    resetPublicationStart(Atom.Reset)
    resetPublicationCancel(Atom.Reset)
    resetDownload(Atom.Reset)
    resetAvailability(Atom.Reset)
  }

  return {
    approvedRevision,
    cancelPublishing,
    cancellingPublication,
    changingAvailability,
    downloadPdf,
    downloading,
    commandError:
      asyncResultFailureMessage(
        publicationStartResult,
        'The CV publication Workflow could not start.'
      ) ??
      asyncResultFailureMessage(
        publicationCancelResult,
        'The CV publication Workflow could not be cancelled.'
      ) ??
      asyncResultFailureMessage(
        downloadResult,
        'The stored PDF could not be downloaded.'
      ) ??
      asyncResultFailureMessage(
        availabilityResult,
        'The public CV availability could not be changed.'
      ),
    mutationPending,
    publication,
    publicationExecuting,
    publicationRun,
    publish,
    publishing,
    queryError: asyncResultFailureMessage(
      publicationQueryResult,
      'The existing CV publication could not be loaded.'
    ),
    reset,
    runError:
      publicationRun?._tag === 'Failed' ? publicationRun.error.message : null,
    setPublicationAvailability,
  } as const
}
