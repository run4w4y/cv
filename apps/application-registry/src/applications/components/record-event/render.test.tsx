import { afterEach, describe, expect, mock, test } from 'bun:test'
import type {
  Application,
  ApplicationEvent,
} from '@cv/application-registry-entity'
import { cleanup, fireEvent, waitFor } from '@testing-library/react'

import { renderWithRegistry } from '../../../test/render-with-registry'
import { RecordEventDialog, recordEventRequest } from './render'

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
  listingAvailability: 'open',
  listingCheckedAt: '2026-07-16T09:30:00.000Z',
  listingClosedCandidateAt: null,
  listingConfidence: 'high',
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
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

describe('recordEventRequest', () => {
  test('builds informational events without a status transition', () => {
    expect(
      recordEventRequest(
        {
          kind: 'contact_logged',
          occurredAt: new Date('2026-07-16T09:00:00.000Z'),
          nextApplicationStatus: 'preparing',
          payload: '{"channel":"email"}',
        },
        4,
        'operation-1'
      )
    ).toEqual({
      kind: 'contact_logged',
      occurredAt: '2026-07-16T09:00:00.000Z',
      payload: { channel: 'email' },
      operationId: 'operation-1',
      deviceId: null,
      expectedVersion: 4,
    })
  })

  test('requires a next status for status-changing event kinds', () => {
    expect(
      recordEventRequest(
        {
          kind: 'submitted',
          occurredAt: new Date('2026-07-16T09:00:00.000Z'),
          nextApplicationStatus: 'applied',
          payload: '',
        },
        5,
        'operation-2'
      )
    ).toMatchObject({
      kind: 'submitted',
      nextApplicationStatus: 'applied',
      payload: {},
    })
  })

  test('rejects malformed payload JSON before transport', () => {
    expect(() =>
      recordEventRequest(
        {
          kind: 'research_updated',
          occurredAt: new Date(),
          nextApplicationStatus: 'not_started',
          payload: '{broken',
        },
        1,
        'operation-3'
      )
    ).toThrow('valid JSON')
  })
})

describe('RecordEventDialog', () => {
  test('captures the opening version and reloads a conflict before another session', async () => {
    const latest = {
      ...application,
      applicationStatus: 'interview_loop' as const,
      version: 5,
    }
    const requests: Request[] = []
    globalThis.fetch = mock(async (input: string | URL | Request, init) => {
      const request = new Request(String(input), init)
      requests.push(request)
      if (request.method === 'GET') return Response.json(latest)
      return Response.json(
        {
          code: 'conflict',
          message: 'The application was updated elsewhere.',
        },
        { status: 409 }
      )
    }) as unknown as typeof fetch

    const view = renderWithRegistry(
      <RecordEventDialog application={application} />
    )
    fireEvent.click(view.getByRole('button', { name: 'Record event' }))
    view.rerender(
      <RecordEventDialog application={{ ...application, version: 9 }} />
    )
    fireEvent.click(view.getByRole('button', { name: 'Record event' }))

    await view.findByText('The application was updated elsewhere.')
    expect(
      (view.getByRole('button', { name: 'Record event' }) as HTMLButtonElement)
        .disabled
    ).toBe(true)
    fireEvent.click(
      view.getByRole('button', { name: 'Reload latest and restart' })
    )
    await waitFor(() => {
      expect(requests.map(({ method }) => method)).toEqual(['POST', 'GET'])
    })
    const firstRequest = requests.find(({ method }) => method === 'POST')
    expect(await firstRequest?.json()).toMatchObject({ expectedVersion: 2 })
    expect(view.queryByText(/Could not reload/)).toBeNull()
  })

  test('synchronizes the detail cache and callback from the successful response application', async () => {
    const saved = {
      ...application,
      applicationStatus: 'interview_loop' as const,
      version: 3,
    }
    const savedEvent: ApplicationEvent = {
      applicationId: application.id,
      deviceId: null,
      id: 'event-1',
      kind: 'contact_logged',
      occurredAt: application.updatedAt,
      operationId: 'event-operation-1',
      payload: {},
      recordedAt: application.updatedAt,
      revision: 3,
    }
    globalThis.fetch = mock(async () =>
      Response.json({
        application: saved,
        event: savedEvent,
        replayed: false,
      })
    ) as unknown as typeof fetch
    const onSaved = mock(() => undefined)

    const view = renderWithRegistry(
      <RecordEventDialog application={application} onSaved={onSaved} />
    )
    fireEvent.click(view.getByRole('button', { name: 'Record event' }))
    fireEvent.click(view.getByRole('button', { name: 'Record event' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
  })
})
