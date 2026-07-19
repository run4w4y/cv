import { decodeCvToken } from './token'

export type PublicCachePurgeOptions =
  | { readonly purgeEverything: true }
  | { readonly tags: readonly string[] }

export type PublicCachePurgeResult = {
  readonly errors: readonly {
    readonly code: number
    readonly message: string
  }[]
  readonly success: boolean
}

export type PurgePublicCache = (
  options: PublicCachePurgeOptions
) => Promise<PublicCachePurgeResult>

export const internalRevalidationPath = '/c/_internal/revalidate'

export const publicToken = (pathname: string): string | null => {
  const encoded = /^\/c\/([^/]+)$/u.exec(pathname)?.[1]
  if (!encoded || encoded === '_preview') return null

  try {
    return decodeCvToken(decodeURIComponent(encoded))
  } catch {
    return null
  }
}

export const isApplicationRoute = (pathname: string) =>
  pathname.startsWith('/c/_preview/') ||
  pathname.startsWith('/c/_next/') ||
  publicToken(pathname) !== null

const noStoreHeaders = {
  'Cache-Control': 'private, no-store',
  'Content-Type': 'text/plain; charset=utf-8',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
} as const

export const notFoundResponse = () =>
  new Response('Not Found', {
    headers: noStoreHeaders,
    status: 404,
  })

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    headers: { 'Cache-Control': 'private, no-store' },
    status,
  })

export const cacheTagForToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token)
  )
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
  return `cv:${hex}`
}

const authorized = (request: Request, secret: string | undefined) =>
  secret !== undefined &&
  secret.length > 0 &&
  request.headers.get('authorization') === `Bearer ${secret}`

export const handlePublicCachePurge = async (
  request: Request,
  secret: string | undefined,
  purge: PurgePublicCache
): Promise<Response> => {
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }
  if (!authorized(request, secret)) {
    return json({ error: 'unauthorized' }, 401)
  }

  const body: unknown = await request.json().catch(() => null)
  if (typeof body !== 'object' || body === null) {
    return json({ error: 'invalid_request' }, 400)
  }

  const all = 'all' in body && body.all === true
  const token = 'token' in body ? decodeCvToken(body.token) : null
  const result = all
    ? await purge({ purgeEverything: true })
    : token !== null
      ? await purge({ tags: [await cacheTagForToken(token)] })
      : null
  if (result === null) return json({ error: 'invalid_token' }, 400)
  if (!result.success) {
    console.error('CV cache purge failed.', result.errors)
    return json({ error: 'cache_purge_failed' }, 503)
  }

  return json({ purged: all ? 'all' : token })
}

export const withoutSharedCaching = (response: Response): Response => {
  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'private, no-store')
  headers.set('Referrer-Policy', 'no-referrer')
  headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
  headers.delete('Cache-Tag')
  headers.delete('Cloudflare-CDN-Cache-Control')
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

export const withPublicCaching = async (
  response: Response,
  token: string
): Promise<Response> => {
  if (response.status !== 200) return withoutSharedCaching(response)

  const headers = new Headers(response.headers)
  headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
  headers.set('Cloudflare-CDN-Cache-Control', 'public, max-age=300')
  headers.set('Cache-Tag', await cacheTagForToken(token))
  headers.set('Referrer-Policy', 'no-referrer')
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}
