import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

import { PreparationPageFrame } from './page-frame'

afterEach(cleanup)

const renderFrame = (path: string, backLabel?: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <PreparationPageFrame
        applicationId="application-1"
        backLabel={backLabel}
        eyebrow="Workflow review"
        title="Review candidate"
        description="Review the generated candidate."
      >
        <div>Candidate</div>
      </PreparationPageFrame>
    </MemoryRouter>
  )

describe('PreparationPageFrame', () => {
  test('uses a safe internal workflow return path', () => {
    const view = renderFrame(
      '/applications/application-1/prepare?focus=review&back=%2Fworkflows%2Fbatch-1%2Fjobs%2Frun-1'
    )

    const link = view.getByRole('link', { name: 'Back to workflow' })
    expect(link.getAttribute('href')).toBe('/workflows/batch-1/jobs/run-1')
  })

  test('falls back to the application for an external return target', () => {
    const view = renderFrame(
      '/applications/application-1/prepare?back=https%3A%2F%2Fexample.test'
    )

    const link = view.getByRole('link', { name: 'Back to application' })
    expect(link.getAttribute('href')).toBe('/applications/application-1')
  })

  test('allows a focused screen to describe the same safe return target', () => {
    const view = renderFrame(
      '/applications/application-1/publish?back=%2Fapplications%2Fapplication-1%2Fprepare%3Ffocus%3Dreview',
      'Back to review'
    )

    const link = view.getByRole('link', { name: 'Back to review' })
    expect(link.getAttribute('href')).toBe(
      '/applications/application-1/prepare?focus=review'
    )
  })
})
