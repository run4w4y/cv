import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import {
  jobPostingCaptureMaxRedirects,
  prepareJobPostingCapture,
} from './job-posting-capture'
import {
  normalizedJobPostingMediaType,
  normalizeJobPostingHtml,
} from './job-posting-normalize'

const requestedUrl = 'https://jobs.example.test/roles/platform'

describe('job posting capture', () => {
  test('preserves raw HTML and derives deterministic model-ready context', async () => {
    const source = `<!doctype html>
      <html>
        <head>
          <title> Platform Engineer </title>
          <meta name="description" content="Build reliable developer platforms." />
          <meta property="og:title" content="Platform Engineer at Example" />
          <script type="application/ld+json">
            {"title":"Platform Engineer","@type":"JobPosting","hiringOrganization":{"name":"Example"},"description":"Own the platform."}
          </script>
          <style>.hidden-copy { display: block }</style>
        </head>
        <body>
          <h1>Platform Engineer</h1>
          <p>Design <strong>reliable systems</strong>.</p>
          <div hidden>Internal compensation notes</div>
          <script>window.privateState = "ignore me"</script>
        </body>
      </html>`
    const result = await Effect.runPromise(
      prepareJobPostingCapture(requestedUrl, {
        fetcher: async () =>
          new Response(source, {
            headers: { 'content-type': 'text/html; charset=utf-8' },
            status: 200,
          }),
      })
    )

    expect(result.status).toBe('fetched')
    expect(result.requestedUrl).toBe(requestedUrl)
    expect(result.finalUrl).toBe(requestedUrl)
    expect(result.raw?.mediaType).toBe('text/html; charset=utf-8')
    expect(new TextDecoder().decode(result.raw?.bytes)).toBe(source)
    expect(result.normalized?.mediaType).toBe(normalizedJobPostingMediaType)
    expect(new TextDecoder().decode(result.normalized?.bytes)).toBe(
      `# Normalized job posting

Source URL: ${requestedUrl}

## Page title
Platform Engineer

## Metadata
description: Build reliable developer platforms.
Open Graph title: Platform Engineer at Example

## JSON-LD
{
  "@type": "JobPosting",
  "description": "Own the platform.",
  "hiringOrganization": {
    "name": "Example"
  },
  "title": "Platform Engineer"
}

## Visible text
Platform Engineer
Design reliable systems.`
    )
  })

  test('bounds normalized HTML by UTF-8 bytes without splitting characters', () => {
    const result = normalizeJobPostingHtml(
      `<html><body><p>${'Relevant résumé requirements 👋 '.repeat(100)}</p></body></html>`,
      requestedUrl,
      300
    )

    expect(new TextEncoder().encode(result).byteLength).toBeLessThanOrEqual(300)
    expect(result.endsWith('[Job context truncated]')).toBe(true)
    expect(result).not.toContain('\uFFFD')
  })

  test('canonicalizes JSON-LD object keys independently of source order', () => {
    const left = normalizeJobPostingHtml(
      '<html><body>Role</body><script type="application/ld+json">{"title":"Role","@type":"JobPosting","description":"Work"}</script></html>',
      requestedUrl
    )
    const right = normalizeJobPostingHtml(
      '<html><body>Role</body><script type="application/ld+json">{"description":"Work","@type":"JobPosting","title":"Role"}</script></html>',
      requestedUrl
    )

    expect(left).toBe(right)
  })

  test('persists HTTP failures together with their raw response', async () => {
    const result = await Effect.runPromise(
      prepareJobPostingCapture(requestedUrl, {
        fetcher: async () =>
          new Response('Posting removed', {
            headers: { 'content-type': 'text/plain' },
            status: 410,
          }),
      })
    )

    expect(result).toMatchObject({
      errorCode: 'http_410',
      finalUrl: requestedUrl,
      requestedUrl,
      status: 'failed',
    })
    expect(new TextDecoder().decode(result.raw?.bytes)).toBe('Posting removed')
  })

  test('rejects non-HTTP canonical URLs without making a request', async () => {
    let fetched = false
    const result = await Effect.runPromise(
      prepareJobPostingCapture('file:///private/job.html', {
        fetcher: async () => {
          fetched = true
          return new Response('not reached')
        },
      })
    )

    expect(fetched).toBe(false)
    expect(result).toMatchObject({
      errorCode: 'invalid_url',
      finalUrl: null,
      status: 'failed',
    })
  })

  test('rejects credentials at the URL boundary', async () => {
    let fetched = false
    const result = await Effect.runPromise(
      prepareJobPostingCapture('https://user:secret@jobs.example.test/role', {
        fetcher: async () => {
          fetched = true
          return new Response('not reached')
        },
      })
    )

    expect(fetched).toBe(false)
    expect(result).toMatchObject({
      errorCode: 'invalid_url',
      finalUrl: null,
      status: 'failed',
    })
  })

  test('follows a relative public redirect with one shared timeout signal', async () => {
    const urls: string[] = []
    const signals: Array<AbortSignal | null | undefined> = []
    const redirectUrl = 'https://jobs.example.test/roles/platform?page=2'

    const result = await Effect.runPromise(
      prepareJobPostingCapture(requestedUrl, {
        fetcher: async (input, init) => {
          urls.push(input instanceof Request ? input.url : input.toString())
          signals.push(init?.signal)
          expect(init?.redirect).toBe('manual')
          return urls.length === 1
            ? new Response(null, {
                headers: { location: '/roles/platform?page=2' },
                status: 302,
              })
            : new Response('<html><body>Platform role</body></html>', {
                headers: { 'content-type': 'text/html' },
                status: 200,
              })
        },
      })
    )

    expect(urls).toEqual([requestedUrl, redirectUrl])
    expect(signals[0]).toBe(signals[1])
    expect(result).toMatchObject({
      finalUrl: redirectUrl,
      requestedUrl,
      status: 'fetched',
    })
  })

  test('detects redirect loops before repeating a request', async () => {
    let requests = 0
    const result = await Effect.runPromise(
      prepareJobPostingCapture(requestedUrl, {
        fetcher: async () => {
          requests += 1
          return new Response(null, {
            headers: { location: requestedUrl },
            status: 302,
          })
        },
      })
    )

    expect(requests).toBe(1)
    expect(result).toMatchObject({
      errorCode: 'redirect_loop',
      finalUrl: requestedUrl,
      status: 'failed',
    })
  })

  test('bounds redirect chains by a small fixed hop limit', async () => {
    let requests = 0
    const result = await Effect.runPromise(
      prepareJobPostingCapture(requestedUrl, {
        fetcher: async () => {
          requests += 1
          return new Response(null, {
            headers: {
              location: `https://jobs.example.test/hop/${requests}`,
            },
            status: 302,
          })
        },
      })
    )

    expect(requests).toBe(jobPostingCaptureMaxRedirects + 1)
    expect(result).toMatchObject({
      errorCode: 'too_many_redirects',
      finalUrl: `https://jobs.example.test/hop/${jobPostingCaptureMaxRedirects}`,
      status: 'failed',
    })
  })

  test('stops streaming once the configured byte limit is exceeded', async () => {
    const result = await Effect.runPromise(
      prepareJobPostingCapture(requestedUrl, {
        fetcher: async () =>
          new Response(
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new Uint8Array([1, 2, 3]))
                controller.enqueue(new Uint8Array([4, 5, 6]))
                controller.close()
              },
            })
          ),
        maxBytes: 5,
      })
    )

    expect(result).toMatchObject({
      errorCode: 'payload_too_large',
      finalUrl: requestedUrl,
      raw: undefined,
      status: 'failed',
    })
  })
})
