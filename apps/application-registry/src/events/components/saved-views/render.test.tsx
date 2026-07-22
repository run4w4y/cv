import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { RegistryActivityListItem } from '@cv/application-registry-api-contract'
import {
  functionalUpdate,
  getCoreRowModel,
  useReactTable,
  type VisibilityState,
} from '@tanstack/react-table'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import * as React from 'react'
import { eventColumns } from '../events-table/columns'
import {
  EVENTS_SAVED_VIEWS_SCHEMA_VERSION,
  EVENTS_SAVED_VIEWS_STORAGE_KEY,
  type EventsSavedView,
  type EventsSavedViewState,
  type EventsTableDensity,
  EventsViewMenu,
  loadEventsSavedViews,
  persistEventsSavedViews,
} from './render'

const currentState: EventsSavedViewState = {
  filters: [
    {
      type: 'condition',
      field: 'kind',
      operator: 'in',
      value: ['application_created', 'status_changed'],
    },
    {
      type: 'condition',
      field: 'revision',
      operator: 'gte',
      value: 20,
    },
  ],
  sorting: [
    { id: 'occurredAt', desc: true },
    { id: 'revision', desc: false },
  ],
  columnVisibility: { actor: false },
  density: 'compact',
}

const storageKey = '@cv/application-registry/activities/saved-views:test'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('activity saved views storage', () => {
  test('round-trips nested saved filters without flattening them', () => {
    const nestedState: EventsSavedViewState = {
      ...currentState,
      filters: [
        {
          type: 'group',
          combinator: 'not',
          children: [
            {
              type: 'condition',
              field: 'kind',
              operator: 'eq',
              value: 'application_created',
            },
          ],
        },
      ],
    }
    const savedView: EventsSavedView = {
      id: 'nested',
      name: 'Not submitted',
      state: nestedState,
      createdAt: '2026-07-16T10:00:00.000Z',
      updatedAt: '2026-07-16T10:00:00.000Z',
    }

    persistEventsSavedViews(window.localStorage, [savedView], storageKey)

    expect(loadEventsSavedViews(window.localStorage, storageKey)).toEqual([
      savedView,
    ])
  })

  test('rejects payloads that do not use canonical filter nodes', () => {
    window.localStorage.setItem(
      EVENTS_SAVED_VIEWS_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: EVENTS_SAVED_VIEWS_SCHEMA_VERSION,
        views: [
          {
            id: 'incompatible',
            name: 'Incompatible stage changes',
            state: {
              sorting: currentState.sorting,
              columnVisibility: currentState.columnVisibility,
              density: currentState.density,
            },
            createdAt: '2026-07-16T10:00:00.000Z',
            updatedAt: '2026-07-16T10:00:00.000Z',
          },
        ],
      })
    )

    expect(loadEventsSavedViews(window.localStorage)).toEqual([])
  })

  test('round-trips every view setting in a versioned payload', () => {
    const savedView: EventsSavedView = {
      id: 'stage-changes',
      name: 'Recent stage changes',
      state: currentState,
      createdAt: '2026-07-16T10:00:00.000Z',
      updatedAt: '2026-07-16T10:00:00.000Z',
    }

    persistEventsSavedViews(window.localStorage, [savedView], storageKey)

    expect(loadEventsSavedViews(window.localStorage, storageKey)).toEqual([
      savedView,
    ])
    expect(
      JSON.parse(window.localStorage.getItem(storageKey) ?? '{}').schemaVersion
    ).toBe(EVENTS_SAVED_VIEWS_SCHEMA_VERSION)
  })

  test('rejects another schema and malformed activity table state', () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        schemaVersion: EVENTS_SAVED_VIEWS_SCHEMA_VERSION + 1,
        views: [],
      })
    )
    expect(loadEventsSavedViews(window.localStorage, storageKey)).toEqual([])

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        schemaVersion: EVENTS_SAVED_VIEWS_SCHEMA_VERSION,
        views: [
          {
            id: 'invalid',
            name: 'Invalid',
            state: {
              ...currentState,
              columnVisibility: { unknownColumn: false },
            },
            createdAt: '2026-07-16T10:00:00.000Z',
            updatedAt: '2026-07-16T10:00:00.000Z',
          },
        ],
      })
    )
    expect(loadEventsSavedViews(window.localStorage, storageKey)).toEqual([])
  })
})

const EventsViewMenuHarness = ({
  onApply,
}: {
  readonly onApply: (state: EventsSavedViewState) => void
}) => {
  const [density, setDensity] = React.useState<EventsTableDensity>(
    currentState.density
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(currentState.columnVisibility)
  const table = useReactTable({
    data: [] as RegistryActivityListItem[],
    columns: [...eventColumns],
    getCoreRowModel: getCoreRowModel(),
    state: { columnVisibility },
    onColumnVisibilityChange: (updater) =>
      setColumnVisibility((existing) => functionalUpdate(updater, existing)),
  })

  return (
    <EventsViewMenu
      table={table}
      density={density}
      onDensityChange={setDensity}
      currentState={{ ...currentState, density, columnVisibility }}
      onApply={onApply}
      storageKey={storageKey}
    />
  )
}

describe('EventsViewMenu', () => {
  test('saves, applies, renames, and deletes from the one View control', async () => {
    const onApply = mock((_state: EventsSavedViewState) => undefined)
    const view = render(<EventsViewMenuHarness onApply={onApply} />)

    fireEvent.click(view.getByRole('button', { name: 'View' }))
    fireEvent.click(
      await view.findByRole('button', { name: 'Save current view' })
    )
    fireEvent.change(view.getByRole('textbox', { name: 'View name' }), {
      target: { value: 'Recent stage changes' },
    })
    fireEvent.click(view.getByRole('button', { name: 'Save view' }))

    await waitFor(() => {
      expect(loadEventsSavedViews(window.localStorage, storageKey)).toEqual([
        expect.objectContaining({
          name: 'Recent stage changes',
          state: currentState,
        }),
      ])
    })

    fireEvent.click(view.getByRole('button', { name: /^View/ }))
    fireEvent.click(
      await view.findByRole('button', { name: 'Apply Recent stage changes' })
    )
    expect(onApply).toHaveBeenCalledWith(currentState)

    fireEvent.click(view.getByRole('button', { name: /^View/ }))
    fireEvent.click(
      await view.findByRole('button', { name: 'Rename Recent stage changes' })
    )
    fireEvent.change(view.getByRole('textbox', { name: 'View name' }), {
      target: { value: 'Offer audit' },
    })
    fireEvent.click(view.getByRole('button', { name: 'Rename view' }))

    await waitFor(() => {
      expect(
        loadEventsSavedViews(window.localStorage, storageKey)[0]?.name
      ).toBe('Offer audit')
    })

    fireEvent.click(view.getByRole('button', { name: /^View/ }))
    fireEvent.click(
      await view.findByRole('button', { name: 'Delete Offer audit' })
    )

    await waitFor(() => {
      expect(loadEventsSavedViews(window.localStorage, storageKey)).toEqual([])
    })
  })
})
