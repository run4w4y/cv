import { afterEach, describe, expect, mock, test } from 'bun:test'
import {
  type ApplicationListItem,
  decodeListApplicationsSearchParams,
} from '@cv/application-registry-api-contract'
import { cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { NuqsAdapter } from 'nuqs/adapters/react-router/v7'
import { BrowserRouter } from 'react-router'
import { HeaderActionsProvider } from '../../../shell/header-actions'
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
  const headerTarget = document.createElement('div')
  document.body.append(headerTarget)
  const result = renderWithRegistry(
    <BrowserRouter>
      <NuqsAdapter>
        <HeaderActionsProvider target={headerTarget}>
          <ApplicationsPage />
        </HeaderActionsProvider>
      </NuqsAdapter>
    </BrowserRouter>
  )
  return Object.assign(result, { headerTarget })
}

const application: ApplicationListItem = {
  id: 'application-1',
  postingUrl: 'https://example.test/jobs/one',
  company: 'Example',
  role: 'Staff Engineer',
  location: 'Remote',
  applicationStatus: 'not_started',
  targetStage: 'apply_next',
  personalPriority: 'high',
  followUpAt: null,
  appliedAt: null,
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
  counts: { notes: 0 },
  labels: [],
  latestActivity: null,
}

describe('ApplicationsPage', () => {
  test('loads applications without waiting for facets', async () => {
    let resolveFacets: ((response: Response) => void) | undefined
    const facetsResponse = new Promise<Response>((resolve) => {
      resolveFacets = resolve
    })
    let listRequests = 0
    let listRequestUrl = ''
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/facets')) return facetsResponse
      listRequests += 1
      listRequestUrl = url
      return Response.json({
        items: [application],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          totalItems: 1,
          nextCursor: null,
        },
      })
    }) as unknown as typeof fetch

    const view = renderApplicationsPage('/applications')

    await waitFor(() => expect(listRequests).toBe(1))
    expect(new URL(listRequestUrl).searchParams.has('sort')).toBe(false)
    expect(new URLSearchParams(window.location.search).has('sort')).toBe(false)
    expect(await view.findByText('1 total')).toBeTruthy()
    expect(
      view.queryByText(
        'Search, filter, and review the canonical opportunity registry.'
      )
    ).toBeNull()
    expect(
      within(view.headerTarget)
        .getAllByRole('button')
        .map((button) => button.textContent?.trim())
    ).toEqual(['Show filters', 'View', 'New application'])
    expect(
      view.container
        .querySelector('[data-slot="input-group-addon"]')
        ?.classList.contains('pr-2')
    ).toBe(true)
    resolveFacets?.(
      Response.json({
        companies: [],
        labels: [],
      })
    )
  })

  test('omits the manual refresh action', async () => {
    let listRequests = 0
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/facets')) {
        return Response.json({ companies: [], labels: [] })
      }
      listRequests += 1
      return Response.json({
        items: [application],
        pageInfo: {
          kind: 'cursor',
          size: 50,
          hasNextPage: false,
          hasPreviousPage: false,
          totalItems: 1,
          nextCursor: null,
        },
      })
    }) as unknown as typeof fetch
    const view = renderApplicationsPage('/applications')

    expect(await view.findByText('1 total')).toBeTruthy()
    expect(
      view.queryByRole('button', { name: 'Refresh applications' })
    ).toBeNull()
    expect(listRequests).toBe(1)
  })

  test('ignores obsolete JSON filter parameters', async () => {
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

    await waitFor(() => expect(applicationRequests).toHaveLength(1))
    expect(
      view.queryByText('Invalid query URL; the table request is blocked')
    ).toBeNull()
    expect(view.queryByRole('button', { name: 'Try again' })).toBeNull()
    expect(
      view.queryByRole('button', { name: 'Refresh applications' })
    ).toBeNull()
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
    let fxRequests = 0
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.startsWith('https://api.frankfurter.dev/')) {
        fxRequests += 1
        return Response.json([
          { base: 'JPY', date: '2026-07-20', quote: 'USD', rate: 0.0067 },
        ])
      }
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
    expect(
      decodeListApplicationsSearchParams(request.searchParams).filters
    ).toEqual([
      {
        type: 'condition',
        field: 'applicationStatus',
        operator: 'eq',
        value: 'applied',
      },
    ])
    expect(new URLSearchParams(window.location.search).get('filter')).toBe(
      request.searchParams.get('filter')
    )
    expect(request.searchParams.get('q')).toBe('platform')
    expect(
      decodeListApplicationsSearchParams(request.searchParams).orderBy
    ).toEqual([{ field: 'company', direction: 'asc' }])
    expect(window.location.search).toContain('filter=')
    expect(window.location.search).toContain('q=platform')
    expect(new URLSearchParams(window.location.search).get('filter')).toBe(
      request.searchParams.get('filter')
    )
    expect(request.searchParams.get('currency')).toBeNull()
    expect(fxRequests).toBe(1)
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
    expect(
      decodeListApplicationsSearchParams(request.searchParams).filters
    ).toEqual(nestedFilters)
    expect(new URLSearchParams(window.location.search).get('filter')).toBe(
      request.searchParams.get('filter')
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
      filter: 'applicationStatus:eq:preparing',
    })
    const view = renderApplicationsPage(`/applications?${search.toString()}`)

    await waitFor(() => expect(applicationRequests).toHaveLength(1))
    const request = new URL(
      applicationRequests[0] ?? '',
      'https://registry.test'
    )
    expect(
      decodeListApplicationsSearchParams(request.searchParams).filters
    ).toEqual([
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

  test('keeps the selected compensation currency out of registry requests', async () => {
    const applicationRequests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.startsWith('https://api.frankfurter.dev/')) {
        return Response.json([
          { base: 'JPY', date: '2026-07-20', quote: 'USD', rate: 0.0067 },
        ])
      }
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
    expect(request.searchParams.get('currency')).toBeNull()
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
    const search = new URLSearchParams({ filter: 'q:matches:platform' })
    const view = renderApplicationsPage(`/applications?${search.toString()}`)

    await waitFor(() => expect(applicationRequests).toHaveLength(1))
    const request = new URL(
      applicationRequests[0] ?? '',
      'https://registry.test'
    )
    expect(
      decodeListApplicationsSearchParams(request.searchParams).filters
    ).toEqual(filters)
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
    const view = renderApplicationsPage(
      '/applications?filter=q:matches:{unexpected:true}'
    )

    expect(
      await view.findByText('Invalid query URL; the table request is blocked')
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
    const path = '/applications?filter=company:contains:Example'
    const view = renderApplicationsPage(path)

    await waitFor(() => expect(applicationRequests).toHaveLength(1))
    const appliedFilter = new URLSearchParams(window.location.search).get(
      'filter'
    )
    fireEvent.click(view.getByRole('button', { name: /^Show filters/ }))
    const valueInput = view.getByLabelText('Company value')
    fireEvent.change(valueInput, { target: { value: '' } })
    fireEvent.blur(valueInput)

    expect(await view.findByText(/before applying changes/)).toBeTruthy()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(applicationRequests).toHaveLength(1)
    expect(new URLSearchParams(window.location.search).get('filter')).toBe(
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
    const orderBy =
      decodeListApplicationsSearchParams(request.searchParams).orderBy ?? []
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
    expect(
      decodeListApplicationsSearchParams(request.searchParams).orderBy
    ).toEqual([
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

    const view = renderApplicationsPage(
      '/applications?filter=updatedAt:gte:2026-07-01T09:30:00.000Z'
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
