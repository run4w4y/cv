import { afterEach, describe, expect, mock, test } from 'bun:test'
import type { Application } from '@cv/application-registry-entity'
import { cleanup, fireEvent, waitFor } from '@testing-library/react'

import { renderWithRegistry } from '../../../test/render-with-registry'
import { ApplicationEditDialog, DeleteApplicationDialog } from './render'

const originalFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
})

const application: Application = {
  applicationStatus: 'not_started',
  appliedAt: null,
  canonicalUrl: 'https://example.test/jobs/one',
  category: null,
  company: 'Example',
  createdAt: '2026-07-16T09:00:00.000Z',
  details: null,
  fitScore: null,
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
  openStatus: null,
  personalPriority: null,
  recommendedAction: null,
  remotePolicy: null,
  researchPriority: null,
  role: 'Staff Engineer',
  source: 'web',
  sourceConfidence: null,
  sourceJobId: 'one',
  targetStage: 'apply_next',
  technologyStack: null,
  updatedAt: '2026-07-16T09:30:00.000Z',
  updatedRevision: 2,
  version: 2,
}

describe('ApplicationEditDialog', () => {
  test('keeps the draft version, locks a conflict, and starts a fresh session from reload', async () => {
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
    fireEvent.change(view.getByRole('textbox', { name: /^Company/ }), {
      target: { value: 'Draft company' },
    })
    view.rerender(
      <ApplicationEditDialog
        application={{ ...application, version: 9 }}
        onSaved={onSaved}
      />
    )
    fireEvent.click(view.getByRole('button', { name: 'Save changes' }))

    await view.findByText('The application was updated elsewhere.')
    expect(
      (
        view.getByRole('button', {
          name: 'Save changes',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    const firstPatch = requests.find(({ method }) => method === 'PATCH')
    expect(await firstPatch?.clone().json()).toMatchObject({
      expectedVersion: 2,
    })

    fireEvent.click(
      view.getByRole('button', { name: 'Reload latest application' })
    )
    await waitFor(() => {
      expect(
        (view.getByRole('textbox', { name: /^Company/ }) as HTMLInputElement)
          .value
      ).toBe('Latest company')
      expect(
        (
          view.getByRole('button', {
            name: 'Save changes',
          }) as HTMLButtonElement
        ).disabled
      ).toBe(false)
    })
    fireEvent.change(view.getByRole('textbox', { name: /^Company/ }), {
      target: { value: 'Saved company' },
    })
    fireEvent.click(view.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved))
    const patchBodies = await Promise.all(
      requests
        .filter(({ method }) => method === 'PATCH')
        .map((request) => request.json())
    )
    expect(patchBodies.map(({ expectedVersion }) => expectedVersion)).toEqual([
      2, 5,
    ])
    expect(patchBodies[1]?.operationId).not.toBe(patchBodies[0]?.operationId)
  })
})

describe('DeleteApplicationDialog', () => {
  test('prevents a stale delete retry until the latest application has been reloaded', async () => {
    const latest = { ...application, version: 5 }
    const requests: Request[] = []
    globalThis.fetch = mock(async (input: string | URL | Request, init) => {
      const request = new Request(String(input), init)
      requests.push(request)
      if (request.method === 'DELETE') {
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
      <DeleteApplicationDialog
        application={application}
        onDeleted={() => undefined}
      />
    )
    fireEvent.click(view.getByRole('button', { name: 'Delete' }))
    view.rerender(
      <DeleteApplicationDialog
        application={{ ...application, version: 9 }}
        onDeleted={() => undefined}
      />
    )
    fireEvent.click(view.getByRole('button', { name: 'Delete permanently' }))

    await view.findByText('The application was updated elsewhere.')
    expect(
      (
        view.getByRole('button', {
          name: 'Delete permanently',
        }) as HTMLButtonElement
      ).disabled
    ).toBe(true)
    expect(
      new URL(requests[0]?.url ?? '').searchParams.get('expectedVersion')
    ).toBe('2')

    fireEvent.click(
      view.getByRole('button', { name: 'Reload latest and review' })
    )
    await waitFor(() => {
      expect(requests.map(({ method }) => method)).toEqual(['DELETE', 'GET'])
    })
    expect(view.queryByText(/Could not reload/)).toBeNull()
  })
})
