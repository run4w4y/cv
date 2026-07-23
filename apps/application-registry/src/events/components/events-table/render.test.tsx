import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { RegistryActivityListItem } from '@cv/application-registry-api-contract'
import type { SortingState } from '@tanstack/react-table'
import { cleanup, render, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { HeaderActionsProvider } from '../../../shell/header-actions'
import type { EventsSavedViewState } from '../saved-views'
import { EventsTable } from './render'

afterEach(() => {
  cleanup()
  Reflect.deleteProperty(globalThis, 'IntersectionObserver')
})

const event = {
  id: 'activity-1',
  applicationId: 'application-1',
  postingUrl: 'https://example.test/jobs/one',
  company: 'Example Company With A Name That Can Wrap',
  role: 'Staff Platform Engineer With A Long Specialization',
  kind: 'status_changed',
  revision: 42,
  occurredAt: '2026-07-15T09:30:00.000Z',
  actor: 'system',
  source: 'management',
  payload: { from: 'backlog', to: 'interviewing' },
} as RegistryActivityListItem

const currentViewState: EventsSavedViewState = {
  filters: [],
  sorting: [{ id: 'revision', desc: true }],
  columnVisibility: {},
  density: 'comfortable',
}

const viewProps = {
  density: currentViewState.density,
  onDensityChange: () => undefined,
  columnVisibility: currentViewState.columnVisibility,
  onColumnVisibilityChange: () => undefined,
  currentViewState,
  onApplyView: () => undefined,
} as const

describe('ActivitiesTable', () => {
  test('renders the complete activity history table and puts View in the topbar', () => {
    const target = document.createElement('div')
    document.body.append(target)
    const sorting: SortingState = [{ id: 'revision', desc: true }]
    const view = render(
      <MemoryRouter>
        <HeaderActionsProvider target={target}>
          <EventsTable
            {...viewProps}
            data={[event]}
            loading={false}
            refreshing={false}
            loadingMore={false}
            hasNextPage={false}
            sorting={sorting}
            onSortingChange={() => undefined}
            onLoadMore={() => undefined}
          />
        </HeaderActionsProvider>
      </MemoryRouter>
    )

    const table = view.getByRole('table')
    const headers = within(table).getAllByRole('columnheader')
    expect(headers).toHaveLength(8)
    expect(
      headers.every((header) => header.classList.contains('normal-case'))
    ).toBe(true)
    expect(within(table).getAllByRole('cell')).toHaveLength(8)
    expect(view.getByText('From: backlog · To: interviewing')).toBeTruthy()
    expect(within(target).getByRole('button', { name: /view/i })).toBeTruthy()
    expect(
      view.container.querySelector('[data-slot="activities-table"]')
    ).toBeTruthy()
    target.remove()
  })

  test('loads the next cursor page when the sentinel enters the viewport', async () => {
    let observerCallback:
      | ((entries: readonly { readonly isIntersecting: boolean }[]) => void)
      | undefined
    const disconnect = mock(() => undefined)
    globalThis.IntersectionObserver = class IntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observerCallback = callback as unknown as typeof observerCallback
      }
      observe() {}
      unobserve() {}
      disconnect = disconnect
      root = null
      rootMargin = ''
      thresholds = []
      takeRecords() {
        return []
      }
    }
    const loadMore = mock(() => undefined)

    render(
      <MemoryRouter>
        <EventsTable
          {...viewProps}
          data={[event]}
          loading={false}
          refreshing={false}
          loadingMore={false}
          hasNextPage
          sorting={[]}
          onSortingChange={() => undefined}
          onLoadMore={loadMore}
        />
      </MemoryRouter>
    )

    await waitFor(() => expect(observerCallback).toBeDefined())
    observerCallback?.([{ isIntersecting: true }])
    expect(loadMore).toHaveBeenCalledTimes(1)
  })

  test('shows skeleton rows initially and a refresh overlay over existing data', () => {
    const initial = render(
      <MemoryRouter>
        <EventsTable
          {...viewProps}
          data={[]}
          loading
          refreshing={false}
          loadingMore={false}
          hasNextPage={false}
          sorting={[]}
          onSortingChange={() => undefined}
          onLoadMore={() => undefined}
        />
      </MemoryRouter>
    )
    expect(
      initial.container.querySelectorAll('[data-slot="skeleton"]')
    ).toHaveLength(72)
    initial.unmount()

    const refresh = render(
      <MemoryRouter>
        <EventsTable
          {...viewProps}
          data={[event]}
          loading={false}
          refreshing
          loadingMore={false}
          hasNextPage={false}
          sorting={[]}
          onSortingChange={() => undefined}
          onLoadMore={() => undefined}
        />
      </MemoryRouter>
    )
    expect(
      refresh.container.querySelector(
        '[data-slot="activities-refresh-overlay"]'
      )
    ).toBeTruthy()
  })
})
