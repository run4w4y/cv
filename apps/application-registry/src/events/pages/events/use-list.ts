import { decodeListEventsSearchParams } from '@cv/application-registry-api-contract'
import { eventListQuery } from '@cv/application-registry-entity/query'
import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as React from 'react'

import {
  eventsAtom,
  type EventsListRequest,
  refreshEventLists,
} from '../../data'
import type { useEventsWorkspace } from './use-workspace'

type EventsWorkspace = ReturnType<typeof useEventsWorkspace>

export const useEventsList = (workspace: EventsWorkspace) => {
  const orderBy = workspace.sorting.flatMap((item) =>
    eventListQuery.fields.flatMap((field) =>
      field.sortable && field.name === item.id
        ? [
            {
              field: field.name,
              direction: item.desc ? ('desc' as const) : ('asc' as const),
            },
          ]
        : []
    )
  ) as NonNullable<EventsListRequest['orderBy']>
  const appliedFilters = (() => {
    if (workspace.filters.decoded.canonicalValue === undefined) return undefined
    const search = new URLSearchParams()
    search.set('filters', workspace.filters.decoded.canonicalValue)
    return decodeListEventsSearchParams(search).filters
  })()
  const requestInput: EventsListRequest = {
    ...(appliedFilters === undefined ? {} : { filters: appliedFilters }),
    orderBy,
    size: 50,
  }
  const requestEnabled =
    workspace.filters.navigationSettled &&
    !workspace.filters.decoded.needsCanonicalWrite &&
    !workspace.filters.decoded.blocksRequest
  const listAtom = eventsAtom({ ...requestInput, enabled: requestEnabled })
  const eventsResult = useAtomValue(listAtom)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [, runRefresh] = useAtom(refreshEventLists, { mode: 'promise' })
  const pullEvents = useAtomSet(listAtom, { mode: 'promise' })
  const page = AsyncResult.getOrElse(eventsResult, () => undefined)
  const events = requestEnabled ? (page?.items ?? []) : []
  const loading = requestEnabled && eventsResult.waiting && page === undefined
  const error = workspace.filters.decoded.blocksRequest
    ? 'The filters URL is malformed, duplicated, or invalid. Correct or remove the filters parameter before loading events.'
    : AsyncResult.matchWithError(eventsResult, {
        onInitial: () => undefined,
        onError: (reason) =>
          reason instanceof Error
            ? reason.message
            : 'The event history could not be loaded.',
        onDefect: (reason) =>
          reason instanceof Error
            ? reason.message
            : 'The event history could not be loaded.',
        onSuccess: () => undefined,
      })

  const refresh = () => void runRefresh(undefined).catch(() => undefined)
  const loadMore = async () => {
    if (!requestEnabled || page?.done !== false || eventsResult.waiting) return
    setLoadingMore(true)
    try {
      await pullEvents()
    } catch {
      // The list AsyncResult owns error presentation.
    } finally {
      setLoadingMore(false)
    }
  }

  return {
    error,
    events,
    hasNextPage: page?.done === false,
    loadMore,
    loading,
    loadingMore,
    refresh,
    refreshDisabled: !requestEnabled || loading || loadingMore,
    refreshing:
      (eventsResult.waiting || workspace.isNavigating) &&
      !loadingMore &&
      events.length > 0,
    requestEnabled,
  }
}
