import { afterEach, describe, expect, mock, test } from 'bun:test'
import {
  act,
  cleanup,
  fireEvent,
  waitFor,
  within,
} from '@testing-library/react'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import { BrowserRouter } from 'react-router'

import { HeaderActionsProvider } from '../../../shell/header-actions'
import { renderWithRegistry } from '../../../test/render-with-registry'
import {
  EVENTS_SAVED_VIEWS_SCHEMA_VERSION,
  persistEventsSavedViews,
} from '../../components/saved-views'
import { EventsPage } from './render'

const originalFetch = globalThis.fetch

const flushUpdates = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
  document
    .querySelectorAll('[data-events-test-header-actions]')
    .forEach((target) => {
      target.remove()
    })
})

const renderEventsPage = (path: string) => {
  window.history.replaceState(null, '', path)
  const headerTarget = document.createElement('div')
  headerTarget.dataset.eventsTestHeaderActions = ''
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

const raceSafeEvent = {
  id: 'event-race-safe',
  applicationId: 'application-1',
  canonicalUrl: 'https://example.test/jobs/one',
  company: 'Race-safe result',
  role: 'Staff Engineer',
  kind: 'stage_changed',
  revision: 42,
  occurredAt: '2026-07-15T09:30:00.000Z',
  recordedAt: '2026-07-15T09:31:00.000Z',
  deviceId: 'device-1',
  operationId: 'operation-1',
  payload: {},
}

describe('EventsPage', () => {
  test.each([
    {
      label: 'malformed',
      path: '/events?filters=not-json',
      expectedValues: ['not-json'],
    },
    {
      label: 'duplicate',
      path: '/events?filters=%5B%5D&filters=%5B%5D',
      expectedValues: ['[]', '[]'],
    },
  ])('blocks list requests for $label canonical filter parameters', async ({
    path,
    expectedValues,
  }) => {
    const requests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      requests.push(String(input))
      return Response.json(emptyPage)
    }) as unknown as typeof fetch

    const view = renderEventsPage(path)

    expect(
      await view.findByText('Invalid filters URL; the table request is blocked')
    ).toBeTruthy()
    await flushUpdates()
    expect(requests).toEqual([])
    expect(view.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(
      (
        view.getByRole('button', {
          name: 'Refresh events',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(
      new URLSearchParams(window.location.search).getAll('filters')
    ).toEqual([...expectedValues])
  })

  test('forwards a canonical OR group without changing its URL value', async () => {
    const requests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      requests.push(String(input))
      return Response.json(emptyPage)
    }) as unknown as typeof fetch
    const filters = [
      {
        type: 'group',
        combinator: 'or',
        children: [
          {
            type: 'condition',
            field: 'kind',
            operator: 'eq',
            value: 'submitted',
          },
          {
            type: 'condition',
            field: 'revision',
            operator: 'gte',
            value: 20,
          },
        ],
      },
    ]
    const search = new URLSearchParams({ filters: JSON.stringify(filters) })

    renderEventsPage(`/events?${search.toString()}`)

    await waitFor(() => expect(requests).toHaveLength(1))
    const request = new URL(requests[0] ?? '', 'https://registry.test')
    expect(JSON.parse(request.searchParams.get('filters') ?? '[]')).toEqual(
      filters
    )
    const browserFilters = new URLSearchParams(window.location.search).get(
      'filters'
    )
    expect(browserFilters).toBe(request.searchParams.get('filters'))
    await flushUpdates()
    expect(requests).toHaveLength(1)
  })

  test('preserves nested canonical filters until explicit replacement', async () => {
    const nestedFilters = [
      {
        type: 'group',
        combinator: 'not',
        children: [
          {
            type: 'condition',
            field: 'kind',
            operator: 'eq',
            value: 'submitted',
          },
        ],
      },
    ]
    const requests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      requests.push(String(input))
      return Response.json(emptyPage)
    }) as unknown as typeof fetch
    const search = new URLSearchParams({
      filters: JSON.stringify(nestedFilters),
    })

    const view = renderEventsPage(`/events?${search.toString()}`)

    await waitFor(() => expect(requests).toHaveLength(1))
    const filteredRequest = new URL(requests[0] ?? '', 'https://registry.test')
    expect(filteredRequest.searchParams.get('filters')).toBe(
      JSON.stringify(nestedFilters)
    )
    expect(view.queryByRole('button', { name: /^Show filters/ })).toBeNull()

    fireEvent.click(view.getByRole('button', { name: 'Replace URL filters' }))
    await waitFor(() => expect(requests).toHaveLength(2))
    expect(
      new URL(requests[1] ?? '', 'https://registry.test').searchParams.has(
        'filters'
      )
    ).toBe(false)
    expect(new URLSearchParams(window.location.search).has('filters')).toBe(
      false
    )
  })

  test('blocks a definition-invalid canonical filter', async () => {
    const requests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      requests.push(String(input))
      return Response.json(emptyPage)
    }) as unknown as typeof fetch
    const filters = JSON.stringify([
      {
        type: 'condition',
        field: 'kind',
        operator: 'eq',
        value: 'not_an_event',
      },
    ])
    const view = renderEventsPage(
      `/events?${new URLSearchParams({ filters }).toString()}`
    )

    expect(
      await view.findByText('Invalid filters URL; the table request is blocked')
    ).toBeTruthy()
    await flushUpdates()
    expect(requests).toEqual([])
  })

  test('keeps the last valid filter applied while an edited value is incomplete', async () => {
    const requests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      requests.push(String(input))
      return Response.json(emptyPage)
    }) as unknown as typeof fetch
    const filters = JSON.stringify([
      {
        type: 'condition',
        field: 'revision',
        operator: 'gte',
        value: 20,
      },
    ])
    const view = renderEventsPage(
      `/events?${new URLSearchParams({ filters }).toString()}`
    )

    await waitFor(() => expect(requests).toHaveLength(1))
    const appliedFilter = new URLSearchParams(window.location.search).get(
      'filters'
    )
    fireEvent.click(view.getByRole('button', { name: /^Show filters/ }))
    const valueInput = view.getByLabelText('Registry revision value')
    fireEvent.change(valueInput, { target: { value: '' } })
    fireEvent.blur(valueInput)

    expect(await view.findByText(/before applying changes/)).toBeTruthy()
    await flushUpdates()
    expect(requests).toHaveLength(1)
    expect(new URLSearchParams(window.location.search).get('filters')).toBe(
      appliedFilter
    )
  })

  test('changes server ordering with exactly one follow-up request', async () => {
    const requests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      requests.push(String(input))
      return Response.json(emptyPage)
    }) as unknown as typeof fetch
    const view = renderEventsPage('/events')

    await waitFor(() => expect(requests).toHaveLength(1))
    requests.length = 0
    fireEvent.click(view.getByRole('button', { name: /^Occurred/ }))

    await waitFor(() => expect(requests).toHaveLength(1))
    await flushUpdates()
    expect(requests).toHaveLength(1)
    const request = new URL(requests[0] ?? '', 'https://registry.test')
    const orderBy = JSON.parse(
      request.searchParams.get('orderBy') ?? '[]'
    ) as readonly { readonly field: string; readonly direction: string }[]
    expect(orderBy[0]?.field).toBe('occurredAt')
  })

  test('ignores an older request that resolves after a sorting change', async () => {
    let resolveFirst: ((response: Response) => void) | undefined
    let requestCount = 0
    globalThis.fetch = mock(() => {
      requestCount += 1
      if (requestCount === 1) {
        return new Promise<Response>((resolve) => {
          resolveFirst = resolve
        })
      }
      return Promise.resolve(
        Response.json({
          ...emptyPage,
          items: [raceSafeEvent],
        })
      )
    }) as unknown as typeof fetch
    const view = renderEventsPage('/events')

    await waitFor(() => expect(requestCount).toBe(1))
    fireEvent.click(view.getByRole('button', { name: /^Occurred/ }))
    expect(await view.findByText('Race-safe result')).toBeTruthy()

    await act(async () => {
      resolveFirst?.(Response.json(emptyPage))
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(view.getByText('Race-safe result')).toBeTruthy()
    expect(requestCount).toBe(2)
  })

  test('adds a secondary event ordering with shift-click', async () => {
    const requests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      requests.push(String(input))
      return Response.json(emptyPage)
    }) as unknown as typeof fetch
    const view = renderEventsPage('/events')

    await waitFor(() => expect(requests).toHaveLength(1))
    requests.length = 0
    fireEvent.click(view.getByRole('button', { name: /^Occurred/ }))
    await waitFor(() => expect(requests).toHaveLength(1))
    fireEvent.click(view.getByRole('button', { name: /^Recorded/ }), {
      shiftKey: true,
    })

    await waitFor(() => expect(requests).toHaveLength(2))
    const request = new URL(requests[1] ?? '', 'https://registry.test')
    expect(JSON.parse(request.searchParams.get('orderBy') ?? '[]')).toEqual([
      { field: 'occurredAt', direction: 'desc' },
      { field: 'recordedAt', direction: 'desc' },
    ])
    await waitFor(() =>
      expect(new URLSearchParams(window.location.search).get('sort')).toBe(
        'occurredAt:desc,recordedAt:desc'
      )
    )
    expect(view.getByText('Sort priority 1')).toBeTruthy()
    expect(view.getByText('Sort priority 2')).toBeTruthy()
  })

  test('applies one saved view across URL filters, sorting, columns, and density', async () => {
    const requests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      requests.push(String(input))
      return Response.json(emptyPage)
    }) as unknown as typeof fetch
    persistEventsSavedViews(window.localStorage, [
      {
        id: 'stage-audit',
        name: 'Stage audit',
        state: {
          filters: [
            {
              type: 'condition',
              field: 'kind',
              operator: 'eq',
              value: 'stage_changed',
            },
            {
              type: 'condition',
              field: 'revision',
              operator: 'gte',
              value: 20,
            },
          ],
          sorting: [{ id: 'occurredAt', desc: false }],
          columnVisibility: { deviceId: false },
          density: 'compact',
        },
        createdAt: '2026-07-16T10:00:00.000Z',
        updatedAt: '2026-07-16T10:00:00.000Z',
      },
    ])
    expect(
      JSON.parse(
        window.localStorage.getItem(
          `@cv/application-registry/events/saved-views@${EVENTS_SAVED_VIEWS_SCHEMA_VERSION}`
        ) ?? '{}'
      ).schemaVersion
    ).toBe(EVENTS_SAVED_VIEWS_SCHEMA_VERSION)

    const view = renderEventsPage('/events')
    await waitFor(() => expect(requests).toHaveLength(1))

    const topbar = within(view.headerTarget)
    expect(topbar.getAllByRole('button', { name: /^View/ })).toHaveLength(1)
    fireEvent.click(topbar.getByRole('button', { name: /^View/ }))
    fireEvent.click(
      await within(document.body).findByRole('button', {
        name: 'Apply Stage audit',
      })
    )

    await waitFor(() => expect(requests).toHaveLength(2))
    await flushUpdates()
    expect(requests).toHaveLength(2)
    expect(
      JSON.parse(
        new URLSearchParams(window.location.search).get('filters') ?? '[]'
      )
    ).toEqual([
      {
        type: 'condition',
        field: 'kind',
        operator: 'eq',
        value: 'stage_changed',
      },
      {
        type: 'condition',
        field: 'revision',
        operator: 'gte',
        value: 20,
      },
    ])
    expect(new URLSearchParams(window.location.search).get('sort')).toBe(
      'occurredAt:asc'
    )

    const request = new URL(requests[1] ?? '', 'https://registry.test')
    expect(new URLSearchParams(window.location.search).get('filters')).toBe(
      request.searchParams.get('filters')
    )
    expect(JSON.parse(request.searchParams.get('filters') ?? '[]')).toEqual([
      {
        type: 'condition',
        field: 'kind',
        operator: 'eq',
        value: 'stage_changed',
      },
      {
        type: 'condition',
        field: 'revision',
        operator: 'gte',
        value: 20,
      },
    ])
    expect(JSON.parse(request.searchParams.get('orderBy') ?? '[]')).toEqual([
      { field: 'occurredAt', direction: 'asc' },
    ])
    expect(view.getAllByRole('columnheader')).toHaveLength(8)

    fireEvent.click(topbar.getByRole('button', { name: /^View/ }))
    expect(
      within(document.body)
        .getByRole('button', { name: 'Compact' })
        .getAttribute('aria-pressed')
    ).toBe('true')
    fireEvent.click(topbar.getByRole('button', { name: /^View/ }))
  })
})
