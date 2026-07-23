import type { RegistryEvent } from '@cv/application-registry-events'

import type { RegistryEventTopology } from './model'

const eventSubjectSegment: Record<RegistryEvent['_tag'], string> = {
  CvPublicationAvailabilityChanged: 'cv.publication-availability-changed',
  CvPublicationChanged: 'cv.publication-changed',
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
