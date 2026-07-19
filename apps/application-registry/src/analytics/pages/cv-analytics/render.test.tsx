import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router'

import { renderWithRegistry } from '../../../test/render-with-registry'
import { CvAnalyticsPage } from './render'

const originalFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
})

describe('CvAnalyticsPage', () => {
  test('renders application-owned CV analytics for the default range', async () => {
    const requests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      requests.push(String(input))
      return Response.json({
        countries: [{ name: 'Germany', visits: 2 }],
        generatedAt: '2026-07-19T12:00:00.000Z',
        items: [
          {
            application: {
              appliedAt: null,
              applicationStatus: 'preparing',
              canonicalUrl: 'https://example.test/jobs/one',
              company: 'Example Company',
              createdAt: '2026-07-01T00:00:00.000Z',
              id: 'application-1',
              listingAvailability: 'open',
              role: 'Platform Engineer',
            },
            countries: [{ name: 'Germany', visits: 2 }],
            firstSeenOn: '2026-07-18',
            labels: ['priority'],
            lastSeenOn: '2026-07-19',
            link: {
              contentEntryId: 'content-1',
              createdAt: '2026-07-10T00:00:00.000Z',
              enabled: true,
              id: 'link-1',
              locale: 'en',
              updatedAt: '2026-07-11T00:00:00.000Z',
            },
            series: [
              { at: '2026-07-18', pageViews: 3, visits: 2 },
              { at: '2026-07-19', pageViews: 2, visits: 1 },
            ],
            totals: { pageViews: 5, visits: 3 },
          },
          {
            application: {
              appliedAt: null,
              applicationStatus: 'preparing',
              canonicalUrl: 'https://example.test/jobs/one',
              company: 'Example Company',
              createdAt: '2026-07-01T00:00:00.000Z',
              id: 'application-1',
              listingAvailability: 'open',
              role: 'Platform Engineer',
            },
            countries: [{ name: 'Germany', visits: 2 }],
            firstSeenOn: '2026-07-19',
            labels: ['priority'],
            lastSeenOn: '2026-07-19',
            link: {
              contentEntryId: 'content-2',
              createdAt: '2026-07-10T00:00:00.000Z',
              enabled: true,
              id: 'link-2',
              locale: 'de',
              updatedAt: '2026-07-11T00:00:00.000Z',
            },
            series: [{ at: '2026-07-19', pageViews: 4, visits: 2 }],
            totals: { pageViews: 4, visits: 2 },
          },
        ],
        range: {
          from: '2026-07-12T12:00:00.000Z',
          granularity: 'day',
          to: '2026-07-19T12:00:00.000Z',
        },
        series: [
          { at: '2026-07-18', pageViews: 3, visits: 2 },
          { at: '2026-07-19', pageViews: 2, visits: 1 },
        ],
        summary: {
          enabledLinks: 2,
          pageViews: 9,
          publishedLinks: 2,
          unviewedLinks: 0,
          viewedLinks: 2,
          visits: 5,
        },
      })
    }) as unknown as typeof fetch

    const view = renderWithRegistry(
      <BrowserRouter>
        <CvAnalyticsPage />
      </BrowserRouter>
    )

    expect(
      await view.findAllByRole('link', { name: 'Example Company' })
    ).toHaveLength(2)
    expect(view.getAllByText('Platform Engineer')).toHaveLength(2)
    expect(view.getByRole('img', { name: 'CV traffic over time' })).toBeTruthy()
    expect(
      view.getByRole('img', { name: 'Viewed and unviewed published CVs' })
    ).toBeTruthy()
    expect(
      within(
        view.getByRole('table', { name: 'Most-viewed applications' })
      ).getByRole('row', {
        name: 'Example Company · Platform Engineer 9',
      })
    ).toBeTruthy()
    expect(view.container.textContent).not.toContain('/c/')
    expect(view.container.textContent).not.toContain('secret')
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(
      new URL(requests[0] ?? '', 'https://registry.test').searchParams.get(
        'days'
      )
    ).toBe('7')
  })

  test('stops showing the loading state after an initial request failure', async () => {
    globalThis.fetch = mock(async () =>
      Response.json(
        {
          code: 'service_unavailable',
          message: 'Analytics are unavailable.',
        },
        { status: 503 }
      )
    ) as unknown as typeof fetch

    const view = renderWithRegistry(
      <BrowserRouter>
        <CvAnalyticsPage />
      </BrowserRouter>
    )

    expect(await view.findByText('Could not load CV analytics')).toBeTruthy()
    expect(
      view.queryByRole('status', { name: 'Loading CV analytics' })
    ).toBeNull()
  })
})
