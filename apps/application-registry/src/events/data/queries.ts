import type {
  ListActivitiesQuery,
  ListActivitiesResponse,
} from '@cv/application-registry-api-contract'
import { Effect, Option, Stream } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'
import { uniqBy } from 'es-toolkit'

import { RegistryClient, registryQuery } from '../../lib/registry-client'
import { activityListsReactivityKey } from './keys'

export type EventsListRequest = Omit<ListActivitiesQuery, 'pagination'> & {
  readonly size: number
}

const eventPageAtom = (request: EventsListRequest, after: string | null) => {
  const { size, ...query } = request
  return registryQuery('listActivities', {
    query: {
      ...query,
      pagination: { size, ...(after === null ? {} : { after }) },
    },
    reactivityKeys: [activityListsReactivityKey],
    timeToLive: '5 minutes',
  })
}

const createEventsAtom = (request: EventsListRequest) =>
  Atom.pull((get) =>
    Stream.paginate(null as string | null, (after) =>
      get
        .result(eventPageAtom(request, after), { suspendOnWaiting: true })
        .pipe(
          Effect.map(
            (
              response
            ): readonly [
              readonly ListActivitiesResponse[],
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

type EventsPullResult =
  ReturnType<typeof createEventsAtom> extends Atom.Writable<infer Result, void>
    ? Result
    : never

const disabledEventsAtom = Atom.writable<EventsPullResult, void>(
  () => AsyncResult.initial(),
  () => undefined
)

type EventsFamilyInput = EventsListRequest & { readonly enabled: boolean }

export const eventsAtom = Atom.family((input: EventsFamilyInput) => {
  const { enabled, ...request } = input
  return enabled ? createEventsAtom(request) : disabledEventsAtom
})

export const refreshEventLists = RegistryClient.runtime.fn(() =>
  Reactivity.invalidate([activityListsReactivityKey])
)
