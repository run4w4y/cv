import { afterEach, describe, expect, test } from 'bun:test'
import { useAtom, useAtomValue } from '@effect/atom-react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { Deferred, Effect } from 'effect'
import * as Atom from 'effect/unstable/reactivity/Atom'

import { TestRegistryProvider } from '../test/render-with-registry'
import { keyedCommandFamily } from './keyed-command'

const commandFamily = keyedCommandFamily('test/keyed-command', () =>
  Atom.fn<string>()((message) => Effect.fail(message))
)

afterEach(cleanup)

describe('keyed command result channels', () => {
  test('does not expose one identity failure through another identity', async () => {
    const first = commandFamily('application-1/cover_letter/en')
    const second = commandFamily('application-2/cover_letter/en')
    const hook = renderHook(
      () => {
        const [firstResult, runFirst] = useAtom(first, { mode: 'promise' })
        return { firstResult, runFirst, secondResult: useAtomValue(second) }
      },
      { wrapper: TestRegistryProvider }
    )

    await act(async () => {
      await hook.result.current.runFirst('application-1 failed').catch(() => {})
    })
    await waitFor(() =>
      expect(hook.result.current.firstResult._tag).toBe('Failure')
    )

    expect(hook.result.current.secondResult._tag).toBe('Initial')
  })

  test('attributes overlapping concurrent executions to their own identities', async () => {
    const firstGate = Effect.runSync(Deferred.make<string>())
    const secondGate = Effect.runSync(Deferred.make<string>())
    const started: Array<string> = []
    const concurrentFamily = keyedCommandFamily(
      'test/keyed-concurrent-command',
      () =>
        Atom.fn<string>()((identity) =>
          Effect.sync(() => started.push(identity)).pipe(
            Effect.andThen(
              Deferred.await(
                identity === 'application-1' ? firstGate : secondGate
              )
            )
          )
        )
    )
    const first = concurrentFamily('application-1/cv/en')
    const second = concurrentFamily('application-2/cv/en')
    const hook = renderHook(
      () => {
        const [firstResult, runFirst] = useAtom(first, { mode: 'promise' })
        const [secondResult, runSecond] = useAtom(second, { mode: 'promise' })
        return { firstResult, runFirst, runSecond, secondResult }
      },
      { wrapper: TestRegistryProvider }
    )
    let firstPromise: Promise<string> | undefined
    let secondPromise: Promise<string> | undefined

    act(() => {
      firstPromise = hook.result.current.runFirst('application-1')
      secondPromise = hook.result.current.runSecond('application-2')
    })
    await waitFor(() =>
      expect(started).toEqual(['application-1', 'application-2'])
    )

    await act(async () => {
      await Effect.runPromise(Deferred.succeed(secondGate, 'second-result'))
      expect(await secondPromise).toBe('second-result')
    })
    await act(async () => {
      await Effect.runPromise(Deferred.succeed(firstGate, 'first-result'))
      expect(await firstPromise).toBe('first-result')
    })
    await waitFor(() => {
      expect(hook.result.current.firstResult).toMatchObject({
        _tag: 'Success',
        value: 'first-result',
      })
      expect(hook.result.current.secondResult).toMatchObject({
        _tag: 'Success',
        value: 'second-result',
      })
    })
  })
})
