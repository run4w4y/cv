import {
  AnnotationsCrud,
  type ApplicationsCrud,
  ApplicationsCrud as ApplicationsCrudTag,
  CapturesCrud,
  CompensationsCrud,
  EventsCrud,
  OperationsCrud,
} from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'

import { RegistryIds } from '../../src/ids/service'

import { application } from './fixtures'

export const applicationsCrud = (
  overrides: Partial<ApplicationsCrud> = {}
): ApplicationsCrud => ({
  findByIdentifier: () => Effect.succeed(application),
  findByJobKey: () => Effect.succeed(application),
  list: () => Effect.succeed({ hasNextPage: false, items: [application] }),
  patch: () => Effect.succeed(application),
  persist: () => Effect.void,
  persistEvent: () => Effect.succeed(true),
  remove: () => Effect.succeed(true),
  ...overrides,
})

export const applicationsCrudLayer = (
  overrides: Partial<ApplicationsCrud> = {}
) => Layer.succeed(ApplicationsCrudTag, applicationsCrud(overrides))

export const annotationsCrudLayer = (
  overrides: Partial<AnnotationsCrud> = {}
) =>
  Layer.succeed(AnnotationsCrud, {
    findNote: () => Effect.succeed(undefined),
    listLabels: () => Effect.succeed([]),
    listNotes: () => Effect.succeed([]),
    persistNote: () => Effect.void,
    replaceLabels: () => Effect.succeed([]),
    ...overrides,
  })

export const capturesCrudLayer = (overrides: Partial<CapturesCrud> = {}) =>
  Layer.succeed(CapturesCrud, {
    findByOperation: () => Effect.succeed(undefined),
    listByApplication: () => Effect.succeed([]),
    persist: () => Effect.void,
    ...overrides,
  })

export const compensationsCrudLayer = (
  overrides: Partial<CompensationsCrud> = {}
) =>
  Layer.succeed(CompensationsCrud, {
    listByApplication: () => Effect.succeed([]),
    ...overrides,
  })

export const eventsCrudLayer = (overrides: Partial<EventsCrud> = {}) =>
  Layer.succeed(EventsCrud, {
    findByOperation: () => Effect.succeed(undefined),
    list: () => Effect.succeed({ hasNextPage: false, items: [] }),
    listByApplication: () => Effect.succeed([]),
    ...overrides,
  })

export const operationsCrudLayer = (overrides: Partial<OperationsCrud> = {}) =>
  Layer.succeed(OperationsCrud, {
    find: () => Effect.succeed(undefined),
    ...overrides,
  })

export const registryIdsLayer = (values: readonly [string, ...string[]]) => {
  const remaining = [...values]

  return Layer.succeed(RegistryIds, {
    next: Effect.suspend(() => {
      const value = remaining.shift()
      return value === undefined
        ? Effect.die(new Error('The test exhausted its registry IDs.'))
        : Effect.succeed(value)
    }),
  })
}
