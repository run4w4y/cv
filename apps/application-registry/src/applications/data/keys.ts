import { activityListsReactivityKey } from '../../events/data'

export const applicationReactivity = {
  lists: 'registry:applications:list',
  facets: 'registry:applications:facets',
  application: (applicationId: string) =>
    `registry:applications:${applicationId}`,
  compensations: (applicationId: string) =>
    `registry:applications:${applicationId}:compensations`,
  activities: (applicationId: string) =>
    `registry:applications:${applicationId}:activities`,
} as const

export const applicationMutationKeys = (applicationId: string) => [
  applicationReactivity.lists,
  applicationReactivity.facets,
  applicationReactivity.application(applicationId),
  applicationReactivity.compensations(applicationId),
  applicationReactivity.activities(applicationId),
  activityListsReactivityKey,
]

export const createApplicationMutationKeys = [
  applicationReactivity.lists,
  applicationReactivity.facets,
]
