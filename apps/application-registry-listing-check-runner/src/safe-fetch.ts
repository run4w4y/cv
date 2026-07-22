import { lookup } from 'node:dns/promises'
import { request as requestHttp } from 'node:http'
import { request as requestHttps } from 'node:https'
import { isIP, type LookupFunction } from 'node:net'
import type { Readable } from 'node:stream'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'
import type { ListingFetch } from '@cv/application-registry-listing-check'

export const listingResponseMaxBytes = 2 * 1_024 * 1_024
export const listingRedirectLimit = 5

type ResolvedAddress = { readonly address: string; readonly family: 4 | 6 }
type ResolveHost = (hostname: string) => Promise<readonly ResolvedAddress[]>
type RequestPinned = (
  url: URL,
  address: ResolvedAddress,
  init: RequestInit
) => Promise<Response>

export interface SafeListingFetchOptions {
  readonly request?: RequestPinned
  readonly resolve?: ResolveHost
}

const privateHostnames = new Set(['localhost', 'localhost.localdomain'])

const parseIpv4 = (address: string): readonly number[] | null => {
  const parts = address.split('.')
  if (parts.length !== 4) return null
  const octets = parts.map(Number)
  return octets.every(
    (octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255
  )
    ? octets
    : null
}

const isPrivateIpv4 = (address: string): boolean => {
  const octets = parseIpv4(address)
  if (octets === null) return true
  const [a = 0, b = 0, c = 0] = octets
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  )
}

const isPrivateIpv6 = (address: string): boolean => {
  const withoutZone = address.toLowerCase().split('%', 1)[0] ?? ''
  const normalized = new URL(`http://[${withoutZone}]/`).hostname.slice(1, -1)
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('::ffff:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    /^fe[89ab]/u.test(normalized) ||
    normalized.startsWith('ff') ||
    normalized.startsWith('64:ff9b:1:') ||
    normalized.startsWith('100:') ||
    normalized.startsWith('2001:db8:')
  )
}

export const isPublicAddress = (address: string): boolean => {
  const family = isIP(address)
  if (family === 4) return !isPrivateIpv4(address)
  if (family === 6) return !isPrivateIpv6(address)
  return false
}

const validateUrl = (value: string | URL): URL => {
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Listing URLs must use HTTP or HTTPS.')
  }
  if (url.username !== '' || url.password !== '') {
    throw new Error('Listing URLs containing credentials are not allowed.')
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/u, '')
  if (
    privateHostnames.has(hostname) ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.home.arpa')
  ) {
    throw new Error(`Listing hostname ${hostname} is not public.`)
  }
  url.hash = ''
  return url
}

const resolvePublicAddress = async (
  url: URL,
  resolve: ResolveHost
): Promise<ResolvedAddress> => {
  const hostname = url.hostname.startsWith('[')
    ? url.hostname.slice(1, -1)
    : url.hostname
  const literalFamily = isIP(hostname)
  const addresses: readonly ResolvedAddress[] =
    literalFamily === 4
      ? [{ address: hostname, family: 4 }]
      : literalFamily === 6
        ? [{ address: hostname, family: 6 }]
        : await resolve(hostname)
  if (addresses.length === 0) {
    throw new Error(`Listing hostname ${url.hostname} did not resolve.`)
  }
  const blocked = addresses.find(({ address }) => !isPublicAddress(address))
  if (blocked) {
    throw new Error(
      `Listing hostname ${url.hostname} resolved to blocked address ${blocked.address}.`
    )
  }
  return addresses[0] ?? Promise.reject(new Error('No address selected.'))
}

export const readBoundedListingResponse = (
  source: Readable,
  maximumBytes: number
): Promise<Uint8Array> =>
  new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = []
    let total = 0
    source.on('data', (chunk: Uint8Array) => {
      total += chunk.byteLength
      if (total > maximumBytes) {
        source.destroy(
          new Error(`Listing response exceeds ${maximumBytes} bytes.`)
        )
        return
      }
      chunks.push(chunk)
    })
    source.once('error', reject)
    source.once('end', () => {
      const bytes = new Uint8Array(total)
      let offset = 0
      for (const chunk of chunks) {
        bytes.set(chunk, offset)
        offset += chunk.byteLength
      }
      resolve(bytes)
    })
  })

const responseBody = (response: Readable, encoding: string): Readable => {
  if (encoding === '' || encoding === 'identity') return response
  if (encoding === 'gzip') return response.pipe(createGunzip())
  if (encoding === 'deflate') return response.pipe(createInflate())
  if (encoding === 'br') return response.pipe(createBrotliDecompress())
  response.destroy()
  throw new Error(`Unsupported listing content encoding: ${encoding}.`)
}

const requestPinned: RequestPinned = (url, address, init) =>
  new Promise((resolve, reject) => {
    const lookupPinned: LookupFunction = (_hostname, options, callback) => {
      if (options.all) {
        callback(null, [address])
        return
      }
      callback(null, address.address, address.family)
    }
    const outgoingHeaders: Record<string, string> = {}
    new Headers(init.headers).forEach((value, name) => {
      outgoingHeaders[name] = value
    })
    const request = (url.protocol === 'https:' ? requestHttps : requestHttp)(
      url,
      {
        headers: outgoingHeaders,
        lookup: lookupPinned,
        method: init.method ?? 'GET',
        signal: init.signal ?? undefined,
      },
      async (incoming) => {
        try {
          const headers = new Headers()
          for (const [name, value] of Object.entries(incoming.headers)) {
            if (value === undefined) continue
            for (const entry of Array.isArray(value) ? value : [value]) {
              headers.append(name, entry)
            }
          }
          const encoding = headers.get('content-encoding')?.toLowerCase() ?? ''
          const bytes = await readBoundedListingResponse(
            responseBody(incoming, encoding),
            listingResponseMaxBytes
          )
          headers.delete('content-encoding')
          headers.set('content-length', String(bytes.byteLength))
          const response = new Response(Uint8Array.from(bytes).buffer, {
            headers,
            status: incoming.statusCode ?? 500,
            statusText: incoming.statusMessage,
          })
          Object.defineProperty(response, 'url', { value: url.href })
          resolve(response)
        } catch (cause) {
          reject(cause)
        }
      }
    )
    request.once('error', reject)
    request.end()
  })

const defaultResolve: ResolveHost = (hostname) =>
  lookup(hostname, { all: true, order: 'verbatim' }).then((addresses) =>
    addresses.flatMap(({ address, family }) =>
      family === 4 || family === 6 ? [{ address, family }] : []
    )
  )

const redirectStatuses = new Set([301, 302, 303, 307, 308])

export const makeSafeListingFetch = (
  options: SafeListingFetchOptions = {}
): ListingFetch => {
  const resolve = options.resolve ?? defaultResolve
  const request = options.request ?? requestPinned

  return async (input, init = {}) => {
    const requested =
      input instanceof Request ? new URL(input.url) : new URL(input.toString())
    let current = validateUrl(requested)
    const visited = new Set([current.href])
    const timeout = AbortSignal.timeout(14_000)
    const signal = init.signal
      ? AbortSignal.any([init.signal, timeout])
      : timeout

    for (let redirects = 0; ; redirects += 1) {
      const address = await resolvePublicAddress(current, resolve)
      const requestHeaders: Record<string, string> = {
        accept:
          'text/html,application/xhtml+xml,application/json,text/plain;q=0.9,*/*;q=0.5',
        'accept-encoding': 'gzip, deflate, br',
        'user-agent': 'cv-application-registry-listing-checker/2',
      }
      new Headers(init.headers).forEach((value, name) => {
        requestHeaders[name] = value
      })
      const response = await request(current, address, {
        ...init,
        headers: requestHeaders,
        redirect: 'manual',
        signal,
      })

      if (!redirectStatuses.has(response.status)) return response
      if (redirects >= listingRedirectLimit) {
        throw new Error(
          `Listing response exceeded ${listingRedirectLimit} redirects.`
        )
      }
      const location = response.headers.get('location')
      if (!location) throw new Error('Listing redirect has no Location header.')
      const next = validateUrl(new URL(location, current))
      if (visited.has(next.href)) {
        throw new Error('Listing response entered a redirect loop.')
      }
      visited.add(next.href)
      current = next
    }
  }
}
