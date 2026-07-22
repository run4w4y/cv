import { describe, expect, test } from 'bun:test'
import { Readable } from 'node:stream'

import {
  isPublicAddress,
  listingRedirectLimit,
  makeSafeListingFetch,
  readBoundedListingResponse,
} from './safe-fetch'

describe('safe listing fetch', () => {
  test('rejects local and reserved address ranges', () => {
    expect(isPublicAddress('127.0.0.1')).toBe(false)
    expect(isPublicAddress('10.1.2.3')).toBe(false)
    expect(isPublicAddress('169.254.169.254')).toBe(false)
    expect(isPublicAddress('192.168.1.1')).toBe(false)
    expect(isPublicAddress('::1')).toBe(false)
    expect(isPublicAddress('0:0:0:0:0:0:0:1')).toBe(false)
    expect(isPublicAddress('::ffff:7f00:1')).toBe(false)
    expect(isPublicAddress('fd00::1')).toBe(false)
    expect(isPublicAddress('2606:4700:4700::1111')).toBe(true)
    expect(isPublicAddress('1.1.1.1')).toBe(true)
  })

  test('rejects a public hostname when any answer is private', async () => {
    let requested = false
    const fetcher = makeSafeListingFetch({
      request: async () => {
        requested = true
        return new Response('not reached')
      },
      resolve: async () => [
        { address: '1.1.1.1', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ],
    })

    await expect(fetcher('https://jobs.example.test/role')).rejects.toThrow(
      'blocked address 127.0.0.1'
    )
    expect(requested).toBe(false)
  })

  test('validates every redirect before issuing the next request', async () => {
    let requests = 0
    const fetcher = makeSafeListingFetch({
      request: async () => {
        requests += 1
        return new Response(null, {
          headers: { location: 'http://127.0.0.1/admin' },
          status: 302,
        })
      },
      resolve: async () => [{ address: '1.1.1.1', family: 4 }],
    })

    await expect(fetcher('https://jobs.example.test/role')).rejects.toThrow(
      'blocked address 127.0.0.1'
    )
    expect(requests).toBe(1)
  })

  test('caps redirect chains', async () => {
    let requests = 0
    const fetcher = makeSafeListingFetch({
      request: async (_url) => {
        requests += 1
        return new Response(null, {
          headers: { location: `/hop/${requests}` },
          status: 302,
        })
      },
      resolve: async () => [{ address: '1.1.1.1', family: 4 }],
    })

    await expect(fetcher('https://jobs.example.test/role')).rejects.toThrow(
      `${listingRedirectLimit} redirects`
    )
    expect(requests).toBe(listingRedirectLimit + 1)
  })

  test('stops reading when the decompressed body exceeds its byte cap', async () => {
    const body = Readable.from([
      new Uint8Array([1, 2, 3]),
      new Uint8Array([4, 5, 6]),
    ])

    await expect(readBoundedListingResponse(body, 5)).rejects.toThrow(
      'exceeds 5 bytes'
    )
  })
})
