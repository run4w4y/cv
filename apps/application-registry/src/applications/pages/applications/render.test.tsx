import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { ApplicationListItem } from '@cv/application-registry-api-contract'
import { cleanup, fireEvent, waitFor } from '@testing-library/react'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import { BrowserRouter } from 'react-router'
import { renderWithRegistry } from '../../../test/render-with-registry'
import {
  type ApplicationSavedViewState,
  persistApplicationSavedViews,
  persistApplicationWorkspaceState,
} from '../../components/saved-views'
import { ApplicationsPage } from './render'

const originalFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
  window.history.replaceState(null, '', '/')
  window.localStorage.clear()
})

const renderApplicationsPage = (path: string) => {
  window.history.replaceState(null, '', path)
  return renderWithRegistry(
    <BrowserRouter>
      <NuqsAdapter>
        <ApplicationsPage />
      </NuqsAdapter>
    </BrowserRouter>
  )
}

const application: ApplicationListItem = {
  id: 'application-1',
  jobKey: 'web:one',
  source: 'web',
  sourceJobId: 'one',
  canonicalUrl: 'https://example.test/jobs/one',
  company: 'Example',
  role: 'Staff Engineer',
  location: 'Remote',
  applicationStatus: 'not_started',
  targetStage: 'apply_next',
  personalPriority: 'high',
  followUpAt: null,
  appliedAt: null,
  lastContactAt: null,
  listingAvailability: 'open',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  version: 1,
  updatedRevision: 1,
  createdAt: '2026-07-01T09:30:00.000Z',
  updatedAt: '2026-07-16T09:30:00.000Z',
  annualCompensation: null,
  counts: { captures: 0, notes: 0 },
  identityAliases: [],
  labels: [],
  latestCapture: null,
  latestEvent: null,
}

describe('ApplicationsPage', () => {
  test('loads applications without waiting for facets', async () => {
    let resolveFacets: ((response: Response) => void) | undefined
    const facetsResponse = new Promise<Response>((resolve) => {
      resolveFacets = resolve
    })
    let listRequests = 0
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/facets')) return facetsResponse
      listRequests += 1
      return Response.json({
        items: [application],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
        },
      })
    }) as unknown as typeof fetch

    const view = renderApplicationsPage('/applications')

    await waitFor(() => expect(listRequests).toBe(1))
    expect(await view.findByText('1 loaded')).toBeTruthy()
    resolveFacets?.(
      Response.json({
        companies: [],
        labels: [],
      })
    )
  })

  test('shows the table refresh state while existing rows are reloading', async () => {
    let resolveRefresh: ((response: Response) => void) | undefined
    let listRequests = 0
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/facets')) {
        return Response.json({ companies: [], labels: [] })
      }
      listRequests += 1
      if (listRequests === 2) {
        return new Promise<Response>((resolve) => {
          resolveRefresh = resolve
        })
      }
      return Response.json({
        items: [application],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
        },
      })
    }) as unknown as typeof fetch
    const view = renderApplicationsPage('/applications')

    expect(await view.findByText('1 loaded')).toBeTruthy()
    const refreshButton = view.getByRole('button', {
      name: 'Refresh applications',
    }) as HTMLButtonElement
    await waitFor(() => expect(refreshButton.disabled).toBe(false))
    fireEvent.click(refreshButton)

    await waitFor(() => expect(listRequests).toBe(2))
    expect(
      view.getByRole('status', { name: 'Updating applications' })
    ).toBeTruthy()
    resolveRefresh?.(
      Response.json({
        items: [application],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
        },
      })
    )
  })

  test('keeps a malformed canonical filter visible and blocks the list request', async () => {
    const applicationRequests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/facets')) {
        return Response.json({
          companies: [],
          labels: [],
        })
      }
      applicationRequests.push(url)
      return Response.json({
        items: [],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
        },
      })
    }) as unknown as typeof fetch

    const view = renderApplicationsPage('/applications?filters=not-json')

    expect(
      await view.findByText('Invalid filters URL; the table request is blocked')
    ).toBeTruthy()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(applicationRequests).toEqual([])
    expect(view.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(
      (
        view.getByRole('button', {
          name: 'Refresh applications',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(new URLSearchParams(window.location.search).get('filters')).toBe(
      'not-json'
    )
  })

  test('reloads the table after a row-level update finishes', async () => {
    let listRequests = 0
    let patchRequests = 0
    globalThis.fetch = mock(
      async (input: string | URL | Request, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/facets')) {
          return Response.json({
            companies: ['Example'],
            labels: [],
          })
        }
        if (init?.method === 'PATCH') {
          patchRequests += 1
          return Response.json({
            application: {
              ...application,
              company: 'Updated Example',
              version: 2,
            },
            annualCompensation: application.annualCompensation,
            labels: application.labels,
          })
        }
        listRequests += 1
        return Response.json({
          items: [
            listRequests === 1
              ? application
              : { ...application, company: 'Updated Example', version: 2 },
          ],
          pageInfo: {
            kind: 'cursor',
            size: 50,
            hasNextPage: false,
            hasPreviousPage: false,
            nextCursor: null,
          },
        })
      }
    ) as unknown as typeof fetch

    const view = renderApplicationsPage('/applications')

    fireEvent.click(
      await view.findByRole('button', { name: 'Edit Example row' })
    )
    fireEvent.change(await view.findByPlaceholderText('Company'), {
      target: { value: 'Updated Example' },
    })
    fireEvent.click(view.getByRole('button', { name: 'Save Example row' }))

    await waitFor(() => expect(patchRequests).toBe(1))
    await waitFor(() => expect(listRequests).toBe(2))
    expect(await view.findByText('Updated Example')).toBeTruthy()
  })

  test('restores the last filters and applied table view when revisiting from the menu', async () => {
    const restoredState: ApplicationSavedViewState = {
      keyword: 'platform',
      filters: [
        {
          type: 'condition',
          field: 'applicationStatus',
          operator: 'eq',
          value: 'applied',
        },
      ],
      sorting: [{ id: 'company', desc: false }],
      columnVisibility: { sourceLink: false },
      density: 'compact',
      displayCurrency: 'JPY',
    }
    persistApplicationWorkspaceState(window.localStorage, restoredState)
    persistApplicationSavedViews(window.localStorage, [
      {
        id: 'last-used',
        name: 'Last used view',
        state: restoredState,
        createdAt: '2026-07-16T09:30:00.000Z',
        updatedAt: '2026-07-16T09:30:00.000Z',
      },
    ])
    const applicationRequests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/facets')) {
        return Response.json({
          companies: [],
          labels: [],
        })
      }
      applicationRequests.push(url)
      return Response.json({
        items: [],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
        },
      })
    }) as unknown as typeof fetch

    renderApplicationsPage('/applications')

    await waitFor(() => expect(applicationRequests).toHaveLength(1))
    const request = new URL(
      applicationRequests[0] ?? '',
      'https://registry.test'
    )
    expect(JSON.parse(request.searchParams.get('filters') ?? '[]')).toEqual([
      {
        type: 'condition',
        field: 'applicationStatus',
        operator: 'eq',
        value: 'applied',
      },
    ])
    expect(new URLSearchParams(window.location.search).get('filters')).toBe(
      request.searchParams.get('filters')
    )
    expect(request.searchParams.get('q')).toBe('platform')
    expect(JSON.parse(request.searchParams.get('orderBy') ?? '[]')).toEqual([
      { field: 'company', direction: 'asc' },
    ])
    expect(window.location.search).toContain('filters=')
    expect(window.location.search).toContain('q=platform')
    expect(new URLSearchParams(window.location.search).get('filters')).toBe(
      request.searchParams.get('filters')
    )
    expect(request.searchParams.get('currency')).toBe('JPY')
  })

  test('preserves nested workspace filters and requires explicit replacement', async () => {
    const nestedFilters = [
      {
        type: 'group' as const,
        combinator: 'not' as const,
        children: [
          {
            type: 'condition' as const,
            field: 'applicationStatus',
            operator: 'eq',
            value: 'rejected',
          },
        ] as const,
      },
    ] as const
    persistApplicationWorkspaceState(window.localStorage, {
      keyword: '',
      filters: nestedFilters,
      sorting: [{ id: 'updatedRevision', desc: true }],
      columnVisibility: {},
      density: 'comfortable',
      displayCurrency: 'original',
    })
    const applicationRequests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/facets')) {
        return Response.json({
          companies: [],
          labels: [],
        })
      }
      applicationRequests.push(url)
      return Response.json({
        items: [],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
        },
      })
    }) as unknown as typeof fetch

    const view = renderApplicationsPage('/applications')

    await waitFor(() => expect(applicationRequests).toHaveLength(1))
    const request = new URL(
      applicationRequests[0] ?? '',
      'https://registry.test'
    )
    expect(JSON.parse(request.searchParams.get('filters') ?? '[]')).toEqual(
      nestedFilters
    )
    expect(new URLSearchParams(window.location.search).get('filters')).toBe(
      request.searchParams.get('filters')
    )
    expect(
      view.getByRole('button', { name: 'Replace URL filters' })
    ).toBeTruthy()
    expect(view.queryByRole('button', { name: /^Show filters/ })).toBeNull()
  })

  test('hydrates a canonical enum filter and forwards it to the registry', async () => {
    const applicationRequests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/facets')) {
        return Response.json({
          companies: [],
          labels: [],
        })
      }
      applicationRequests.push(url)
      return Response.json({
        items: [],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
        },
      })
    }) as unknown as typeof fetch

    const search = new URLSearchParams({
      filters: JSON.stringify([
        {
          type: 'condition',
          field: 'applicationStatus',
          operator: 'eq',
          value: 'preparing',
        },
      ]),
    })
    const view = renderApplicationsPage(`/applications?${search.toString()}`)

    await waitFor(() => expect(applicationRequests).toHaveLength(1))
    const request = new URL(
      applicationRequests[0] ?? '',
      'https://registry.test'
    )
    expect(JSON.parse(request.searchParams.get('filters') ?? '[]')).toEqual([
      {
        type: 'condition',
        field: 'applicationStatus',
        operator: 'eq',
        value: 'preparing',
      },
    ])

    fireEvent.click(view.getByRole('button', { name: /^Show filters/ }))
    expect(view.getByLabelText('Application status value')).toBeTruthy()
  })

  test('requests and exposes the selected compensation currency', async () => {
    const applicationRequests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/facets')) {
        return Response.json({
          companies: [],
          labels: [],
        })
      }
      applicationRequests.push(url)
      return Response.json({
        items: [],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
        },
      })
    }) as unknown as typeof fetch

    const view = renderApplicationsPage('/applications?currency=JPY')

    await waitFor(() => expect(applicationRequests).toHaveLength(1))
    const request = new URL(
      applicationRequests[0] ?? '',
      'https://registry.test'
    )
    expect(request.searchParams.get('currency')).toBe('JPY')
    expect(
      view.getByRole('combobox', { name: 'Compensation display currency' })
        .textContent
    ).toContain('JPY')
  })

  test('keeps a backend-valid canonical filter applied when the editor cannot display it', async () => {
    const applicationRequests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/facets')) {
        return Response.json({
          companies: [],
          labels: [],
        })
      }
      applicationRequests.push(url)
      return Response.json({
        items: [],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
        },
      })
    }) as unknown as typeof fetch

    const filters = [
      {
        type: 'condition',
        field: 'q',
        operator: 'matches',
        value: 'platform',
      },
    ]
    const search = new URLSearchParams({ filters: JSON.stringify(filters) })
    const view = renderApplicationsPage(`/applications?${search.toString()}`)

    await waitFor(() => expect(applicationRequests).toHaveLength(1))
    const request = new URL(
      applicationRequests[0] ?? '',
      'https://registry.test'
    )
    expect(JSON.parse(request.searchParams.get('filters') ?? '[]')).toEqual(
      filters
    )
    expect(view.getByRole('alert').textContent).toContain(
      'URL filters are applied, but this editor cannot display them yet'
    )
    expect(
      view.getByRole('button', { name: 'Replace URL filters' })
    ).toBeTruthy()
  })

  test('blocks a custom string filter with a non-string value', async () => {
    const applicationRequests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/facets')) {
        return Response.json({ companies: [], labels: [] })
      }
      applicationRequests.push(url)
      return Response.json({
        items: [],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
        },
      })
    }) as unknown as typeof fetch
    const filters = JSON.stringify([
      {
        type: 'condition',
        field: 'q',
        operator: 'matches',
        value: { unexpected: true },
      },
    ])

    const view = renderApplicationsPage(
      `/applications?${new URLSearchParams({ filters }).toString()}`
    )

    expect(
      await view.findByText('Invalid filters URL; the table request is blocked')
    ).toBeTruthy()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(applicationRequests).toEqual([])
  })

  test('keeps the last valid filter applied while an edited value is incomplete', async () => {
    const applicationRequests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/facets')) {
        return Response.json({ companies: [], labels: [] })
      }
      applicationRequests.push(url)
      return Response.json({
        items: [],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
        },
      })
    }) as unknown as typeof fetch
    const filters = JSON.stringify([
      {
        type: 'condition',
        field: 'company',
        operator: 'contains',
        value: 'Example',
      },
    ])
    const path = `/applications?${new URLSearchParams({ filters }).toString()}`
    const view = renderApplicationsPage(path)

    await waitFor(() => expect(applicationRequests).toHaveLength(1))
    const appliedFilter = new URLSearchParams(window.location.search).get(
      'filters'
    )
    fireEvent.click(view.getByRole('button', { name: /^Show filters/ }))
    const valueInput = view.getByLabelText('Company value')
    fireEvent.change(valueInput, { target: { value: '' } })
    fireEvent.blur(valueInput)

    expect(await view.findByText(/before applying changes/)).toBeTruthy()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(applicationRequests).toHaveLength(1)
    expect(new URLSearchParams(window.location.search).get('filters')).toBe(
      appliedFilter
    )
  })

  test('adds a filter with one route-backed registry request', async () => {
    const applicationRequests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/facets')) {
        return Response.json({
          companies: [],
          labels: [],
        })
      }
      applicationRequests.push(url)
      return Response.json({
        items: [],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
        },
      })
    }) as unknown as typeof fetch

    const view = renderApplicationsPage('/applications')

    await waitFor(() => expect(applicationRequests).toHaveLength(1))
    applicationRequests.length = 0

    fireEvent.click(view.getByRole('button', { name: 'Show filters' }))
    fireEvent.click(view.getByRole('button', { name: 'Add filter' }))
    fireEvent.click(
      await view.findByRole('button', { name: 'Application status' })
    )

    await waitFor(() => expect(applicationRequests).toHaveLength(1))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(applicationRequests).toHaveLength(1)
    expect(view.getByLabelText('Application status operator')).toBeTruthy()
    expect(view.getByLabelText('Application status value')).toBeTruthy()
  })

  test('issues one registry request when column ordering changes', async () => {
    const applicationRequests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/facets')) {
        return Response.json({
          companies: [],
          labels: [],
        })
      }
      applicationRequests.push(url)
      return Response.json({
        items: [],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
        },
      })
    }) as unknown as typeof fetch

    const view = renderApplicationsPage('/applications')

    await waitFor(() => expect(applicationRequests).toHaveLength(1))
    applicationRequests.length = 0

    fireEvent.click(view.getByRole('button', { name: /^Company/ }))

    await waitFor(() => expect(applicationRequests).toHaveLength(1))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(applicationRequests).toHaveLength(1)
    const request = new URL(
      applicationRequests[0] ?? '',
      'https://registry.test'
    )
    const orderBy = JSON.parse(request.searchParams.get('orderBy') ?? '[]') as {
      readonly field: string
      readonly direction: string
    }[]
    expect(orderBy).toHaveLength(1)
    expect(orderBy[0]?.field).toBe('company')
    expect(['asc', 'desc']).toContain(orderBy[0]?.direction)
  })

  test('adds a secondary ordering with shift-click and exposes its priority', async () => {
    const applicationRequests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/facets')) {
        return Response.json({
          companies: [],
          labels: [],
        })
      }
      applicationRequests.push(url)
      return Response.json({
        items: [],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
        },
      })
    }) as unknown as typeof fetch

    const view = renderApplicationsPage('/applications')

    await waitFor(() => expect(applicationRequests).toHaveLength(1))
    applicationRequests.length = 0
    fireEvent.click(view.getByRole('button', { name: /^Company/ }))
    await waitFor(() => expect(applicationRequests).toHaveLength(1))
    fireEvent.click(view.getByRole('button', { name: /^Role/ }), {
      shiftKey: true,
    })

    await waitFor(() => expect(applicationRequests).toHaveLength(2))
    const request = new URL(
      applicationRequests[1] ?? '',
      'https://registry.test'
    )
    expect(JSON.parse(request.searchParams.get('orderBy') ?? '[]')).toEqual([
      { field: 'company', direction: 'desc' },
      { field: 'role', direction: 'desc' },
    ])
    await waitFor(() =>
      expect(new URLSearchParams(window.location.search).get('sort')).toBe(
        'company:desc,role:desc'
      )
    )
    expect(view.getByText('Sort priority 1')).toBeTruthy()
    expect(view.getByText('Sort priority 2')).toBeTruthy()
  })

  test('opens a persisted date filter inside the scrollable workspace', async () => {
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/facets')) {
        return Response.json({
          companies: [],
          labels: [],
        })
      }
      return Response.json({
        items: [],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          nextCursor: null,
        },
      })
    }) as unknown as typeof fetch

    const filters = JSON.stringify([
      {
        type: 'condition',
        field: 'updatedAt',
        operator: 'gte',
        value: '2026-07-01T09:30:00.000Z',
      },
    ])
    const view = renderApplicationsPage(
      `/applications?filters=${encodeURIComponent(filters)}`
    )

    const tableScroller = view.container.querySelector(
      '[data-slot="applications-table"]'
    )
    expect(tableScroller?.classList.contains('overflow-auto')).toBe(true)

    fireEvent.click(view.getByRole('button', { name: /^Show filters/ }))

    await waitFor(() => {
      expect(view.getByLabelText('Updated time value')).toBeTruthy()
    })
    expect(
      view.container
        .querySelector('[data-slot="query-filters-panel"]')
        ?.classList.contains('absolute')
    ).toBe(false)
    expect(view.getByRole('button', { name: /^Hide filters/ })).toBeTruthy()
    expect(view.getByRole('button', { name: /add filter/i })).toBeTruthy()
  })
})
