import { Effect, Option, Schema } from 'effect'

import type { PersistJobPostingSnapshotInput } from '../types'

import {
  normalizedJobPostingMediaType,
  normalizeJobPostingHtml,
} from './job-posting-normalize'

export const jobPostingCaptureFetcherVersion =
  'application-registry-job-posting-fetch/v2'
export const jobPostingCaptureMaxBytes = 4 * 1_024 * 1_024
export const jobPostingCaptureTimeoutMilliseconds = 20_000
export const jobPostingCaptureMaxRedirects = 5

type FetchJobPosting = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>

type CaptureOptions = {
  readonly fetcher?: FetchJobPosting
  readonly maxBytes?: number
  readonly timeoutMilliseconds?: number
}

class PayloadTooLargeError extends Error {
  constructor(readonly maximumBytes: number) {
    super(`Job posting response exceeds the ${maximumBytes}-byte limit.`)
    this.name = 'PayloadTooLargeError'
  }
}

const failedCapture = (
  requestedUrl: string,
  errorCode: string,
  errorMessage: string,
  finalUrl: string | null = null,
  raw?: { readonly bytes: Uint8Array; readonly mediaType: string }
): PersistJobPostingSnapshotInput => ({
  errorCode,
  errorMessage,
  fetcherVersion: jobPostingCaptureFetcherVersion,
  finalUrl,
  raw,
  requestedUrl,
  status: 'failed',
})

const HttpUrlSchema = Schema.URL.pipe(
  Schema.check(
    Schema.makeFilter((url) =>
      url.protocol === 'http:' || url.protocol === 'https:'
        ? true
        : 'The application canonical URL must use HTTP or HTTPS.'
    )
  ),
  Schema.check(
    Schema.makeFilter((url) =>
      url.username === '' && url.password === ''
        ? true
        : 'URLs containing credentials are not allowed.'
    )
  )
)

const parseHttpUrl = (value: string): URL | null => {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return null
  }

  const decoded = Schema.decodeUnknownOption(HttpUrlSchema)(parsed)
  if (Option.isNone(decoded)) return null

  const url = decoded.value
  // Fragments are not sent in HTTP requests. Normalizing them also makes a
  // fragment-only redirect compare equal to the URL already visited.
  url.hash = ''
  return new URL(url.href.endsWith('#') ? url.href.slice(0, -1) : url.href)
}

const cancelResponseBody = async (response: Response): Promise<void> => {
  try {
    await response.body?.cancel()
  } catch {
    // A redirect response body is intentionally discarded. Some fetch
    // implementations report cancellation as a rejection after doing so.
  }
}

const redirectStatuses = new Set([301, 302, 303, 307, 308])

const responseMediaType = (value: string): string =>
  value.split(';', 1)[0]?.trim().toLowerCase() ?? ''

const responseCharset = (value: string): string => {
  const match = /(?:^|;)\s*charset\s*=\s*["']?([^;"'\s]+)/iu.exec(value)
  return match?.[1] ?? 'utf-8'
}

const decodeText = (bytes: Uint8Array, mediaType: string): string => {
  try {
    return new TextDecoder(responseCharset(mediaType)).decode(bytes)
  } catch {
    return new TextDecoder().decode(bytes)
  }
}

const declaredByteLength = (response: Response): number | null => {
  const value = response.headers.get('content-length')?.trim()
  if (!value || !/^\d+$/u.test(value)) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

const readResponseBytes = async (
  response: Response,
  maximumBytes: number
): Promise<Uint8Array> => {
  const declared = declaredByteLength(response)
  if (declared !== null && declared > maximumBytes) {
    throw new PayloadTooLargeError(maximumBytes)
  }

  if (response.body === null) return new Uint8Array()

  const chunks: Uint8Array[] = []
  const reader = response.body.getReader()
  let total = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      total += next.value.byteLength
      if (total > maximumBytes) {
        await reader.cancel('Job posting response exceeded the byte limit.')
        throw new PayloadTooLargeError(maximumBytes)
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes
}

const capture = async (
  requestedUrl: string,
  options: CaptureOptions
): Promise<PersistJobPostingSnapshotInput> => {
  const url = parseHttpUrl(requestedUrl)
  if (url === null) {
    return failedCapture(
      requestedUrl,
      'invalid_url',
      'The application canonical URL must use HTTP or HTTPS.'
    )
  }

  const fetcher = options.fetcher ?? globalThis.fetch
  const maxBytes = options.maxBytes ?? jobPostingCaptureMaxBytes
  const timeoutMilliseconds =
    options.timeoutMilliseconds ?? jobPostingCaptureTimeoutMilliseconds

  const timeoutSignal = AbortSignal.timeout(timeoutMilliseconds)
  const visitedUrls = new Set([url.href])
  let currentUrl = url
  let followedRedirects = 0
  let response: Response

  while (true) {
    try {
      response = await fetcher(currentUrl, {
        headers: {
          accept:
            'text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.5',
        },
        redirect: 'manual',
        signal: timeoutSignal,
      })
    } catch (cause) {
      const timedOut =
        timeoutSignal.aborted ||
        (cause instanceof DOMException &&
          (cause.name === 'TimeoutError' || cause.name === 'AbortError'))
      return failedCapture(
        requestedUrl,
        timedOut ? 'request_timed_out' : 'fetch_failed',
        timedOut
          ? `The job posting request timed out after ${timeoutMilliseconds}ms.`
          : cause instanceof Error
            ? `The job posting request failed: ${cause.message}`
            : 'The job posting request failed.',
        currentUrl.href
      )
    }

    if (response.redirected) {
      await cancelResponseBody(response)
      return failedCapture(
        requestedUrl,
        'redirect_policy_bypassed',
        'The fetch implementation followed a redirect before it could be validated.',
        currentUrl.href
      )
    }

    if (!redirectStatuses.has(response.status)) break

    const location = response.headers.get('location')?.trim()
    if (!location) {
      await cancelResponseBody(response)
      return failedCapture(
        requestedUrl,
        'redirect_missing_location',
        `The job posting request returned HTTP ${response.status} without a Location header.`,
        currentUrl.href
      )
    }

    let resolvedLocation: string
    try {
      resolvedLocation = new URL(location, currentUrl).href
    } catch {
      await cancelResponseBody(response)
      return failedCapture(
        requestedUrl,
        'invalid_redirect_url',
        'The job posting redirect contains an invalid URL.',
        currentUrl.href
      )
    }

    const nextUrl = parseHttpUrl(resolvedLocation)
    if (nextUrl === null) {
      await cancelResponseBody(response)
      return failedCapture(
        requestedUrl,
        'invalid_redirect_url',
        'The job posting redirect must use HTTP or HTTPS.',
        currentUrl.href
      )
    }

    if (visitedUrls.has(nextUrl.href)) {
      await cancelResponseBody(response)
      return failedCapture(
        requestedUrl,
        'redirect_loop',
        'The job posting request entered a redirect loop.',
        currentUrl.href
      )
    }

    if (followedRedirects >= jobPostingCaptureMaxRedirects) {
      await cancelResponseBody(response)
      return failedCapture(
        requestedUrl,
        'too_many_redirects',
        `The job posting request exceeded the ${jobPostingCaptureMaxRedirects}-redirect limit.`,
        currentUrl.href
      )
    }

    await cancelResponseBody(response)
    visitedUrls.add(nextUrl.href)
    currentUrl = nextUrl
    followedRedirects += 1
  }

  const finalUrl = currentUrl.href
  const mediaType =
    response.headers.get('content-type')?.trim() || 'application/octet-stream'

  let bytes: Uint8Array
  try {
    bytes = await readResponseBytes(response, maxBytes)
  } catch (cause) {
    const timedOut = timeoutSignal.aborted
    return failedCapture(
      requestedUrl,
      cause instanceof PayloadTooLargeError
        ? 'payload_too_large'
        : timedOut
          ? 'request_timed_out'
          : 'response_read_failed',
      timedOut
        ? `The job posting request timed out after ${timeoutMilliseconds}ms.`
        : cause instanceof Error
          ? cause.message
          : 'The job posting response could not be read.',
      finalUrl
    )
  }

  const raw = { bytes, mediaType }
  if (!response.ok) {
    return failedCapture(
      requestedUrl,
      `http_${response.status}`,
      `The job posting request returned HTTP ${response.status}.`,
      finalUrl,
      raw
    )
  }

  const normalized = ['text/html', 'application/xhtml+xml'].includes(
    responseMediaType(mediaType)
  )
    ? {
        bytes: new TextEncoder().encode(
          normalizeJobPostingHtml(decodeText(bytes, mediaType), finalUrl)
        ),
        mediaType: normalizedJobPostingMediaType,
      }
    : undefined

  return {
    fetcherVersion: jobPostingCaptureFetcherVersion,
    finalUrl,
    normalized,
    raw,
    requestedUrl,
    status: 'fetched',
  }
}

export const prepareJobPostingCapture = (
  requestedUrl: string,
  options: CaptureOptions = {}
): Effect.Effect<PersistJobPostingSnapshotInput> =>
  // `capture` normalizes every network/read rejection into a persisted failed
  // snapshot, so the Effect itself is intentionally infallible.
  Effect.promise(() => capture(requestedUrl, options))
