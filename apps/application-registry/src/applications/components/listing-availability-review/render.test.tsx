import { afterEach, describe, expect, mock, test } from 'bun:test'
import type {
  Application,
  ApplicationListingCheck,
} from '@cv/application-registry-entity'
import { cleanup, fireEvent, waitFor } from '@testing-library/react'
import { renderWithRegistry } from '../../../test/render-with-registry'
import { ListingAvailabilityReviewDialog } from './render'

const originalFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
})

const application: Application = {
  applicationStatus: 'not_started',
  appliedAt: null,
  canonicalUrl: 'https://example.test/jobs/one',
  company: 'Example',
  createdAt: '2026-07-16T09:00:00.000Z',
  followUpAt: null,
  id: 'application-1',
  jobKey: 'web:one',
  lastContactAt: null,
  listingAvailability: 'suspected_closed',
  listingCheckedAt: '2026-07-16T09:30:00.000Z',
  listingClosedCandidateAt: '2026-07-16T09:30:00.000Z',
  listingConfidence: 'medium',
  listingConsecutiveClosedChecks: 1,
  listingReasonCode: 'explicit_closed_text',
  location: null,
  personalPriority: null,
  role: 'Staff Engineer',
  source: 'web',
  sourceJobId: 'one',
  targetStage: 'apply_next',
  updatedAt: '2026-07-16T09:30:00.000Z',
  updatedRevision: 2,
  version: 2,
}

const listingCheck: ApplicationListingCheck = {
  applicationId: application.id,
  checkedAt: application.updatedAt,
  checkerVersion: 'manual',
  confidence: 'high',
  contentHash: null,
  evidence: [],
  finalUrl: application.canonicalUrl,
  httpStatus: 200,
  id: 'check-1',
  nextCheckAt: '2026-07-23T09:30:00.000Z',
  operationId: 'check-operation-1',
  outcome: 'open',
  provider: 'manual',
  receivedAt: application.updatedAt,
  reasonCode: 'provider_open',
  recommendedAction: 'keep',
  requestedUrl: application.canonicalUrl,
  runId: null,
}

describe('ListingAvailabilityReviewDialog', () => {
  test('explains archival consequences and marks a suspected listing open', async () => {
    const requests: Request[] = []
    const onResolved = mock(() => undefined)
    const updated = {
      ...application,
      listingAvailability: 'open' as const,
      listingClosedCandidateAt: null,
      listingConsecutiveClosedChecks: 0,
      version: 3,
    }
    globalThis.fetch = mock(async (input: string | URL | Request, init) => {
      requests.push(new Request(String(input), init))
      return Response.json({
        application: updated,
        archived: false,
        check: listingCheck,
        replayed: false,
      })
    }) as unknown as typeof fetch

    const view = renderWithRegistry(
      <ListingAvailabilityReviewDialog
        application={application}
        onResolved={onResolved}
      />
    )

    fireEvent.click(
      view.getByRole('button', {
        name: 'Review listing availability for Example: Suspected closed',
      })
    )

    expect(
      await view.findByRole('heading', { name: 'Review listing availability' })
    ).toBeTruthy()
    expect(
      view.getByRole('button', { name: /Confirm closed & archive/ })
    ).toBeTruthy()
    expect(
      view.getByText(/archives this unsubmitted application/i)
    ).toBeTruthy()

    fireEvent.click(view.getByRole('button', { name: /Mark open/ }))

    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(updated))
    expect(requests).toHaveLength(1)
    expect(requests[0]?.method).toBe('PUT')
    expect(await requests[0]?.json()).toMatchObject({
      expectedVersion: 2,
      resolution: 'open',
    })
  })

  test('keeps the opening version and reuses an operation id only for the same resolution', async () => {
    const requests: Request[] = []
    globalThis.fetch = mock(async (input: string | URL | Request, init) => {
      requests.push(new Request(String(input), init))
      return Response.json(
        {
          code: 'service_unavailable',
          message: 'Temporarily unavailable',
        },
        { status: 503 }
      )
    }) as unknown as typeof fetch

    const view = renderWithRegistry(
      <ListingAvailabilityReviewDialog application={application} />
    )
    fireEvent.click(
      view.getByRole('button', {
        name: 'Review listing availability for Example: Suspected closed',
      })
    )
    view.rerender(
      <ListingAvailabilityReviewDialog
        application={{ ...application, version: 9 }}
      />
    )

    fireEvent.click(view.getByRole('button', { name: /Mark open/ }))
    await view.findByText('Temporarily unavailable')
    fireEvent.click(view.getByRole('button', { name: /Mark open/ }))
    await waitFor(() => expect(requests).toHaveLength(2))
    fireEvent.click(
      view.getByRole('button', { name: /Confirm closed & archive/ })
    )
    await waitFor(() => expect(requests).toHaveLength(3))

    const bodies = await Promise.all(requests.map((request) => request.json()))
    expect(bodies.map(({ expectedVersion }) => expectedVersion)).toEqual([
      2, 2, 2,
    ])
    expect(bodies[1]?.operationId).toBe(bodies[0]?.operationId)
    expect(bodies[2]?.operationId).not.toBe(bodies[0]?.operationId)
  })

  test('locks stale actions after a conflict and reloads before the dialog can be used again', async () => {
    const latest = { ...application, version: 5 }
    const requests: Request[] = []
    globalThis.fetch = mock(async (input: string | URL | Request, init) => {
      const request = new Request(String(input), init)
      requests.push(request)
      if (request.method === 'PUT') {
        return Response.json(
          {
            code: 'conflict',
            message: 'The application was updated elsewhere.',
          },
          { status: 409 }
        )
      }
      return Response.json(latest)
    }) as unknown as typeof fetch

    const view = renderWithRegistry(
      <ListingAvailabilityReviewDialog application={application} />
    )
    fireEvent.click(
      view.getByRole('button', {
        name: 'Review listing availability for Example: Suspected closed',
      })
    )
    fireEvent.click(view.getByRole('button', { name: /Mark open/ }))

    await view.findByText('The application was updated elsewhere.')
    expect(
      (view.getByRole('button', { name: /Mark open/ }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    expect(
      (
        view.getByRole('button', {
          name: /Confirm closed & archive/,
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)

    fireEvent.click(
      view.getByRole('button', { name: 'Reload latest application' })
    )
    await waitFor(() => {
      expect(requests.map(({ method }) => method)).toEqual(['PUT', 'GET'])
    })

    expect(view.queryByText(/Could not reload/)).toBeNull()
    expect(view.queryByText(/Could not reload/)).toBeNull()
  })
})
