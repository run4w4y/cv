import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'

import { messageFromCause } from './errors'

export const asyncResultFailureMessage = <A, E>(
  result: AsyncResult.AsyncResult<A, E>,
  fallback: string
): string | null =>
  AsyncResult.matchWithError(result, {
    onInitial: () => null,
    onError: (error) => messageFromCause(error, fallback),
    onDefect: (defect) => messageFromCause(defect, fallback),
    onSuccess: () => null,
  })

export const anyAsyncResultWaiting = (
  ...results: ReadonlyArray<AsyncResult.AsyncResult<unknown, unknown>>
): boolean => results.some(AsyncResult.isWaiting)
