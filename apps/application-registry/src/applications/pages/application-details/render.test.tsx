import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'

import { renderWithRegistry } from '../../../test/render-with-registry'
import { ApplicationDetailsPage } from './render'

const originalFetch = globalThis.fetch
afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
})

const application = {
  applicationStatus: 'technical_screen',
  appliedAt: '2026-07-10T09:30:00.000Z',
  company: 'Example',
  createdAt: '2026-07-01T09:30:00.000Z',
  followUpAt: null,
  id: 'application-1',
  listingAvailability: 'open',
  listingCheckedAt: null,
  listingClosedCandidateAt: null,
  listingConfidence: null,
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  location: 'Remote',
  personalPriority: 'high',
  postingUrl: 'https://example.test/jobs/one',
  role: 'Staff Engineer',
  targetStage: 'apply_next',
  updatedAt: '2026-07-16T09:30:00.000Z',
  updatedRevision: 9,
  version: 3,
}

describe('ApplicationDetailsPage', () => {
  test('loads backend-issued activities', async () => {
    const activityRequests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (url.includes('/compensations')) return Response.json({ items: [] })
      if (url.includes('/activities')) {
        activityRequests.push(url)
        return Response.json({
          items: [
            {
              actor: 'system',
              applicationId: application.id,
              id: 'activity-1',
              kind: 'status_changed',
              occurredAt: application.updatedAt,
              payload: { nextStatus: 'technical_screen' },
              revision: 9,
              source: 'management',
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

    expect(await view.findByText('Related activities')).toBeTruthy()
    expect(await view.findByText('Status changed')).toBeTruthy()
    expect(activityRequests[0]).toContain(
      '/api/registry/applications/application-1/activities'
    )
  })
})
