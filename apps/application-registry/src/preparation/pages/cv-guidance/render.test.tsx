import { afterEach, describe, expect, test } from 'bun:test'
import { cvGenerationGuidanceTestFixture } from '@cv/application-preparation-workflow/test-support'
import { cleanup, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import { HeaderActionsProvider } from '@/shell/header-actions'
import { renderWithRegistry } from '@/test/render-with-registry'
import { LoadedCvGuidancePage } from './render'

const renderPage = () => {
  const headerTarget = document.createElement('div')
  headerTarget.dataset.testid = 'cv-guidance-header-target'
  document.body.append(headerTarget)
  const result = renderWithRegistry(
    <MemoryRouter>
      <HeaderActionsProvider target={headerTarget}>
        <LoadedCvGuidancePage
          loaded={{
            factsReleaseId: 'facts-release-1',
            guidance: cvGenerationGuidanceTestFixture,
          }}
        />
      </HeaderActionsProvider>
    </MemoryRouter>
  )
  return Object.assign(result, { headerTarget })
}

afterEach(() => {
  cleanup()
  document
    .querySelectorAll('[data-testid="cv-guidance-header-target"]')
    .forEach((element) => {
      element.remove()
    })
})

describe('CV guidance page', () => {
  test('presents guidance as user-facing grouped fields without schema diagnostics', () => {
    const view = renderPage()

    expect(view.getByText('CV writing guidance')).toBeTruthy()
    expect(view.getByText('Overall guidance')).toBeTruthy()
    expect(view.getByText('Profile')).toBeTruthy()
    expect(view.getByText('Experience')).toBeTruthy()
    expect(view.getByText('Additional sections')).toBeTruthy()
    expect(view.container.textContent).not.toContain('Contract overview')
    expect(view.container.textContent).not.toContain('JSON Schema')
    expect(view.container.textContent).not.toContain('/person/summary')
    expect(
      within(view.headerTarget).getByRole('button', {
        name: 'Edit guidance',
      })
    ).toBeTruthy()
  })

  test('cancels drafts and applies a valid release-keyed override', () => {
    const view = renderPage()
    const header = within(view.headerTarget)

    fireEvent.click(header.getByRole('button', { name: 'Edit guidance' }))
    const instruction = view.getByLabelText('Overall instruction')
    fireEvent.change(instruction, {
      target: { value: 'Draft that should be discarded.' },
    })
    fireEvent.click(header.getByRole('button', { name: 'Cancel' }))

    expect(view.queryByLabelText('Overall instruction')).toBeNull()
    expect(view.container.textContent).not.toContain(
      'Draft that should be discarded.'
    )

    fireEvent.click(header.getByRole('button', { name: 'Edit guidance' }))
    fireEvent.change(view.getByLabelText('Overall instruction'), {
      target: { value: 'Applied client override.' },
    })
    fireEvent.click(header.getByRole('button', { name: 'Apply override' }))

    expect(view.getByText('Applied client override.')).toBeTruthy()
    expect(view.getByText('Client override')).toBeTruthy()
    expect(
      header.getByRole('button', { name: 'Restore release default' })
    ).toBeTruthy()

    fireEvent.click(
      header.getByRole('button', { name: 'Restore release default' })
    )
    expect(view.queryByText('Applied client override.')).toBeNull()
    expect(view.getByText('Release default')).toBeTruthy()
  })

  test('does not apply an invalid draft', () => {
    const view = renderPage()
    const header = within(view.headerTarget)

    fireEvent.click(header.getByRole('button', { name: 'Edit guidance' }))
    fireEvent.change(view.getByLabelText('Guidance name'), {
      target: { value: '' },
    })

    expect(view.getByRole('alert')).toBeTruthy()
    expect(
      header
        .getByRole('button', { name: 'Apply override' })
        .hasAttribute('disabled')
    ).toBe(true)
  })
})
