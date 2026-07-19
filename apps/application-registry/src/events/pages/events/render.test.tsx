import { afterEach, describe, expect, mock, test } from 'bun:test'
import { act, cleanup, waitFor } from '@testing-library/react'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import { BrowserRouter } from 'react-router'

import { HeaderActionsProvider } from '../../../shell/header-actions'
import { renderWithRegistry } from '../../../test/render-with-registry'
import { EventsPage } from './render'

const originalFetch = globalThis.fetch

const emptyPage = {
  items: [],
  pageInfo: {
    kind: 'cursor',
    size: 50,
    hasNextPage: false,
    hasPreviousPage: false,
    nextCursor: null,
  },
}

const activity = {
  id: 'activity-1',
  applicationId: '00000000-0000-4000-8000-000000000001',
  postingUrl: 'https://example.test/jobs/platform',
  company: 'Example Company',
  role: 'Platform Engineer',
  kind: 'status_changed',
  actor: 'system',
  source: 'management',
  revision: 42,
  occurredAt: '2026-07-15T09:30:00.000Z',
  payload: { from: 'preparing', to: 'applied' },
}

const renderActivitiesPage = (path: string) => {
  window.history.replaceState(null, '', path)
  const headerTarget = document.createElement('div')
  document.body.append(headerTarget)
  const result = renderWithRegistry(
    <BrowserRouter>
      <NuqsAdapter>
        <HeaderActionsProvider target={headerTarget}>
          <EventsPage />
        </HeaderActionsProvider>
      </NuqsAdapter>
    </BrowserRouter>
  )
  return Object.assign(result, { headerTarget })
}

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
})

describe('ActivitiesPage', () => {
  test('blocks requests when drizzle-query filters are malformed', async () => {
    const fetchMock = mock(() => Promise.resolve(Response.json(emptyPage)))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const view = renderActivitiesPage('/activities?filters=not-json')

    expect(
      await view.findByText('Invalid filters URL; the table request is blocked')
    ).toBeTruthy()
    await act(async () => undefined)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(
      (
        view.getByRole('button', {
          name: 'Refresh activities',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
  })

  test('forwards canonical drizzle-query filters unchanged', async () => {
    const requests: Request[] = []
    globalThis.fetch = mock(
      async (input: string | URL | Request, init?: RequestInit) => {
        const request =
          input instanceof Request ? input : new Request(input, init)
        requests.push(request.clone())
        return Response.json(emptyPage)
      }
    ) as unknown as typeof fetch
    const filters = [
      {
        type: 'condition',
        field: 'kind',
        operator: 'eq',
        value: 'status_changed',
      },
    ]
    const serialized = JSON.stringify(filters)

    renderActivitiesPage(
      `/activities?${new URLSearchParams({ filters: serialized }).toString()}`
    )

    await waitFor(() => expect(requests).toHaveLength(1))
    const requested = new URL(requests[0]?.url ?? '')
    expect(requested.pathname).toBe('/api/registry/activities')
    expect(requested.searchParams.get('filters')).toBe(serialized)
    expect(new URLSearchParams(window.location.search).get('filters')).toBe(
      serialized
    )
  })

  test('renders backend-issued activity annotations', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(Response.json({ ...emptyPage, items: [activity] }))
    ) as unknown as typeof fetch

    const view = renderActivitiesPage('/activities')

    expect(await view.findByText('Example Company')).toBeTruthy()
    expect(view.getByText('Platform Engineer')).toBeTruthy()
    expect(view.getByText('Status changed')).toBeTruthy()
    expect(view.getByText('From: preparing · To: applied')).toBeTruthy()
    expect(
      view.getByRole('link', {
        name: 'Open Example Company, Platform Engineer',
      })
    ).toBeTruthy()
  })
})
