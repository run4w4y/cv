import { useAtom, useAtomSet, useAtomValue } from '@effect/atom-react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import * as React from 'react'

import { asyncResultErrorMessage } from '@/lib/async-result'
import {
  type EventsListRequest,
  eventsAtom,
  refreshEventLists,
} from '../../data'
import type { useEventsWorkspace } from './use-workspace'

type EventsWorkspace = ReturnType<typeof useEventsWorkspace>

export const useEventsList = (workspace: EventsWorkspace) => {
  const requestInput: EventsListRequest = {
    ...workspace.appliedQuery,
    size: 50,
  }
  const requestEnabled = workspace.queryParameterState.status === 'valid'
  const listAtom = eventsAtom({ ...requestInput, enabled: requestEnabled })
  const eventsResult = useAtomValue(listAtom)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [, runRefresh] = useAtom(refreshEventLists, { mode: 'promiseExit' })
  const pullEvents = useAtomSet(listAtom, { mode: 'promiseExit' })
  const page = AsyncResult.getOrElse(eventsResult, () => undefined)
  const events = requestEnabled ? (page?.items ?? []) : []
  const loading = requestEnabled && eventsResult.waiting && page === undefined
  const error =
    workspace.queryParameterState.status === 'invalid'
      ? 'The query URL is malformed, duplicated, or invalid. Correct or remove the filter and sort parameters before loading activities.'
      : asyncResultErrorMessage(
          eventsResult,
          'The activity history could not be loaded.'
        )

  const refresh = () => void runRefresh(undefined)
  const loadMore = async () => {
    if (!requestEnabled || page?.done !== false || eventsResult.waiting) return
    setLoadingMore(true)
    try {
      await pullEvents()
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
    refreshing: eventsResult.waiting && !loadingMore && events.length > 0,
    requestEnabled,
  }
}
