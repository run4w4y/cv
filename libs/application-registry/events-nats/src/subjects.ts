import type { RegistryEvent } from '@cv/application-registry-events'

import type { RegistryEventTopology } from './model'

const eventSubjectSegment: Record<RegistryEvent['_tag'], string> = {
  ApplicationCreated: 'application.created',
  ApplicationNoteAdded: 'application.note-added',
  ApplicationRemoved: 'application.removed',
  ApplicationUpdated: 'application.updated',
  CompensationChanged: 'application.compensation-changed',
  ContentEntryCreated: 'content.entry-created',
  ContentRevisionAppended: 'content.revision-appended',
  ContentRevisionApproved: 'content.revision-approved',
  CvPublicationAvailabilityChanged: 'cv.publication-availability-changed',
  CvPublicationStaged: 'cv.publication-staged',
  JobPostingSnapshotPersisted: 'job-posting.snapshot-persisted',
  ListingCheckCompleted: 'listing-check.completed',
  PdfGenerated: 'cv.pdf-generated',
  PdfGenerationFailed: 'cv.pdf-generation-failed',
  PdfGenerationRequested: 'cv.pdf-generation-requested',
}

export const registryEventSubject = (
  topology: RegistryEventTopology,
  event: RegistryEvent
) => `${topology.subjectRoot}.${eventSubjectSegment[event._tag]}.v1`

export const registryEventWildcardSubject = (topology: RegistryEventTopology) =>
  `${topology.subjectRoot}.>`

export const cvPdfTriggerSubjects = (topology: RegistryEventTopology) => [
  `${topology.subjectRoot}.cv.publication-availability-changed.v1`,
  `${topology.subjectRoot}.cv.pdf-generation-requested.v1`,
]
