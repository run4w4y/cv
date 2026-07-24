import type {
  ListApplicationsQuery,
  ListApplicationsResponse,
} from '@cv/application-registry-api-contract'
import { Effect, Option, Stream } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'
import { uniqBy } from 'es-toolkit'

import { RegistryClient, registryQuery } from '../../lib/registry-client'
import { applicationReactivity } from './keys'

export type ApplicationArtifactIdentity = {
  readonly applicationId: string
  readonly artifactId: string
}

export type ApplicationsListRequest = Omit<
  ListApplicationsQuery,
  'pagination'
> & {
  readonly size: number
}

const applicationPageAtom = (
  request: ApplicationsListRequest,
  after: string | null
) => {
  const { size, ...query } = request
  return registryQuery('listApplications', {
    query: {
      ...query,
      pagination: { size, ...(after === null ? {} : { after }) },
    },
    reactivityKeys: [applicationReactivity.lists],
    timeToLive: '5 minutes',
  })
}

const createApplicationsAtom = (request: ApplicationsListRequest) =>
  Atom.pull((get) =>
    Stream.paginate(null as string | null, (after) =>
      get
        .result(applicationPageAtom(request, after), {
          suspendOnWaiting: true,
        })
        .pipe(
          Effect.map(
            (
              response
            ): readonly [
              readonly ListApplicationsResponse[],
              Option.Option<string>,
            ] => [
              [response],
              response.pageInfo.hasNextPage &&
              response.pageInfo.nextCursor !== null
                ? Option.some(response.pageInfo.nextCursor)
                : Option.none(),
            ]
          )
        )
    )
  ).pipe(
    Atom.mapResult(({ done, items }) => ({
      done,
      items: uniqBy(
        items.flatMap((page) => page.items),
        ({ id }) => id
      ),
      totalItems: items.at(0)?.pageInfo.totalItems,
    })),
    Atom.setIdleTTL('5 minutes')
  )

type ApplicationsPullResult =
  ReturnType<typeof createApplicationsAtom> extends Atom.Writable<
    infer Result,
    void
  >
    ? Result
    : never

const disabledApplicationsAtom = Atom.writable<ApplicationsPullResult, void>(
  () => AsyncResult.initial(),
  () => undefined
)

type ApplicationsFamilyInput = ApplicationsListRequest & {
  readonly enabled: boolean
}

export const applicationsAtom = Atom.family(
  (input: ApplicationsFamilyInput) => {
    const { enabled, ...request } = input
    return enabled ? createApplicationsAtom(request) : disabledApplicationsAtom
  }
)

export const applicationFacetsAtom = registryQuery('listApplicationFacets', {
  reactivityKeys: [applicationReactivity.facets],
  timeToLive: '30 minutes',
}).pipe(
  Atom.swr({
    staleTime: '1 minute',
    revalidateOnMount: true,
    revalidateOnFocus: false,
  })
)

export const applicationAtom = Atom.family((applicationId: string) =>
  registryQuery('getApplication', {
    params: { id: applicationId },
    reactivityKeys: [applicationReactivity.application(applicationId)],
    timeToLive: '5 minutes',
  }).pipe(
    Atom.swr({
      staleTime: 0,
      revalidateOnMount: true,
      revalidateOnFocus: false,
    })
  )
)

export const applicationCompensationsAtom = Atom.family(
  (applicationId: string) =>
    registryQuery('listApplicationCompensations', {
      params: { id: applicationId },
      reactivityKeys: [applicationReactivity.compensations(applicationId)],
      timeToLive: '5 minutes',
    })
)

export const applicationActivitiesAtom = Atom.family((applicationId: string) =>
  registryQuery('listApplicationActivities', {
    params: { id: applicationId },
    reactivityKeys: [applicationReactivity.activities(applicationId)],
    timeToLive: '2 minutes',
  })
)

export const applicationArtifactsAtom = Atom.family((applicationId: string) =>
  registryQuery('listApplicationArtifacts', {
    params: { id: applicationId },
    reactivityKeys: [applicationReactivity.artifacts(applicationId)],
    timeToLive: '2 minutes',
  }).pipe(
    Atom.swr({
      staleTime: 0,
      revalidateOnMount: true,
      revalidateOnFocus: false,
    })
  )
)

export const applicationArtifactAtom = Atom.family(
  (identity: ApplicationArtifactIdentity) =>
    registryQuery('getApplicationArtifact', {
      params: {
        artifactId: identity.artifactId,
        id: identity.applicationId,
      },
      reactivityKeys: [applicationReactivity.artifacts(identity.applicationId)],
      timeToLive: '5 minutes',
    })
)

export const applicationArtifactContentAtom = Atom.family(
  (identity: ApplicationArtifactIdentity) =>
    registryQuery('readApplicationArtifact', {
      params: {
        artifactId: identity.artifactId,
        id: identity.applicationId,
      },
      timeToLive: '1 minute',
    }).pipe(Atom.setIdleTTL('1 minute'))
)

export const readApplicationArtifactContent =
  RegistryClient.runtime.fn<ApplicationArtifactIdentity>()((identity, get) =>
    get.result(applicationArtifactContentAtom(identity), {
      suspendOnWaiting: true,
    })
  )

export const refreshApplicationArtifacts = RegistryClient.runtime.fn<string>()(
  (applicationId) =>
    Reactivity.invalidate([applicationReactivity.artifacts(applicationId)])
)

export const reloadLatestApplication = RegistryClient.runtime.fn<string>()(
  (applicationId, get) => {
    const query = applicationAtom(applicationId)
    get.refresh(query)
    return get
      .result(query, { suspendOnWaiting: true })
      .pipe(
        Effect.tap(() =>
          Reactivity.invalidate([
            applicationReactivity.lists,
            applicationReactivity.facets,
          ])
        )
      )
  }
)

export const refreshApplicationLists = RegistryClient.runtime.fn(() =>
  Reactivity.invalidate([applicationReactivity.lists])
)
