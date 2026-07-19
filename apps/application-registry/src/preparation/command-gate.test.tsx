import { afterEach, describe, expect, test } from 'bun:test'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

import { TestRegistryProvider } from '../test/render-with-registry'
import { usePreparationCommandGate } from './command-gate'
import type { PreparationEditorIdentity } from './editor'

const identity: PreparationEditorIdentity = {
  applicationId: 'application-1',
  kind: 'cover_letter',
  locale: 'en',
}

afterEach(cleanup)

describe('preparation command gate', () => {
  test('atomically rejects a second claim before React rerenders', async () => {
    const hook = renderHook(() => usePreparationCommandGate(identity), {
      wrapper: TestRegistryProvider,
    })
    let firstClaim = false
    let secondClaim = true

    act(() => {
      firstClaim = hook.result.current.claim()
      secondClaim = hook.result.current.claim()
    })

    expect(firstClaim).toBe(true)
    expect(secondClaim).toBe(false)
    await waitFor(() => expect(hook.result.current.executing).toBe(true))

    act(() => hook.result.current.release())
    await waitFor(() => expect(hook.result.current.executing).toBe(false))
  })

  test('isolates started state by application and locale identity', async () => {
    const hook = renderHook(
      ({ currentIdentity }: { currentIdentity: PreparationEditorIdentity }) =>
        usePreparationCommandGate(currentIdentity),
      {
        initialProps: { currentIdentity: identity },
        wrapper: TestRegistryProvider,
      }
    )

    act(() => {
      expect(hook.result.current.claim()).toBe(true)
      hook.result.current.release()
    })
    await waitFor(() => expect(hook.result.current.hasStarted).toBe(true))

    hook.rerender({
      currentIdentity: { ...identity, applicationId: 'application-2' },
    })

    expect(hook.result.current.executing).toBe(false)
    expect(hook.result.current.hasStarted).toBe(false)
  })
})
