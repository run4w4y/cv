import { Layer } from 'effect'

import { AnnotationsServiceLive } from './annotations'
import { ApplicationsServiceLive } from './applications'
import { CapturesServiceLive } from './captures'
import { CompensationsServiceLive } from './compensations'
import { ContentEntriesServiceLive } from './content'
import { CvPublicationsServiceLive } from './cv-publications'
import { EventsServiceLive } from './events'
import { FactsReleasesServiceLive } from './facts-releases'
import { JobPostingSnapshotsServiceLive } from './job-posting-snapshots'
import { ListingChecksServiceLive } from './listing-checks'
import { OpaqueObjectsServiceLive } from './opaque-objects'
import { PdfArtifactsServiceLive } from './pdf-artifacts'

export const RegistryContentServicesLive = Layer.mergeAll(
  ContentEntriesServiceLive,
  CvPublicationsServiceLive,
  FactsReleasesServiceLive,
  JobPostingSnapshotsServiceLive,
  OpaqueObjectsServiceLive,
  PdfArtifactsServiceLive
)

export const RegistryServicesLive = Layer.mergeAll(
  AnnotationsServiceLive,
  ApplicationsServiceLive,
  CapturesServiceLive,
  CompensationsServiceLive,
  EventsServiceLive,
  ListingChecksServiceLive,
  RegistryContentServicesLive
)
