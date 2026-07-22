import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { BrowserRouter } from 'react-router'

import { HeaderActionsProvider } from '../../../shell/header-actions'
import { renderWithRegistry } from '../../../test/render-with-registry'
import { CvAnalyticsPage } from './render'

const originalFetch = globalThis.fetch

const emptyAnalyticsResponse = {
  availability: {
    from: '2026-06-19',
    to: '2026-07-19',
  },
  countries: [],
  generatedAt: '2026-07-19T12:00:00.000Z',
  items: [],
  range: {
    from: '2026-07-17T00:00:00.000Z',
    granularity: 'day',
    to: '2026-07-19T12:00:00.000Z',
  },
  series: [
    { at: '2026-07-17', pageViews: 0, visits: 0 },
    { at: '2026-07-18', pageViews: 0, visits: 0 },
    { at: '2026-07-19', pageViews: 0, visits: 0 },
  ],
  summary: {
    enabledLinks: 0,
    pageViews: 0,
    publishedLinks: 0,
    unviewedLinks: 0,
    viewedLinks: 0,
    visits: 0,
  },
} as const

const renderAnalyticsPage = () => {
  const headerTarget = document.createElement('div')
  headerTarget.dataset.testid = 'analytics-header-target'
  document.body.append(headerTarget)
  const result = renderWithRegistry(
    <BrowserRouter>
      <HeaderActionsProvider target={headerTarget}>
        <CvAnalyticsPage />
      </HeaderActionsProvider>
    </BrowserRouter>
  )
  return Object.assign(result, { headerTarget })
}

afterEach(() => {
  cleanup()
  document
    .querySelectorAll('[data-testid="analytics-header-target"]')
    .forEach((element) => {
      element.remove()
    })
  globalThis.fetch = originalFetch
})

describe('CvAnalyticsPage', () => {
  test('renders application-owned CV analytics for the default range', async () => {
    const requests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      requests.push(String(input))
      return Response.json({
        availability: {
          from: '2026-06-19',
          to: '2026-07-19',
        },
        countries: [{ name: 'Germany', visits: 2 }],
        generatedAt: '2026-07-19T12:00:00.000Z',
        items: [
          {
            application: {
              appliedAt: null,
              applicationStatus: 'preparing',
              postingUrl: 'https://example.test/jobs/one',
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
              postingUrl: 'https://example.test/jobs/one',
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

    const view = renderAnalyticsPage()

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
    expect(
      within(view.headerTarget).getByRole('combobox', {
        name: 'Analytics time range',
      })
    ).toBeTruthy()
    expect(
      within(view.headerTarget).getByRole('button', {
        name: 'Refresh CV analytics',
      })
    ).toBeTruthy()
    expect(
      view.queryByRole('heading', { name: 'Published CV performance' })
    ).toBeNull()
    expect(
      view.queryByText(
        'Connect traffic to the applications and published CVs already in the registry.'
      )
    ).toBeNull()
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

    const view = renderAnalyticsPage()

    expect(await view.findByText('Could not load CV analytics')).toBeTruthy()
    expect(
      view.queryByRole('status', { name: 'Loading CV analytics' })
    ).toBeNull()
  })

  test('shows an empty state instead of plotting an all-zero traffic series', async () => {
    globalThis.fetch = mock(async () =>
      Response.json(emptyAnalyticsResponse)
    ) as unknown as typeof fetch

    const view = renderAnalyticsPage()

    expect(
      await view.findByText('No CV traffic was recorded in this period.')
    ).toBeTruthy()
    expect(view.queryByRole('img', { name: 'CV traffic over time' })).toBeNull()
  })

  test('reveals the provider-bounded calendar control for a custom range', async () => {
    const requests: string[] = []
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      requests.push(String(input))
      return Response.json(emptyAnalyticsResponse)
    }) as unknown as typeof fetch

    const view = renderAnalyticsPage()

    await view.findByText('No CV traffic was recorded in this period.')
    fireEvent.click(
      view.getByRole('combobox', { name: 'Analytics time range' })
    )
    const customOption = await view.findByRole('option', {
      name: 'Custom range',
    })
    fireEvent.click(customOption)
    await waitFor(() =>
      expect(customOption.hasAttribute('data-highlighted')).toBe(true)
    )
    fireEvent.click(customOption)

    expect(
      await within(view.headerTarget).findByRole('button', {
        name: 'Choose custom analytics range',
      })
    ).toBeTruthy()
    expect(requests).toHaveLength(1)
  })
})
