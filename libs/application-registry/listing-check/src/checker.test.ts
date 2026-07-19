import { describe, expect, test } from 'bun:test'
import * as BrowserCrypto from '@effect/platform-browser/BrowserCrypto'
import { Crypto, Effect } from 'effect'

import { type ListingFetch, makeListingAvailabilityChecker } from './checker'

const target = {
  company: 'CADDi',
  role: 'Senior Software Engineer Backend English',
  url: 'https://japan-dev.example/jobs/caddi/backend',
}

const runCheck = (fetcher: ListingFetch, input = target) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const crypto = yield* Crypto.Crypto
      return yield* makeListingAvailabilityChecker(fetcher, crypto).check(input)
    }).pipe(Effect.provide(BrowserCrypto.layer))
  )

describe('listing availability checker', () => {
  test('classifies HTTP 404 as strong closure evidence', async () => {
    const result = await runCheck(async () => new Response('', { status: 404 }))

    expect(result).toMatchObject({
      confidence: 'high',
      httpStatus: 404,
      outcome: 'closed',
      reasonCode: 'http_404',
    })
  })

  test('recognizes a matching page that explicitly says the role closed', async () => {
    const result = await runCheck(
      async () =>
        new Response(`
          <html>
            <head><title>CADDi Senior Software Engineer Backend</title></head>
            <body><h1>CADDi</h1><p>This position is no longer available.</p></body>
          </html>
        `)
    )

    expect(result).toMatchObject({
      confidence: 'high',
      outcome: 'closed',
      reasonCode: 'explicit_closed_text',
    })
  })

  test('does not treat access controls as closure evidence', async () => {
    const result = await runCheck(async () => new Response('', { status: 403 }))

    expect(result).toMatchObject({
      confidence: 'low',
      outcome: 'unknown',
      reasonCode: 'access_forbidden',
    })
  })

  test('recognizes a Workable not-found redirect as provider closure', async () => {
    const response = new Response('<title>SmartNews - Current Openings</title>')
    Object.defineProperty(response, 'url', {
      value: 'https://apply.workable.com/smartnews/?not_found=true',
    })
    const result = await runCheck(async () => response, {
      company: 'SmartNews',
      role: 'Senior Software Engineer, Ads Reporting',
      url: 'https://apply.workable.com/smartnews/j/895F68C51E/',
    })

    expect(result).toMatchObject({
      confidence: 'confirmed',
      outcome: 'closed',
      reasonCode: 'provider_closed',
    })
  })

  test('keeps ordinary Workable redirects inconclusive', async () => {
    const response = new Response('<title>SmartNews - Current Openings</title>')
    Object.defineProperty(response, 'url', {
      value: 'https://apply.workable.com/smartnews/',
    })
    const result = await runCheck(async () => response, {
      company: 'SmartNews',
      role: 'Senior Software Engineer, Ads Reporting',
      url: 'https://apply.workable.com/smartnews/j/895F68C51E/',
    })

    expect(result).toMatchObject({
      confidence: 'low',
      outcome: 'unknown',
      reasonCode: 'redirected_to_listing_page',
    })
  })

  test('detects a reused URL that now advertises a different role', async () => {
    const result = await runCheck(
      async () =>
        new Response(`
          <html>
            <head><title>CADDi job at Japan Dev</title></head>
            <body>
              <h1>Senior Software Engineer, Backend-Focused Full-Stack (Global Product Team)</h1>
              <p>CADDi</p>
              <a>Apply now</a>
            </body>
          </html>
        `)
    )

    expect(result).toMatchObject({
      confidence: 'medium',
      outcome: 'closed',
      reasonCode: 'identity_mismatch',
    })
  })

  test('uses a published Greenhouse API posting as confirmed open evidence', async () => {
    let requested = ''
    const result = await runCheck(
      async (request) => {
        requested = String(request)
        return Response.json({ id: 123, title: 'Engineer' })
      },
      {
        company: 'Example',
        role: 'Engineer',
        url: 'https://job-boards.greenhouse.io/example/jobs/123',
      }
    )

    expect(requested).toBe(
      'https://boards-api.greenhouse.io/v1/boards/example/jobs/123'
    )
    expect(result).toMatchObject({
      confidence: 'confirmed',
      outcome: 'open',
      provider: 'greenhouse',
      reasonCode: 'provider_open',
    })
  })

  test('falls back to the listing page when a provider API is unavailable', async () => {
    let requests = 0
    const result = await runCheck(
      async () => {
        requests += 1
        if (requests === 1) throw new TypeError('provider unavailable')
        return new Response(`
          <html>
            <head><title>Example Engineer</title></head>
            <body><h1>Engineer</h1><p>Example</p><a>Apply now</a></body>
          </html>
        `)
      },
      {
        company: 'Example',
        role: 'Engineer',
        url: 'https://job-boards.greenhouse.io/example/jobs/123',
      }
    )

    expect(requests).toBe(2)
    expect(result).toMatchObject({
      outcome: 'open',
      reasonCode: 'working_application_path',
    })
  })

  test('checks controlled local targets without a host blacklist', async () => {
    let fetched = false
    const result = await runCheck(
      async () => {
        fetched = true
        return new Response(`
          <html>
            <head><title>CADDi Senior Software Engineer Backend</title></head>
            <body><h1>Senior Software Engineer Backend English</h1><p>CADDi</p><a>Apply now</a></body>
          </html>
        `)
      },
      { ...target, url: 'http://127.0.0.1/job' }
    )

    expect(fetched).toBe(true)
    expect(result).toMatchObject({
      outcome: 'open',
      reasonCode: 'working_application_path',
    })
  })
})
