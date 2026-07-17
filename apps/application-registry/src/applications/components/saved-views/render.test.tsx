import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'

import {
  APPLICATION_SAVED_VIEWS_SCHEMA_VERSION,
  APPLICATION_SAVED_VIEWS_STORAGE_KEY,
  APPLICATION_WORKSPACE_STATE_SCHEMA_VERSION,
  APPLICATION_WORKSPACE_STATE_STORAGE_KEY,
  type ApplicationSavedView,
  type ApplicationSavedViewState,
  ApplicationSavedViews,
  loadApplicationSavedViews,
  loadApplicationWorkspaceState,
  persistApplicationSavedViews,
  persistApplicationWorkspaceState,
} from './render'

const currentState: ApplicationSavedViewState = {
  keyword: 'platform',
  filters: [
    {
      type: 'condition',
      field: 'applicationStatus',
      operator: 'eq',
      value: 'interviewing',
    },
    {
      type: 'condition',
      field: 'targetStage',
      operator: 'eq',
      value: 'onsite',
    },
  ],
  sorting: [{ id: 'updatedRevision', desc: true }],
  columnVisibility: { source: false },
  density: 'compact',
  displayCurrency: 'JPY',
}

const storageKey = '@cv/application-registry/saved-views:test'

afterEach(() => {
  cleanup()
  window.localStorage.clear()
})

describe('application saved views storage', () => {
  test('rejects payloads that do not use the current state contract', () => {
    const incompatibleState = {
      keyword: 'platform',
      sorting: currentState.sorting,
      columnVisibility: currentState.columnVisibility,
      density: currentState.density,
    }
    window.localStorage.setItem(
      APPLICATION_SAVED_VIEWS_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: APPLICATION_SAVED_VIEWS_SCHEMA_VERSION,
        views: [
          {
            id: 'incompatible',
            name: 'Incompatible interviews',
            state: incompatibleState,
            createdAt: '2026-07-16T10:00:00.000Z',
            updatedAt: '2026-07-16T10:00:00.000Z',
          },
        ],
      })
    )
    window.localStorage.setItem(
      APPLICATION_WORKSPACE_STATE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: APPLICATION_WORKSPACE_STATE_SCHEMA_VERSION,
        state: incompatibleState,
      })
    )

    expect(loadApplicationSavedViews(window.localStorage)).toEqual([])
    expect(loadApplicationWorkspaceState(window.localStorage)).toBeNull()
  })

  test('round-trips the last active workspace state for page restoration', () => {
    const workspaceKey = '@cv/application-registry/workspace-state:test'

    persistApplicationWorkspaceState(
      window.localStorage,
      currentState,
      workspaceKey
    )

    expect(
      loadApplicationWorkspaceState(window.localStorage, workspaceKey)
    ).toEqual(currentState)
    expect(
      JSON.parse(window.localStorage.getItem(workspaceKey) ?? '{}')
        .schemaVersion
    ).toBe(APPLICATION_WORKSPACE_STATE_SCHEMA_VERSION)

    window.localStorage.setItem(
      workspaceKey,
      JSON.stringify({ schemaVersion: 999, state: currentState })
    )
    expect(
      loadApplicationWorkspaceState(window.localStorage, workspaceKey)
    ).toBeNull()
  })

  test('round-trips a versioned payload and rejects another schema version', () => {
    const savedView: ApplicationSavedView = {
      id: 'interviews',
      name: 'Active interviews',
      state: currentState,
      createdAt: '2026-07-16T10:00:00.000Z',
      updatedAt: '2026-07-16T10:00:00.000Z',
    }

    persistApplicationSavedViews(window.localStorage, [savedView], storageKey)

    expect(loadApplicationSavedViews(window.localStorage, storageKey)).toEqual([
      savedView,
    ])
    expect(
      JSON.parse(window.localStorage.getItem(storageKey) ?? '{}').schemaVersion
    ).toBe(APPLICATION_SAVED_VIEWS_SCHEMA_VERSION)

    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        schemaVersion: APPLICATION_SAVED_VIEWS_SCHEMA_VERSION + 1,
        views: [savedView],
      })
    )
    expect(loadApplicationSavedViews(window.localStorage, storageKey)).toEqual(
      []
    )
  })

  test('ignores malformed entries without losing valid views', () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        schemaVersion: APPLICATION_SAVED_VIEWS_SCHEMA_VERSION,
        views: [
          { id: 'broken', name: '', state: null },
          {
            id: 'valid',
            name: 'Valid view',
            state: currentState,
            createdAt: '2026-07-16T10:00:00.000Z',
            updatedAt: '2026-07-16T10:00:00.000Z',
          },
        ],
      })
    )

    expect(
      loadApplicationSavedViews(window.localStorage, storageKey)
    ).toHaveLength(1)
  })
})

describe('ApplicationSavedViews', () => {
  test('marks a restored saved view as active', async () => {
    persistApplicationSavedViews(
      window.localStorage,
      [
        {
          id: 'last-used',
          name: 'Last used view',
          state: currentState,
          createdAt: '2026-07-16T10:00:00.000Z',
          updatedAt: '2026-07-16T10:00:00.000Z',
        },
      ],
      storageKey
    )
    const view = render(
      <ApplicationSavedViews
        currentState={currentState}
        onApply={() => undefined}
        storageKey={storageKey}
      />
    )

    fireEvent.click(view.getByRole('button', { name: /^View/ }))
    expect(
      (
        await view.findByRole('button', { name: 'Apply Last used view' })
      ).getAttribute('aria-current')
    ).toBe('true')
  })

  test('saves, applies, renames, and deletes a view', async () => {
    const onApply = mock((_state: ApplicationSavedViewState) => undefined)
    const view = render(
      <ApplicationSavedViews
        currentState={currentState}
        onApply={onApply}
        storageKey={storageKey}
      />
    )

    fireEvent.click(view.getByRole('button', { name: 'View' }))
    fireEvent.click(
      await view.findByRole('button', { name: 'Save current view' })
    )
    fireEvent.change(view.getByRole('textbox', { name: 'View name' }), {
      target: { value: 'Active interviews' },
    })
    fireEvent.click(view.getByRole('button', { name: 'Save view' }))

    await waitFor(() => {
      expect(
        loadApplicationSavedViews(window.localStorage, storageKey)
      ).toHaveLength(1)
    })

    fireEvent.click(view.getByRole('button', { name: /^View/ }))
    fireEvent.click(
      await view.findByRole('button', { name: 'Apply Active interviews' })
    )
    expect(onApply).toHaveBeenCalledWith(currentState)

    fireEvent.click(view.getByRole('button', { name: /^View/ }))
    fireEvent.click(
      await view.findByRole('button', { name: 'Rename Active interviews' })
    )
    fireEvent.change(view.getByRole('textbox', { name: 'View name' }), {
      target: { value: 'Offer watch' },
    })
    fireEvent.click(view.getByRole('button', { name: 'Rename view' }))

    await waitFor(() => {
      expect(
        loadApplicationSavedViews(window.localStorage, storageKey)[0]?.name
      ).toBe('Offer watch')
    })

    fireEvent.click(view.getByRole('button', { name: /^View/ }))
    fireEvent.click(
      await view.findByRole('button', { name: 'Delete Offer watch' })
    )

    await waitFor(() => {
      expect(
        loadApplicationSavedViews(window.localStorage, storageKey)
      ).toEqual([])
    })
  })
})
