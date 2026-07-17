import { afterEach, describe, expect, test } from 'bun:test'
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from '@testing-library/react'
import * as React from 'react'

import type { QueryFiltersState } from './model'
import {
  applicationFieldPresentation,
  applicationQueryDefinition,
} from './stories/application-query-fixture'

afterEach(() => cleanup())

describe('QueryFilters', () => {
  test('opens the inline queue-management filter builder', async () => {
    const { QueryFilters } = await import('./query-filters')

    const view = render(
      <QueryFilters
        definition={applicationQueryDefinition}
        fields={applicationFieldPresentation}
        value={{ combinator: 'and', conditions: [] }}
        onValueChange={() => undefined}
      />
    )

    const trigger = view.getByRole('button', { name: 'Show filters' })
    fireEvent.click(trigger)

    const panel = await waitFor(() => {
      const element = view.container.querySelector(
        '[data-slot="query-filters-panel"]'
      )
      expect(element).toBeTruthy()
      return element
    })
    expect(panel?.classList.contains('absolute')).toBe(false)
    expect(
      panel
        ?.querySelector('[data-slot="query-filters-editor"]')
        ?.getAttribute('data-state')
    ).toBe('open')
    expect(view.getByRole('button', { name: 'Hide filters' })).toBeTruthy()
  })

  test('adds a condition from query metadata and renders its editor', async () => {
    const { QueryFilters } = await import('./query-filters')

    const Harness = () => {
      const [value, setValue] = React.useState<QueryFiltersState>({
        combinator: 'and',
        conditions: [],
      })

      return (
        <QueryFilters
          definition={applicationQueryDefinition}
          fields={applicationFieldPresentation}
          value={value}
          onValueChange={setValue}
          defaultExpanded
        />
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button', { name: /add filter/i }))

    const picker = await waitFor(() => {
      const element = document.body.querySelector(
        '[data-slot="popover-content"]'
      )
      expect(element).toBeTruthy()
      return element
    })
    expect(view.container.contains(picker)).toBe(false)

    const body = within(document.body)
    const status = await body.findByText('Application status')
    fireEvent.click(status)

    await waitFor(() => {
      expect(view.getByLabelText('Application status value')).toBeTruthy()
    })
    expect(view.queryByLabelText('Filter field')).toBeNull()
    expect(view.getByLabelText('Application status operator').tagName).toBe(
      'BUTTON'
    )
    expect(view.getByLabelText('Application status value').tagName).toBe(
      'BUTTON'
    )
    expect(view.getAllByText('Application status').length).toBeGreaterThan(0)
    expect(
      view.container.querySelector('[data-slot="button-group"]')
    ).toBeTruthy()
    expect(
      view.container.querySelectorAll('[data-slot="button-group-separator"]')
        .length
    ).toBe(3)
  })

  test('supports the queue-management compound toolbar composition', async () => {
    const { QueryFiltersPanel, QueryFiltersRoot, QueryFiltersToggle } =
      await import('./query-filters')

    const view = render(
      <QueryFiltersRoot
        definition={applicationQueryDefinition}
        fields={applicationFieldPresentation}
        value={{
          combinator: 'and',
          conditions: [
            {
              type: 'condition',
              field: 'company',
              operator: 'contains',
              value: 'Acme',
            },
          ],
        }}
        onValueChange={() => undefined}
      >
        <div data-testid="toolbar">
          <input aria-label="Search applications" />
          <QueryFiltersToggle />
        </div>
        <QueryFiltersPanel />
      </QueryFiltersRoot>
    )

    expect(
      within(view.getByTestId('toolbar')).getByLabelText('Search applications')
    ).toBeTruthy()
    expect(
      within(view.getByTestId('toolbar')).getByRole('button', {
        name: /^Show filters/,
      })
    ).toBeTruthy()
    expect(view.getByLabelText('Active filters')).toBeTruthy()

    const editor = view.container.querySelector(
      '[data-slot="query-filters-editor"]'
    )
    expect(editor?.hasAttribute('hidden')).toBe(true)

    fireEvent.click(view.getByRole('button', { name: /^Show filters/ }))
    expect(editor?.hasAttribute('hidden')).toBe(false)
  })

  test('removes an existing condition from its summary chip', async () => {
    const { QueryFilters } = await import('./query-filters')

    const Harness = () => {
      const [value, setValue] = React.useState<QueryFiltersState>({
        combinator: 'and',
        conditions: [
          {
            type: 'condition',
            field: 'company',
            operator: 'contains',
            value: 'Acme',
          },
        ],
      })

      return (
        <QueryFilters
          definition={applicationQueryDefinition}
          fields={applicationFieldPresentation}
          value={value}
          onValueChange={setValue}
        />
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.getByRole('button', { name: 'Remove Company filter' }))

    expect(
      view.queryByRole('button', { name: 'Remove Company filter' })
    ).toBeNull()
  })

  test('renders date ranges from query metadata with calendar controls', async () => {
    const { QueryFilters } = await import('./query-filters')

    const view = render(
      <QueryFilters
        definition={applicationQueryDefinition}
        fields={applicationFieldPresentation}
        value={{
          combinator: 'and',
          conditions: [
            {
              type: 'condition',
              field: 'followUpAt',
              operator: 'between',
              value: ['2026-07-20T09:30:00.000Z', '2026-07-22T17:00:00.000Z'],
            },
          ],
        }}
        onValueChange={() => undefined}
        defaultExpanded
      />
    )

    expect(
      view.getByRole('group', { name: 'Follow-up time value from' })
    ).toBeTruthy()
    expect(view.queryByText('2026-07-20T09:30:00.000Z')).toBeNull()
  })

  test('reports metadata-invalid state without removing it from the editor', async () => {
    const { QueryFilters } = await import('./query-filters')
    const resolvedStates: { readonly hasInvalidConditions: boolean }[] = []

    const view = render(
      <QueryFilters
        definition={applicationQueryDefinition}
        fields={applicationFieldPresentation}
        value={{
          combinator: 'and',
          conditions: [
            {
              type: 'condition',
              field: 'applicationStatus',
              operator: 'eq',
              value: 'not-a-real-status',
            },
          ],
        }}
        onValueChange={() => undefined}
        onResolvedStateChange={(state) => resolvedStates.push(state)}
        defaultExpanded
      />
    )

    await waitFor(() => {
      expect(resolvedStates.at(-1)?.hasInvalidConditions).toBe(true)
    })
    expect(view.getByLabelText('Application status value')).toBeTruthy()
  })

  test('shows and removes conditions whose fields are no longer available', async () => {
    const { QueryFilters } = await import('./query-filters')

    const Harness = () => {
      const [value, setValue] = React.useState<QueryFiltersState>({
        combinator: 'and',
        conditions: [
          {
            type: 'condition',
            field: 'retiredField',
            operator: 'eq',
            value: 'legacy',
          },
        ],
      })

      return (
        <QueryFilters
          definition={applicationQueryDefinition}
          fields={applicationFieldPresentation}
          value={value}
          onValueChange={setValue}
          defaultExpanded
        />
      )
    }

    const view = render(<Harness />)
    expect(view.getAllByText('retiredField').length).toBeGreaterThan(0)
    expect(view.getByText('This field is no longer available.')).toBeTruthy()

    fireEvent.click(
      view.getAllByRole('button', { name: 'Remove retiredField filter' })[0]
    )

    expect(
      view.queryByRole('button', { name: 'Remove retiredField filter' })
    ).toBeNull()
  })
})
