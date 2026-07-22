import { describe, expect, spyOn, test } from 'bun:test'

import {
  cacheTagForToken,
  handlePublicCachePurge,
  type PublicCachePurgeOptions,
  publicToken,
  withoutSharedCaching,
} from './public-cache'

const successfulPurger =
  (calls: PublicCachePurgeOptions[]) =>
  async (options: PublicCachePurgeOptions) => {
    calls.push(options)
    return { errors: [], success: true }
  }

const purgeRequest = (body: unknown, authorization = 'Bearer test-secret') =>
  new Request('https://cv.example.test/c/_internal/revalidate', {
    body: JSON.stringify(body),
    headers: {
      authorization,
      'content-type': 'application/json',
    },
    method: 'POST',
  })

describe('public CV cache policy', () => {
  test('derives the token only from an exact public route', () => {
    expect(publicToken('/c/public-token')).toBe('public-token')
    expect(publicToken('/c/public%20token')).toBe('public token')
    expect(publicToken('/c/_preview')).toBeNull()
    expect(publicToken('/c/public-token/extra')).toBeNull()
    expect(publicToken('/c/bad%2Ftoken')).toBeNull()
  })

  test('keeps successful public pages out of every shared cache', () => {
    const response = withoutSharedCaching(
      new Response('CV', {
        headers: {
          'Cache-Tag': 'old-tag',
          'CDN-Cache-Control': 'public, max-age=300',
          'Cloudflare-CDN-Cache-Control': 'public, max-age=300',
          'X-Test': 'preserved',
        },
      })
    )

    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.has('cache-tag')).toBe(false)
    expect(response.headers.has('cdn-cache-control')).toBe(false)
    expect(response.headers.has('cloudflare-cdn-cache-control')).toBe(false)
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('x-robots-tag')).toBe(
      'noindex, nofollow, noarchive'
    )
    expect(response.headers.get('x-test')).toBe('preserved')
  })

  test('prevents missing and failed pages from entering shared cache', () => {
    const response = withoutSharedCaching(
      new Response('missing', {
        headers: {
          'Cache-Tag': 'old-tag',
          'CDN-Cache-Control': 'public, max-age=300',
          'Cloudflare-CDN-Cache-Control': 'public, max-age=300',
        },
        status: 404,
      })
    )

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.has('cache-tag')).toBe(false)
    expect(response.headers.has('cdn-cache-control')).toBe(false)
    expect(response.headers.has('cloudflare-cdn-cache-control')).toBe(false)
  })

  test('purges the exact token tag after authenticating', async () => {
    const calls: PublicCachePurgeOptions[] = []
    const response = await handlePublicCachePurge(
      purgeRequest({ token: 'public-token' }),
      'test-secret',
      successfulPurger(calls)
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ purged: 'public-token' })
    expect(calls).toEqual([{ tags: [await cacheTagForToken('public-token')] }])
  })

  test('supports an explicit full purge', async () => {
    const calls: PublicCachePurgeOptions[] = []
    const response = await handlePublicCachePurge(
      purgeRequest({ all: true }),
      'test-secret',
      successfulPurger(calls)
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ purged: 'all' })
    expect(calls).toEqual([{ purgeEverything: true }])
  })

  test('rejects unauthorized and malformed invalidation requests', async () => {
    const calls: PublicCachePurgeOptions[] = []
    const purge = successfulPurger(calls)
    const unauthorized = await handlePublicCachePurge(
      purgeRequest({ token: 'public-token' }, 'Bearer wrong-secret'),
      'test-secret',
      purge
    )
    const malformed = await handlePublicCachePurge(
      purgeRequest({ token: '' }),
      'test-secret',
      purge
    )

    expect(unauthorized.status).toBe(401)
    expect(malformed.status).toBe(400)
    expect(calls).toEqual([])
  })

  test('turns rejected and unsuccessful purge calls into a 503 response', async () => {
    const errorLog = spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      const rejected = await handlePublicCachePurge(
        purgeRequest({ token: 'public-token' }),
        'test-secret',
        () => Promise.reject(new Error('Cloudflare API unavailable'))
      )
      const unsuccessful = await handlePublicCachePurge(
        purgeRequest({ all: true }),
        'test-secret',
        () =>
          Promise.resolve({
            errors: [{ code: 1000, message: 'Purge rejected' }],
            success: false,
          })
      )

      expect(rejected.status).toBe(503)
      expect(await rejected.json()).toEqual({ error: 'cache_purge_failed' })
      expect(unsuccessful.status).toBe(503)
      expect(await unsuccessful.json()).toEqual({
        error: 'cache_purge_failed',
      })
      expect(errorLog).toHaveBeenCalledTimes(2)
    } finally {
      errorLog.mockRestore()
    }
  })
})
