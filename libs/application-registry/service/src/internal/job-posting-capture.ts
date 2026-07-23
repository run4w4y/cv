import { Effect, Match, Predicate, Schema } from 'effect'

import type { PersistJobPostingSnapshotInput } from '../types'

import {
  normalizedJobPostingMediaType,
  normalizeJobPostingHtml,
} from './job-posting-normalize'

export const jobPostingCaptureFetcherVersion =
  'application-registry-job-posting-fetch/v3'
export const jobPostingCaptureMaxBytes = 4 * 1_024 * 1_024
export const jobPostingCaptureTimeoutMilliseconds = 20_000

type FetchJobPosting = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>

type CaptureOptions = {
  readonly fetcher?: FetchJobPosting
  readonly maxBytes?: number
  readonly timeoutMilliseconds?: number
}

class PayloadTooLargeError extends Schema.TaggedErrorClass<PayloadTooLargeError>()(
  'PayloadTooLargeError',
  { maximumBytes: Schema.Number, message: Schema.String }
) {
  constructor(maximumBytes: number) {
    super({
      maximumBytes,
      message: `Job posting response exceeds the ${maximumBytes}-byte limit.`,
    })
  }
}

const errorMessage = (cause: unknown, fallback: string): string =>
  Match.value(cause).pipe(
    Match.when(Predicate.isError, (error) => error.message),
    Match.orElse(() => fallback)
  )

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
  const fetcher = options.fetcher ?? globalThis.fetch
  const maxBytes = options.maxBytes ?? jobPostingCaptureMaxBytes
  const timeoutMilliseconds =
    options.timeoutMilliseconds ?? jobPostingCaptureTimeoutMilliseconds

  const timeoutSignal = AbortSignal.timeout(timeoutMilliseconds)
  let response: Response
  try {
    response = await fetcher(requestedUrl, {
      headers: {
        accept:
          'text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.5',
      },
      redirect: 'follow',
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
        : `The job posting request failed: ${errorMessage(cause, 'Unknown request failure.')}`,
      requestedUrl
    )
  }

  const finalUrl = response.url || requestedUrl
  const mediaType =
    response.headers.get('content-type')?.trim() || 'application/octet-stream'

  let bytes: Uint8Array
  try {
    bytes = await readResponseBytes(response, maxBytes)
  } catch (cause) {
    const timedOut = timeoutSignal.aborted
    const failure = Match.value(cause).pipe(
      Match.when(Schema.is(PayloadTooLargeError), (error) => ({
        code: 'payload_too_large',
        message: error.message,
      })),
      Match.when(
        () => timedOut,
        () => ({
          code: 'request_timed_out',
          message: `The job posting request timed out after ${timeoutMilliseconds}ms.`,
        })
      ),
      Match.orElse((cause) => ({
        code: 'response_read_failed',
        message: errorMessage(
          cause,
          'The job posting response could not be read.'
        ),
      }))
    )
    return failedCapture(requestedUrl, failure.code, failure.message, finalUrl)
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
