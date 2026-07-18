import type { AiModel } from '@cv/ai-provider'
import * as React from 'react'

import { discoverChatGptModels } from './ai'
import {
  type ContentEntry,
  captureJobPostingSnapshot,
  ensureContentEntry,
  loadPreparationContext,
  type PreparationContext,
  readContentHead,
  type SavedContentRevision,
  startApplicationPreparation,
} from './api'

type AsyncState<Value> =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly message: string }
  | { readonly status: 'ready'; readonly value: Value }

type PreparationBootstrap = AsyncState<{
  readonly context: PreparationContext
  readonly entry: ContentEntry
  readonly head: SavedContentRevision | null
}> & {
  readonly reloadPreparationContext: () => void
  readonly refreshJobSnapshot: () => void
  readonly snapshotRefreshPending: boolean
}

export const messageFromCause = (cause: unknown, fallback: string): string =>
  cause instanceof Error ? cause.message : fallback

export const usePreparationBootstrap = (
  applicationId: string,
  locale: string,
  kind: 'cv' | 'cover_letter'
): PreparationBootstrap => {
  const [state, setState] = React.useState<
    AsyncState<{
      readonly context: PreparationContext
      readonly entry: ContentEntry
      readonly head: SavedContentRevision | null
    }>
  >({ status: 'loading' })
  const [reloadKey, setReloadKey] = React.useState(0)
  const [snapshotRefreshPending, setSnapshotRefreshPending] =
    React.useState(false)
  const forceCapture = React.useRef(false)

  const refreshJobSnapshot = React.useCallback(() => {
    forceCapture.current = true
    setSnapshotRefreshPending(true)
    setReloadKey((current) => current + 1)
  }, [])

  const reloadPreparationContext = React.useCallback(() => {
    setReloadKey((current) => current + 1)
  }, [])

  React.useEffect(() => {
    let active = true
    const shouldCapture = reloadKey > 0 && forceCapture.current
    forceCapture.current = false
    setState({ status: 'loading' })
    startApplicationPreparation(applicationId)
      .then(() =>
        shouldCapture
          ? captureJobPostingSnapshot(applicationId)
          : Promise.resolve(null)
      )
      .then(() =>
        Promise.all([
          loadPreparationContext(applicationId, locale),
          ensureContentEntry(applicationId, kind, locale),
        ])
      )
      .then(async ([context, entry]) => ({
        context,
        entry,
        head: await readContentHead(applicationId, entry),
      }))
      .then((value) => {
        if (active) {
          setSnapshotRefreshPending(false)
          setState({ status: 'ready', value })
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setSnapshotRefreshPending(false)
          setState({
            status: 'error',
            message: messageFromCause(
              cause,
              'The preparation context could not be loaded.'
            ),
          })
        }
      })

    return () => {
      active = false
    }
  }, [applicationId, kind, locale, reloadKey])

  return {
    ...state,
    reloadPreparationContext,
    refreshJobSnapshot,
    snapshotRefreshPending,
  }
}

export const useChatGptModels = (
  authenticated: boolean
): AsyncState<ReadonlyArray<AiModel>> => {
  const [state, setState] = React.useState<AsyncState<ReadonlyArray<AiModel>>>({
    status: 'loading',
  })

  React.useEffect(() => {
    if (!authenticated) {
      setState({ status: 'loading' })
      return
    }
    const controller = new AbortController()
    setState({ status: 'loading' })
    discoverChatGptModels(controller.signal)
      .then((models) => setState({ status: 'ready', value: models }))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            message: messageFromCause(
              cause,
              'ChatGPT models could not be loaded.'
            ),
          })
        }
      })

    return () => controller.abort()
  }, [authenticated])

  return state
}
