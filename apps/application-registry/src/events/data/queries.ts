import type {
  ListEventsQuery,
  ListEventsResponse,
} from '@cv/application-registry-api-contract'
import { Effect, Option, Stream } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as Reactivity from 'effect/unstable/reactivity/Reactivity'
import { uniqBy } from 'es-toolkit'

import { RegistryClient } from '../../lib/registry-client'
import { eventListsReactivityKey } from './keys'

export type EventsListRequest = Omit<ListEventsQuery, 'pagination'> & {
  readonly size: number
}

const eventPageAtom = (request: EventsListRequest, after: string | null) => {
  const { size, ...query } = request
  return RegistryClient.query('registry', 'listEvents', {
    query: {
      ...query,
      pagination: { size, ...(after === null ? {} : { after }) },
    },
    reactivityKeys: [eventListsReactivityKey],
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
              readonly ListEventsResponse[],
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

const pendingEventRequests = new Map<string, EventsFamilyInput>()
const eventsFamily = Atom.family((key: string) => {
  const input = pendingEventRequests.get(key)
  if (input === undefined) {
    throw new Error(`Missing events atom input for key ${key}.`)
  }
  const { enabled, ...request } = input
  return enabled ? createEventsAtom(request) : disabledEventsAtom
})

/** Keeps semantically equal URL requests on one atom subscription. */
export const eventsAtom = (input: EventsFamilyInput) => {
  const key = JSON.stringify(input)
  pendingEventRequests.set(key, input)
  try {
    return eventsFamily(key)
  } finally {
    pendingEventRequests.delete(key)
  }
}

export const refreshEventLists = RegistryClient.runtime.fn(() =>
  Reactivity.invalidate([eventListsReactivityKey])
)
