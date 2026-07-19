import type { ActiveCvPublicationRun, CvPublicationRun } from '../domain'
import type { CvPublicationRuns } from './model'

const activeTags = new Set<CvPublicationRun['_tag']>([
  'Queued',
  'PublishingLink',
  'StartingPdf',
])

export const isActivePublicationRun = (
  run: CvPublicationRun
): run is ActiveCvPublicationRun => activeTags.has(run._tag)

export const updatePublicationRun = (
  runs: CvPublicationRuns,
  runId: string,
  update: (run: CvPublicationRun) => CvPublicationRun
): CvPublicationRuns => {
  const run = runs.get(runId)
  if (run === undefined) return runs
  const next = new Map(runs)
  next.set(runId, update(run))
  return next
}

export const publicationRunIdentity = (run: CvPublicationRun) => ({
  applicationId: run.applicationId,
  entryId: run.entryId,
  executionId: run.executionId,
  runId: run.runId,
})
