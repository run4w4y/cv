import { Layer } from 'effect'

import { AnnotationsServiceLive } from './annotations'
import { ApplicationsServiceLive } from './applications'
import { CapturesServiceLive } from './captures'
import { CompensationsServiceLive } from './compensations'
import { EventsServiceLive } from './events'

export const RegistryServicesLive = Layer.mergeAll(
  AnnotationsServiceLive,
  ApplicationsServiceLive,
  CapturesServiceLive,
  CompensationsServiceLive,
  EventsServiceLive
)
