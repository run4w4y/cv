import { Match, Predicate } from 'effect'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'

type UnknownAsyncResult = AsyncResult.AsyncResult<unknown, unknown>

export const expectedErrorMessage = (
  error: unknown,
  fallback: string
): string =>
  Match.value(error).pipe(
    Match.when(Predicate.isError, (error) => error.message.trim() || fallback),
    Match.orElse(() => fallback)
  )

export const asyncResultError = <A, E>(
  result: AsyncResult.AsyncResult<A, E>
): E | undefined =>
  AsyncResult.matchWithError(result, {
    onDefect: () => undefined,
    onError: (error) => error,
    onInitial: () => undefined,
    onSuccess: () => undefined,
  })

export const asyncResultErrorMessage = <A, E>(
  result: AsyncResult.AsyncResult<A, E>,
  fallback: string,
  onError: (error: E) => string = (error) =>
    expectedErrorMessage(error, fallback)
): string | undefined =>
  AsyncResult.matchWithError(result, {
    onDefect: () => fallback,
    onError,
    onInitial: () => undefined,
    onSuccess: () => undefined,
  })

export const firstAsyncResultErrorMessage = (
  entries: ReadonlyArray<{
    readonly fallback: string
    readonly result: UnknownAsyncResult
  }>
): string | null => {
  for (const { fallback, result } of entries) {
    const message = asyncResultErrorMessage(result, fallback)
    if (message !== undefined) return message
  }
  return null
}
