import { afterEach, describe, expect, mock, test } from 'bun:test'
import type {
  DesktopBridgeResult,
  DesktopCodexBridge,
  DesktopDocumentAssistantRequest,
  DesktopDocumentAssistantResult,
  DesktopHostBridge,
} from '@cv/application-registry-desktop-contract'
import { useAtomSet, useAtomValue } from '@effect/atom-react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import * as AsyncResult from 'effect/unstable/reactivity/AsyncResult'
import type * as React from 'react'

import { TestRegistryProvider } from '../../test/render-with-registry'
import { DocumentAssistantProvider, useDocumentAssistant } from './assistant'
import { DocumentStudioProvider, useDocumentStudioAtoms } from './react'
import { initialCoverLetterDocument } from './session'

type Deferred<A> = {
  readonly promise: Promise<A>
  readonly resolve: (value: A) => void
}

const deferred = <A,>(): Deferred<A> => {
  let complete: ((value: A) => void) | undefined
  const promise = new Promise<A>((resolve) => {
    complete = resolve
  })
  return {
    promise,
    resolve: (value) => {
      if (complete === undefined) {
        throw new Error('Deferred resolver was not initialized.')
      }
      complete(value)
    },
  }
}

const assistantSuccess = (
  request: DesktopDocumentAssistantRequest,
  {
    patches = [],
    reply = 'Done.',
    threadId = 'thread-1',
  }: {
    readonly patches?: DesktopDocumentAssistantResult['response']['patches']
    readonly reply?: string
    readonly threadId?: string
  } = {}
): DesktopBridgeResult<DesktopDocumentAssistantResult> => ({
  ok: true,
  value: {
    checkpointId: request.checkpointId,
    operationId: request.operationId,
    response: { patches, reply },
    threadId,
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
  },
})

const unavailable = {
  error: {
    code: 'network_failed' as const,
    message: 'Unavailable in this test.',
  },
  ok: false as const,
}

const installBridge = (assistImplementation: DesktopCodexBridge['assist']) => {
  const assist = mock(assistImplementation)
  const cancel = mock(async (_operationId: string) => ({
    ok: true as const,
    value: undefined,
  }))
  const status = mock(async () => ({
    ok: true as const,
    value: {
      available: true,
      executable: null,
      message: 'Codex is available.',
    },
  }))
  const bridge = {
    codex: {
      assist,
      cancel,
      generate: async () => unavailable,
      status,
    },
    network: { fetch: async () => unavailable },
    registry: {
      configure: async () => unavailable,
      status: async () => unavailable,
    },
  } satisfies DesktopHostBridge
  Object.defineProperty(window, 'cvDesktop', {
    configurable: true,
    value: bridge,
  })
  return { assist, cancel, status }
}

const studioInput = {
  authoritativeKey: 'job-1:cover-letter:revision-1',
  document: {
    ...initialCoverLetterDocument('en', 'cv-revision-1'),
    body: 'Original draft.',
  },
  identity: {
    applicationId: 'application-1',
    kind: 'cover_letter',
    locale: 'en',
    referenceCvRevisionId: 'cv-revision-1',
  },
} as const

const Providers = ({ children }: { readonly children?: React.ReactNode }) => (
  <TestRegistryProvider>
    <DocumentStudioProvider value={studioInput}>
      <DocumentAssistantProvider
        assistantKey="job-1:cover-letter:revision-1:posting-1"
        context={{ jobPosting: 'Effect TypeScript engineer' }}
      >
        {children}
      </DocumentAssistantProvider>
    </DocumentStudioProvider>
  </TestRegistryProvider>
)

const useAssistantProbe = () => {
  const assistant = useDocumentAssistant()
  const studio = useDocumentStudioAtoms()
  const state = useAtomValue(studio)
  const edit = useAtomSet(studio.edit, { mode: 'promise' })
  return { assistant, edit, state }
}

afterEach(() => {
  cleanup()
  Object.defineProperty(window, 'cvDesktop', {
    configurable: true,
    value: undefined,
  })
})

describe('scoped Document Assistant atoms', () => {
  test('keeps read-only assessment context out of the editing conversation', async () => {
    const requests: Array<DesktopDocumentAssistantRequest> = []
    const { assist, status } = installBridge(async (request) => {
      requests.push(request)
      return requests.length === 1
        ? assistantSuccess(request, {
            patches: [
              {
                op: 'replace',
                path: ['body'],
                value: 'Assessment must not edit this.',
              },
            ],
            reply:
              'Strong Effect experience; the current draft does not yet connect it to the role.',
            threadId: 'assessment-thread',
          })
        : assistantSuccess(request, {
            patches: [
              {
                op: 'replace',
                path: ['body'],
                value: 'Tailored Effect draft.',
              },
            ],
            reply: 'I connected the evidence to the role.',
            threadId: 'editing-thread',
          })
    })
    const hook = renderHook(useAssistantProbe, { wrapper: Providers })

    await waitFor(() => expect(status).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(hook.result.current.assistant.messages).toHaveLength(1)
    )

    expect(assist).toHaveBeenCalledTimes(1)
    expect(requests[0]?.threadId).toBeUndefined()
    expect(requests[0]?.prompt).toContain('Assess this draft')
    expect(requests[0]?.instructions).toContain('Return an empty patches array')
    expect(
      AsyncResult.isSuccess(hook.result.current.state) &&
        hook.result.current.state.value.document
    ).toMatchObject({ body: 'Original draft.' })

    act(() => {
      hook.result.current.assistant.onComposerChange(
        'Connect my Effect evidence to the role'
      )
    })
    expect(hook.result.current.assistant.composer).toBe(
      'Connect my Effect evidence to the role'
    )

    await act(async () => {
      await hook.result.current.assistant.onSubmitComposer()
    })

    expect(requests[1]?.threadId).toBeUndefined()
    expect(hook.result.current.assistant.composer).toBe('')
    expect(
      hook.result.current.assistant.messages.map(({ content }) => content)
    ).toEqual([
      'Strong Effect experience; the current draft does not yet connect it to the role.',
      'Connect my Effect evidence to the role',
      'I connected the evidence to the role.',
    ])
    expect(
      AsyncResult.isSuccess(hook.result.current.state) &&
        hook.result.current.state.value.document
    ).toMatchObject({ body: 'Tailored Effect draft.' })
  })

  test('keeps a newer human edit and marks a stale assistant patch batch', async () => {
    const response =
      deferred<DesktopBridgeResult<DesktopDocumentAssistantResult>>()
    const requests: Array<DesktopDocumentAssistantRequest> = []
    installBridge(async (request) => {
      requests.push(request)
      if (requests.length === 1) {
        return assistantSuccess(request, {
          reply: 'Initial assessment.',
          threadId: 'thread-stale',
        })
      }
      return response.promise
    })
    const hook = renderHook(useAssistantProbe, { wrapper: Providers })
    await waitFor(() =>
      expect(hook.result.current.assistant.messages).toHaveLength(1)
    )

    let send = Promise.resolve()
    act(() => {
      send = Promise.resolve(
        hook.result.current.assistant.onSend('Rewrite the opening')
      )
    })
    await waitFor(() => expect(requests).toHaveLength(2))

    await act(async () => {
      await hook.result.current.edit({
        path: ['body'],
        value: 'A newer human edit.',
      })
    })
    await act(async () => {
      response.resolve(
        assistantSuccess(requests[1], {
          patches: [
            {
              op: 'replace',
              path: ['body'],
              value: 'Stale assistant edit.',
            },
          ],
          reply: 'Rewritten.',
          threadId: 'thread-stale',
        })
      )
      await send
    })

    expect(
      AsyncResult.isSuccess(hook.result.current.state) &&
        hook.result.current.state.value.document
    ).toMatchObject({ body: 'A newer human edit.' })
    expect(
      hook.result.current.assistant.messages.map(({ status }) => status)
    ).toEqual(['applied', 'stale', 'stale'])
  })

  test('suppresses a duplicate send while the active turn is pending', async () => {
    const response =
      deferred<DesktopBridgeResult<DesktopDocumentAssistantResult>>()
    const requests: Array<DesktopDocumentAssistantRequest> = []
    installBridge(async (request) => {
      requests.push(request)
      if (requests.length === 1) {
        return assistantSuccess(request, {
          reply: 'Initial assessment.',
          threadId: 'thread-single-flight',
        })
      }
      return response.promise
    })
    const hook = renderHook(useAssistantProbe, { wrapper: Providers })
    await waitFor(() =>
      expect(hook.result.current.assistant.messages).toHaveLength(1)
    )

    let first = Promise.resolve()
    let duplicate = Promise.resolve()
    act(() => {
      first = hook.result.current.assistant.onSend('First request')
      duplicate = hook.result.current.assistant.onSend('Duplicate request')
    })
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(requests[1]?.prompt).toBe('First request')

    await act(async () => {
      response.resolve(
        assistantSuccess(requests[1], {
          reply: 'Completed once.',
          threadId: 'thread-single-flight',
        })
      )
      await Promise.all([first, duplicate])
    })

    expect(requests).toHaveLength(2)
    expect(
      hook.result.current.assistant.messages.map(({ content }) => content)
    ).toEqual(['Initial assessment.', 'First request', 'Completed once.'])
  })

  test('cancels active desktop work when the scoped action unmounts', async () => {
    const response =
      deferred<DesktopBridgeResult<DesktopDocumentAssistantResult>>()
    const requests: Array<DesktopDocumentAssistantRequest> = []
    const { cancel } = installBridge(async (request) => {
      requests.push(request)
      if (requests.length === 1) {
        return assistantSuccess(request, {
          reply: 'Initial assessment.',
          threadId: 'thread-cancel',
        })
      }
      return response.promise
    })
    const hook = renderHook(useAssistantProbe, { wrapper: Providers })
    await waitFor(() =>
      expect(hook.result.current.assistant.messages).toHaveLength(1)
    )

    act(() => {
      void hook.result.current.assistant.onSend('Long-running change')
    })
    await waitFor(() => expect(requests).toHaveLength(2))

    hook.unmount()

    await waitFor(() =>
      expect(cancel).toHaveBeenCalledWith(requests[1]?.operationId)
    )
  })
})
