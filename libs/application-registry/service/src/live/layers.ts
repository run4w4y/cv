import { Layer } from 'effect'
import { ActivitiesServiceLive } from './activities'
import { AnnotationsServiceLive } from './annotations'
import { ApplicationsServiceLive } from './applications'
import { CompensationsServiceLive } from './compensations'
import { ContentEntriesServiceLive } from './content'
import { CvAnalyticsServiceLive } from './cv-analytics'
import { CvPublicationsServiceLive } from './cv-publications'
import { JobPostingCaptureServiceLive } from './job-posting-capture'
import { JobPostingSnapshotsServiceLive } from './job-posting-snapshots'
import { ListingChecksServiceLive } from './listing-checks'
import { OpaqueObjectsServiceLive } from './opaque-objects'
import { PdfArtifactsServiceLive } from './pdf-artifacts'

export const RegistryContentServicesLive = Layer.mergeAll(
  ContentEntriesServiceLive,
  CvPublicationsServiceLive,
  JobPostingSnapshotsServiceLive,
  OpaqueObjectsServiceLive,
  PdfArtifactsServiceLive
)

const RegistryCoreServicesLive = Layer.mergeAll(
  AnnotationsServiceLive,
  ApplicationsServiceLive,
  CompensationsServiceLive,
  CvAnalyticsServiceLive,
  ActivitiesServiceLive,
  ListingChecksServiceLive,
  RegistryContentServicesLive
)

export const RegistryServicesLive = Layer.merge(
  RegistryCoreServicesLive,
  JobPostingCaptureServiceLive.pipe(Layer.provide(RegistryCoreServicesLive))
)
