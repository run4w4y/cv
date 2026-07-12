import { Layer } from 'effect'

import { AnnotationsCrudD1Live } from './annotations'
import { ApplicationsCrudD1Live } from './applications'
import { CapturesCrudD1Live } from './captures'
import { CompensationsCrudD1Live } from './compensations'
import { EventsCrudD1Live } from './events'
import { FxRatesCrudD1Live } from './fx-rates'
import { OperationsCrudD1Live } from './operations'

export * from './annotations'
export * from './applications'
export * from './captures'
export * from './compensations'
export * from './events'
export * from './fx-rates'
export * from './operations'

export const RegistryCrudD1Live = Layer.mergeAll(
  AnnotationsCrudD1Live,
  ApplicationsCrudD1Live,
  CapturesCrudD1Live,
  CompensationsCrudD1Live,
  EventsCrudD1Live,
  FxRatesCrudD1Live,
  OperationsCrudD1Live
)
