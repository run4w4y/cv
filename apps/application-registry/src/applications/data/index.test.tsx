import { afterEach, describe, expect, mock, test } from 'bun:test'
import type {
  UpdateApplicationRequest,
  UpdateApplicationResponse,
} from '@cv/application-registry-api-contract'
import type { Application } from '@cv/application-registry-entity'
import { useAtom, useAtomValue } from '@effect/atom-react'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { PropsWithChildren } from 'react'

import { TestRegistryProvider } from '../../test/render-with-registry'
import { applicationAtom, updateManagedApplication } from '.'

const originalFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
})

const application: Application = {
  applicationStatus: 'not_started',
  appliedAt: null,
  postingUrl: 'https://example.test/jobs/one',
  company: 'Example',
  createdAt: '2026-07-16T09:00:00.000Z',
  followUpAt: null,
  id: 'application-1',
  listingAvailability: 'open',
  listingCheckedAt: '2026-07-16T09:30:00.000Z',
  listingClosedCandidateAt: null,
  listingConfidence: 'high',
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  location: null,
  personalPriority: null,
  role: 'Staff Engineer',
  targetStage: 'apply_next',
  updatedAt: '2026-07-16T09:30:00.000Z',
  updatedRevision: 2,
  version: 2,
}

const input: UpdateApplicationRequest = {
  annualCompensation: {
    currencyCode: 'USD',
    maximumMinor: 16_000_000,
    minimumMinor: 12_000_000,
  },
  applicationStatus: 'preparing',
  expectedVersion: 2,
  labels: ['Remote'],
}

const response: UpdateApplicationResponse = {
  annualCompensation: input.annualCompensation ?? null,
  application: {
    ...application,
    applicationStatus: 'preparing',
    updatedAt: '2026-07-17T09:00:00.000Z',
    updatedRevision: 3,
    version: 3,
  },
  labels: ['Remote'],
}

const wrapper = ({ children }: PropsWithChildren) => (
  <TestRegistryProvider>{children}</TestRegistryProvider>
)

const setup = () =>
  renderHook(
    () => {
      const [, save] = useAtom(updateManagedApplication, {
        mode: 'promise',
      })
      return {
        application: useAtomValue(applicationAtom(application.id)),
        save,
      }
    },
    { wrapper }
  )

describe('application mutation atoms', () => {
  test('uses the generated endpoint and refreshes the mounted detail after success', async () => {
    const requests: Request[] = []
    let patchSucceeded = false
    globalThis.fetch = mock(async (input: string | URL | Request, init) => {
      const request =
        input instanceof Request
          ? input
          : new Request(new URL(String(input), 'http://localhost'), init)
      requests.push(request.clone())
      if (request.method === 'PATCH') {
        patchSucceeded = true
        return Response.json(response)
      }
      return Response.json(patchSucceeded ? response.application : application)
    }) as unknown as typeof fetch
    const hook = setup()

    await waitFor(() =>
      expect(hook.result.current.application._tag).toBe('Success')
    )
    let result: UpdateApplicationResponse | undefined
    await act(async () => {
      result = await hook.result.current.save({
        applicationId: application.id,
        idempotencyKey: 'management-operation-1',
        input,
      })
    })
    await waitFor(() => {
      const current = hook.result.current.application
      expect(current._tag).toBe('Success')
      if (current._tag === 'Success') expect(current.value.version).toBe(3)
    })

    expect(result).toEqual(response)
    const patch = requests.find(({ method }) => method === 'PATCH')
    expect(patch?.url).toEndWith('/api/registry/applications/application-1')
    expect(await patch?.json()).toEqual(input)
    expect(patch?.headers.get('idempotency-key')).toBe('management-operation-1')
    expect(requests.filter(({ method }) => method === 'GET')).toHaveLength(2)
  })

  test('does not refresh the mounted detail when the mutation fails', async () => {
    const requests: Request[] = []
    globalThis.fetch = mock(async (input: string | URL | Request, init) => {
      const request =
        input instanceof Request
          ? input
          : new Request(new URL(String(input), 'http://localhost'), init)
      requests.push(request.clone())
      return request.method === 'PATCH'
        ? Response.json(
            {
              code: 'conflict',
              message: 'The application was updated elsewhere.',
            },
            { status: 409 }
          )
        : Response.json(application)
    }) as unknown as typeof fetch
    const hook = setup()
    await waitFor(() =>
      expect(hook.result.current.application._tag).toBe('Success')
    )

    let error: unknown
    await act(async () => {
      try {
        await hook.result.current.save({
          applicationId: application.id,
          idempotencyKey: 'management-operation-1',
          input,
        })
      } catch (reason) {
        error = reason
      }
    })

    expect(error).toBeInstanceOf(Error)
    if (!(error instanceof Error)) throw new Error('Expected mutation failure')
    expect(error.message).toBe('The application was updated elsewhere.')
    expect(requests.filter(({ method }) => method === 'GET')).toHaveLength(1)
  })
})
