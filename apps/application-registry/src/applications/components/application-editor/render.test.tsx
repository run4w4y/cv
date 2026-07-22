import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { Application } from '@cv/application-registry-entity'
import { cleanup, fireEvent, waitFor } from '@testing-library/react'

import { renderWithRegistry } from '../../../test/render-with-registry'
import { ApplicationEditDialog } from './render'

const originalFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
})

const application: Application = {
  applicationStatus: 'not_started',
  appliedAt: null,
  company: 'Example',
  createdAt: '2026-07-16T09:00:00.000Z',
  followUpAt: null,
  id: 'application-1',
  listingAvailability: 'open',
  listingCheckedAt: '2026-07-16T09:30:00.000Z',
  listingClosedCandidateAt: null,
  listingConfidence: 'high',
  listingConsecutiveClosedChecks: 0,
  listingReasonCode: null,
  location: null,
  personalPriority: null,
  postingUrl: 'https://example.test/jobs/one',
  role: 'Staff Engineer',
  targetStage: 'apply_next',
  updatedAt: '2026-07-16T09:30:00.000Z',
  updatedRevision: 2,
  version: 2,
}

describe('ApplicationEditDialog', () => {
  test('uses the latest version after conflict recovery', async () => {
    const latest = { ...application, company: 'Latest company', version: 5 }
    const saved = { ...latest, company: 'Saved company', version: 6 }
    const requests: Request[] = []
    let patchCount = 0
    globalThis.fetch = mock(async (input: string | URL | Request, init) => {
      const request = new Request(String(input), init)
      requests.push(request)
      if (request.method === 'GET') return Response.json(latest)
      patchCount += 1
      if (patchCount === 1) {
        return Response.json(
          {
            code: 'conflict',
            message: 'The application was updated elsewhere.',
          },
          { status: 409 }
        )
      }
      return Response.json({
        annualCompensation: null,
        application: saved,
        labels: [],
      })
    }) as unknown as typeof fetch
    const onSaved = mock(() => undefined)
    const view = renderWithRegistry(
      <ApplicationEditDialog application={application} onSaved={onSaved} />
    )

    fireEvent.click(view.getByRole('button', { name: 'Edit' }))
    fireEvent.click(view.getByRole('button', { name: 'Save changes' }))
    await view.findByText('The application was updated elsewhere.')
    fireEvent.click(
      view.getByRole('button', { name: 'Reload latest application' })
    )
    await waitFor(() =>
      expect(
        (view.getByRole('textbox', { name: /^Company/ }) as HTMLInputElement)
          .value
      ).toBe('Latest company')
    )
    fireEvent.change(view.getByRole('textbox', { name: /^Company/ }), {
      target: { value: 'Saved company' },
    })
    fireEvent.click(view.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))

    const patches = requests.filter(({ method }) => method === 'PATCH')
    expect(
      await Promise.all(patches.map((request) => request.clone().json()))
    ).toEqual([
      expect.objectContaining({ expectedVersion: 2 }),
      expect.objectContaining({ expectedVersion: 5 }),
    ])
    expect(patches[0]?.headers.get('idempotency-key')).toBeTruthy()
    expect(patches[1]?.headers.get('idempotency-key')).not.toBe(
      patches[0]?.headers.get('idempotency-key')
    )
  })
})
