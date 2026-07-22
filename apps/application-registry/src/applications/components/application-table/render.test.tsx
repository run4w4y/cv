import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { ApplicationListItem } from '@cv/application-registry-api-contract'
import type { SortingState } from '@tanstack/react-table'
import { cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { renderWithRegistry } from '../../../test/render-with-registry'
import { ApplicationsTable } from './render'

const originalFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
})

const application = {
  id: 'application-1',
  postingUrl: 'https://example.test/jobs/one',
  company: 'Example',
  role: 'Staff Engineer',
  location: 'Remote',
  applicationStatus: 'not_started',
  targetStage: 'apply_next',
  personalPriority: 'high',
  followUpAt: '2026-07-20T09:30:00.000Z',
  appliedAt: null,
  listingAvailability: 'open',
  listingCheckedAt: '2026-07-15T09:30:00.000Z',
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  version: 1,
  updatedRevision: 4,
  createdAt: '2026-07-01T09:30:00.000Z',
  updatedAt: '2026-07-15T09:30:00.000Z',
  annualCompensation: {
    currencyCode: 'USD',
    minimumMinor: 15_000_000,
    maximumMinor: 18_000_000,
  },
  counts: { notes: 2 },
  labels: ['TypeScript', 'Remote'],
  latestActivity: {
    kind: 'status_changed',
    occurredAt: '2026-07-15T09:30:00.000Z',
  },
} as ApplicationListItem

describe('ApplicationsTable', () => {
  test('edits the complete row as one draft and saves one aggregate mutation', async () => {
    const sorting: SortingState = []
    const requests: Request[] = []
    globalThis.fetch = mock(async (input: string | URL | Request, init) => {
      requests.push(new Request(String(input), init))
      return Response.json({
        application: {
          ...application,
          company: 'Updated Example',
          version: 2,
        },
        annualCompensation: application.annualCompensation,
        labels: application.labels,
      })
    }) as unknown as typeof fetch
    const view = renderWithRegistry(
      <MemoryRouter>
        <ApplicationsTable
          data={[application]}
          loading={false}
          sorting={sorting}
          onSortingChange={() => undefined}
          density="comfortable"
          onDensityChange={() => undefined}
          columnVisibility={{}}
          onColumnVisibilityChange={() => undefined}
          hasNextPage={false}
          loadingMore={false}
          onLoadMore={() => undefined}
          availableLabels={['Remote', 'TypeScript']}
        />
      </MemoryRouter>
    )

    const table = view.getByRole('table')
    const headers = within(table).getAllByRole('columnheader')
    const cells = within(table).getAllByRole('cell')

    expect(headers).toHaveLength(12)
    expect(cells).toHaveLength(12)
    expect(table.style.width).toBe('2610px')
    expect(view.getByText('Annual compensation')).toBeTruthy()
    expect(view.getByText('Updated')).toBeTruthy()
    expect(
      view.container.querySelector('[data-slot="applications-table"]')
    ).toBeTruthy()
    expect(
      view.queryByRole('link', { name: /open example, staff/i })
    ).toBeNull()
    expect(
      view.getByRole('link', { name: 'Open Example application' })
    ).toBeTruthy()
    expect(view.queryByRole('combobox')).toBeNull()

    fireEvent.click(view.getByRole('button', { name: 'Edit Example row' }))
    expect(
      view.getByRole('combobox', { name: 'Application status' })
    ).toBeTruthy()
    expect(
      view.getByRole('combobox', { name: 'Annual compensation currency' })
    ).toBeTruthy()
    const companyInput = (await view.findByPlaceholderText(
      'Company'
    )) as HTMLInputElement
    const roleTextarea = view.container.querySelector('textarea')
    const statusInput = view.container.querySelector(
      'input[name="applicationStatus"]'
    ) as HTMLInputElement | null
    expect(roleTextarea?.tagName).toBe('TEXTAREA')
    expect(companyInput.form).not.toBeNull()
    expect(roleTextarea?.form).toBe(companyInput.form)
    expect(statusInput?.form).toBe(companyInput.form)
    expect(companyInput.form?.noValidate).toBe(true)
    fireEvent.change(companyInput, {
      target: { value: 'Updated Example' },
    })
    const saveButton = view.getByRole('button', {
      name: 'Save Example row',
    }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(false)
    expect(saveButton.form).toBe(companyInput.form)
    fireEvent.click(saveButton)

    await waitFor(() => expect(requests).toHaveLength(1))
    expect(requests[0]?.method).toBe('PATCH')
    expect(requests[0]?.url).toContain('/applications/application-1')
    expect(await requests[0]?.json()).toMatchObject({
      company: 'Updated Example',
      expectedVersion: 1,
      labels: ['TypeScript', 'Remote'],
    })
    await waitFor(() =>
      expect(
        view.getByRole('button', { name: 'Edit Example row' })
      ).toBeTruthy()
    )
  })
})
