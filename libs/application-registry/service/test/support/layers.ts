import {
  ActivitiesCrud,
  AnnotationsCrud,
  type ApplicationsCrud,
  ApplicationsCrud as ApplicationsCrudTag,
  CompensationsCrud,
  IdempotencyCrud,
} from '@cv/application-registry-crud'
import { Effect, Layer } from 'effect'

import { application, applicationListRecord } from './fixtures'

export const applicationsCrud = (
  overrides: Partial<ApplicationsCrud> = {}
): ApplicationsCrud => ({
  facets: () =>
    Effect.succeed({
      companies: [application.company],
      labels: [],
    }),
  findByIdentifier: () => Effect.succeed(application),
  findByPostingFingerprint: () => Effect.succeed(undefined),
  findByPostingUrl: () => Effect.succeed([]),
  list: () =>
    Effect.succeed({
      items: [applicationListRecord],
      pageInfo: {
        kind: 'cursor',
        size: 50,
        hasNextPage: false,
        hasPreviousPage: false,
        nextCursor: null,
      },
    }),
  persist: () => Effect.void,
  updateManaged: () => Effect.succeed(true),
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
    ...overrides,
  })

export const compensationsCrudLayer = (
  overrides: Partial<CompensationsCrud> = {}
) =>
  Layer.succeed(CompensationsCrud, {
    listByApplication: () => Effect.succeed([]),
    ...overrides,
  })

export const activitiesCrudLayer = (overrides: Partial<ActivitiesCrud> = {}) =>
  Layer.succeed(ActivitiesCrud, {
    list: () =>
      Effect.succeed({
        items: [],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
        },
      }),
    listByApplication: () => Effect.succeed([]),
    ...overrides,
  })

export const idempotencyCrudLayer = (
  overrides: Partial<IdempotencyCrud> = {}
) =>
  Layer.succeed(IdempotencyCrud, {
    find: () => Effect.succeed(undefined),
    ...overrides,
  })
