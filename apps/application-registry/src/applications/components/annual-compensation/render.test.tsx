import { afterEach, describe, expect, mock, test } from 'bun:test'
import { cleanup, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { renderWithRegistry } from '../../../test/render-with-registry'

import { AnnualCompensation, formatCompensationAmount } from './render'

const originalFetch = globalThis.fetch

afterEach(() => {
  cleanup()
  globalThis.fetch = originalFetch
  window.localStorage.clear()
})

describe('AnnualCompensation', () => {
  test('renders original minor-unit boundaries as explicit from and to values', () => {
    const markup = renderToStaticMarkup(
      <AnnualCompensation
        value={{
          currencyCode: 'USD',
          minimumMinor: 150_000_00,
          maximumMinor: 180_000_00,
        }}
      />
    )

    expect(markup).toContain('From')
    expect(markup).toContain('To')
    expect(markup).toContain('USD')
  })

  test('does not invent a missing bound', () => {
    expect(formatCompensationAmount(null, 'USD')).toBe('—')
  })

  test('formats zero- and three-decimal currencies from their minor units', () => {
    expect(formatCompensationAmount(1234, 'JPY')).toContain('1,234')
    expect(formatCompensationAmount(1234, 'KWD')).toContain('1.234')
  })

  test('renders an explicit empty state when compensation is not provided', () => {
    expect(renderToStaticMarkup(<AnnualCompensation value={null} />)).toContain(
      'Not provided'
    )
  })

  test('suspends only a value that needs conversion and persists its rate table', async () => {
    let fxRequests = 0
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = String(input)
      if (!url.startsWith('https://api.frankfurter.dev/')) {
        throw new Error(`Unexpected request: ${url}`)
      }
      fxRequests += 1
      return Response.json([
        { base: 'AED', date: '2026-07-20', quote: 'EUR', rate: 0.25 },
        { base: 'AED', date: '2026-07-20', quote: 'USD', rate: 0.27 },
      ])
    }) as unknown as typeof fetch

    const view = renderWithRegistry(
      <>
        <AnnualCompensation
          value={{
            currencyCode: 'EUR',
            minimumMinor: 10_000,
            maximumMinor: 12_000,
          }}
          displayCurrency="AED"
        />
        <AnnualCompensation
          value={{
            currencyCode: 'USD',
            minimumMinor: 15_000,
            maximumMinor: 18_000,
          }}
          displayCurrency="AED"
        />
      </>
    )

    expect(view.container.querySelectorAll('[aria-busy="true"]')).toHaveLength(
      2
    )
    expect(view.queryByText('From')).toBeNull()

    expect(
      await view.findAllByText('AED · annual · FX 2026-07-20')
    ).toHaveLength(2)
    expect(view.container.querySelector('[aria-busy="true"]')).toBeNull()
    expect(fxRequests).toBe(1)
    await waitFor(() =>
      expect(
        window.localStorage.getItem(
          '@cv/application-registry/compensation-fx-rates/v1AED'
        )
      ).not.toBeNull()
    )
  })

  test('keeps the original value visible when conversion fails', async () => {
    globalThis.fetch = mock(
      async () => new Response(null, { status: 503 })
    ) as unknown as typeof fetch

    const view = renderWithRegistry(
      <AnnualCompensation
        value={{
          currencyCode: 'EUR',
          minimumMinor: 10_000,
          maximumMinor: 12_000,
        }}
        displayCurrency="CHF"
      />
    )

    await view.findByText('EUR · annual · CHF conversion unavailable')
    expect(view.getByText(/€100/)).toBeTruthy()
  })
})
