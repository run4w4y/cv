import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import { HeaderActionsProvider } from '@/shell/header-actions'

import {
  DocumentWorkspaceError,
  DocumentWorkspaceSkeleton,
} from './workspace-states'

afterEach(() => {
  cleanup()
  for (const target of Array.from(
    document.querySelectorAll('[data-workspace-test-header]')
  )) {
    target.remove()
  }
})

describe('document workspace boundary states', () => {
  test('preserves the workspace layout while the document is loading', () => {
    const headerTarget = document.createElement('div')
    headerTarget.dataset.workspaceTestHeader = ''
    document.body.append(headerTarget)

    const view = render(
      <HeaderActionsProvider target={headerTarget}>
        <DocumentWorkspaceSkeleton />
      </HeaderActionsProvider>
    )

    const workspace = view.getByRole('region', {
      name: 'Loading document workspace',
    })
    expect(workspace.getAttribute('aria-busy')).toBe('true')
    expect(workspace.querySelector('main')).toBeTruthy()
    expect(workspace.querySelector('aside')).toBeTruthy()
    expect(
      workspace.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(12)
    expect(
      headerTarget.querySelectorAll('[data-slot="skeleton"]')
    ).toHaveLength(4)
    expect(view.queryByRole('alert')).toBeNull()
  })

  test('uses an explicit alert only for a genuine loading failure', () => {
    const view = render(
      <MemoryRouter>
        <DocumentWorkspaceError
          backTo="/preparation/job-1"
          description="The saved revision is no longer available."
          title="Could not load this draft"
        />
      </MemoryRouter>
    )

    const alert = view.getByRole('alert')
    expect(alert.textContent).toContain('Could not load this draft')
    expect(alert.textContent).toContain(
      'The saved revision is no longer available.'
    )
    expect(alert.getAttribute('aria-busy')).toBeNull()
    expect(view.queryByRole('region')).toBeNull()
    expect(
      view.getByText('Return to workflow').closest<HTMLAnchorElement>('a')?.href
    ).toBe('http://localhost/preparation/job-1')
  })
})
