import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

import { renderWithRegistry } from '../../../test/render-with-registry'
import { ApplicationDetailsPage } from './render'

const originalFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
})

const application = {
  id: 'application-1',
  jobKey: 'web:one',
  source: 'web',
  sourceJobId: 'one',
  canonicalUrl: 'https://example.test/jobs/one',
  company: 'Example',
  role: 'Staff Engineer',
  location: 'Remote',
  applicationStatus: 'technical_screen',
  targetStage: 'apply_next',
  personalPriority: 'high',
  followUpAt: null,
  appliedAt: '2026-07-10T09:30:00.000Z',
  lastContactAt: null,
  listingAvailability: 'open',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  version: 3,
  updatedRevision: 9,
  createdAt: '2026-07-01T09:30:00.000Z',
  updatedAt: '2026-07-16T09:30:00.000Z',
}

describe('ApplicationDetailsPage', () => {
  test('loads related events and leaves breadcrumbs to the topbar', async () => {
    const eventRequests: string[] = []
    const compensationRequests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/compensations')) {
        compensationRequests.push(url)
        return Response.json({ items: [] })
      }
      if (url.includes('/v1/applications/application-1/events')) {
        eventRequests.push(url)
        return Response.json({
          items: [
            {
              id: 'event-1',
              applicationId: 'application-1',
              kind: 'stage_changed',
              revision: 9,
              occurredAt: '2026-07-16T09:30:00.000Z',
              recordedAt: '2026-07-16T09:31:00.000Z',
              payload: { nextStatus: 'technical_screen' },
              operationId: 'operation-1',
              deviceId: null,
              canonicalUrl: application.canonicalUrl,
              company: application.company,
              role: application.role,
            },
          ],
        })
      }
      return Response.json(application)
    }) as unknown as typeof fetch

    const view = renderWithRegistry(
      <MemoryRouter initialEntries={['/applications/application-1']}>
        <Routes>
          <Route
            path="/applications/:applicationId"
            element={<ApplicationDetailsPage />}
          />
        </Routes>
      </MemoryRouter>
    )

    expect(await view.findByText('Related events')).toBeTruthy()
    expect(await view.findByText('Stage changed')).toBeTruthy()
    expect(view.container.querySelector('[data-slot="breadcrumb"]')).toBeNull()
    await waitFor(() => expect(eventRequests).toHaveLength(1))
    expect(eventRequests[0]).toContain(
      '/api/registry/v1/applications/application-1/events'
    )

    fireEvent.click(
      view.getByRole('combobox', { name: 'Compensation currency' })
    )
    fireEvent.click(await view.findByRole('option', { name: /^USD/ }))
    await waitFor(() => expect(compensationRequests).toHaveLength(2))
    expect(
      new URL(
        compensationRequests[1] ?? '',
        'https://registry.test'
      ).searchParams.get('currency')
    ).toBe('USD')
  })
})
