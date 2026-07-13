import { Layer } from 'effect'

import { AnnotationsServiceLive } from './annotations'
import { ApplicationsServiceLive } from './applications'
import { CapturesServiceLive } from './captures'
import { CompensationsServiceLive } from './compensations'
import { EventsServiceLive } from './events'
import { ListingChecksServiceLive } from './listing-checks'

export const RegistryServicesLive = Layer.mergeAll(
  AnnotationsServiceLive,
  ApplicationsServiceLive,
  CapturesServiceLive,
  CompensationsServiceLive,
  EventsServiceLive,
  ListingChecksServiceLive
)
