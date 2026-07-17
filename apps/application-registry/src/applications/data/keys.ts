import { eventListsReactivityKey } from '../../events/data'

export const applicationReactivity = {
  lists: 'registry:applications:list',
  facets: 'registry:applications:facets',
  application: (applicationId: string) =>
    `registry:applications:${applicationId}`,
  compensations: (applicationId: string) =>
    `registry:applications:${applicationId}:compensations`,
  events: (applicationId: string) =>
    `registry:applications:${applicationId}:events`,
} as const

export const applicationMutationKeys = (applicationId: string) => [
  applicationReactivity.lists,
  applicationReactivity.facets,
  applicationReactivity.application(applicationId),
  applicationReactivity.compensations(applicationId),
  applicationReactivity.events(applicationId),
  eventListsReactivityKey,
]

export const createApplicationMutationKeys = [
  applicationReactivity.lists,
  applicationReactivity.facets,
]
