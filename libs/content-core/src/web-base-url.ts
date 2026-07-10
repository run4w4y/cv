import { Schema, SchemaGetter } from 'effect'

const normalizePathname = (pathname: string) =>
  pathname.endsWith('/') ? pathname : `${pathname}/`

const isSafeWebBaseUrl = (url: URL) =>
  (url.protocol === 'https:' || url.protocol === 'http:') &&
  url.username.length === 0 &&
  url.password.length === 0 &&
  url.search.length === 0 &&
  url.hash.length === 0

export const normalizeWebBaseUrl = (url: URL) => {
  const normalized = new URL(url.href)
  normalized.pathname = normalizePathname(normalized.pathname)
  return normalized
}

const safeWebBaseUrlCheck = Schema.makeFilter<URL>((url) =>
  isSafeWebBaseUrl(url)
    ? undefined
    : 'Expected an HTTP(S) base URL without credentials, query parameters, or a fragment'
)

const normalizeTransformation = {
  decode: SchemaGetter.transform(normalizeWebBaseUrl),
  encode: SchemaGetter.transform(normalizeWebBaseUrl),
}

const webBaseUrlFromSelf = Schema.URL.pipe(
  Schema.check(safeWebBaseUrlCheck),
  Schema.decode(normalizeTransformation),
  Schema.brand('WebBaseUrl')
)

export const webBaseUrlSchema = Schema.URLFromString.pipe(
  Schema.check(safeWebBaseUrlCheck),
  Schema.decode(normalizeTransformation),
  Schema.brand('WebBaseUrl')
)

export const webBaseUrlFromSelfSchema = webBaseUrlFromSelf

export type WebBaseUrl = Schema.Schema.Type<typeof webBaseUrlSchema>

export const decodeWebBaseUrl = Schema.decodeUnknownSync(webBaseUrlSchema)
export const decodeWebBaseUrlFromSelf = Schema.decodeUnknownSync(
  webBaseUrlFromSelfSchema
)

const normalizeRelativePath = (path: string) => {
  const normalized = path.replace(/\\/gu, '/').replace(/^\/+/u, '')
  const pathOnly = normalized.split(/[?#]/u, 1)[0] ?? ''

  for (const segment of pathOnly.split('/')) {
    let decoded: string
    try {
      decoded = decodeURIComponent(segment)
    } catch {
      throw new RangeError(`Invalid URL path segment "${segment}".`)
    }

    if (decoded === '.' || decoded === '..') {
      throw new RangeError('Web base URL paths cannot contain dot segments.')
    }
  }

  return normalized
}

/**
 * Resolves a repository-owned relative path below a normalized web base URL.
 * Prefixing with `./` prevents URL-shaped input from changing the origin.
 */
export const resolveWebBaseUrl = (baseUrl: WebBaseUrl, path: string) => {
  const resolved = new URL(`./${normalizeRelativePath(path)}`, baseUrl)

  if (
    resolved.origin !== baseUrl.origin ||
    !resolved.pathname.startsWith(baseUrl.pathname)
  ) {
    throw new RangeError('Resolved URL escaped its configured web base URL.')
  }

  return resolved
}

export const webPathSegments = (...segments: readonly string[]) =>
  segments.map((segment) => encodeURIComponent(segment)).join('/')
