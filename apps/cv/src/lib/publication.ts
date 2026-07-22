import {
  type CvDocumentV1,
  CvDocumentV1Schema,
  cvDocumentV1ContractId,
  cvDocumentV1Version,
} from '@cv/contracts/document'
import { Crypto, Effect, Schema } from 'effect'

export interface CvPublicResolverBinding {
  readonly fetch: (request: Request) => Promise<Response>
}

export const makeHttpCvPublicResolver = (
  origin: string | URL
): CvPublicResolverBinding => {
  const baseUrl = new URL(origin)
  return {
    fetch: (request) => {
      const source = new URL(request.url)
      const target = new URL(baseUrl)
      target.pathname = source.pathname
      target.search = source.search
      return fetch(new Request(target, request))
    },
  }
}

export type LoadedCvPublication = {
  readonly document: CvDocumentV1
  readonly publicUrl: string
  readonly tag: 'success'
}

export type CvPublicationLoadResult =
  | LoadedCvPublication
  | { readonly tag: 'invalid-publication' }
  | { readonly tag: 'not-found' }
  | { readonly tag: 'unavailable' }

export const maximumCvPublicationBytes = 256 * 1024

class InvalidCvPublication extends Schema.TaggedErrorClass<InvalidCvPublication>()(
  'InvalidCvPublication',
  { message: Schema.String }
) {}

class CvPublicationNotFound extends Schema.TaggedErrorClass<CvPublicationNotFound>()(
  'CvPublicationNotFound',
  {}
) {}

class CvPublicationUnavailable extends Schema.TaggedErrorClass<CvPublicationUnavailable>()(
  'CvPublicationUnavailable',
  {
    cause: Schema.Defect(),
    message: Schema.String,
  }
) {}

const headers = {
  byteLength: 'x-cv-content-byte-length',
  contractId: 'x-cv-contract-id',
  contractVersion: 'x-cv-contract-version',
  locale: 'x-cv-document-locale',
  publicUrl: 'x-cv-public-url',
  sha256: 'x-cv-content-sha256',
} as const

const invalidPublication = (message: string) =>
  new InvalidCvPublication({ message })

const unavailablePublication = (message: string, cause: unknown) =>
  new CvPublicationUnavailable({ cause, message })

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

const decodeDocument = (bytes: Uint8Array) =>
  Effect.try({
    try: () => {
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      return JSON.parse(text) as unknown
    },
    catch: () => invalidPublication('The publication body is not valid JSON.'),
  }).pipe(
    Effect.flatMap((json) =>
      Schema.decodeUnknownEffect(CvDocumentV1Schema)(json)
    ),
    Effect.mapError(() =>
      invalidPublication('The publication does not satisfy cv.document.v1.')
    )
  )

const validPublicUrl = (value: string, token: string): boolean => {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return false
    if (url.hash || url.search) return false
    const expectedSuffix = `/c/${encodeURIComponent(token)}`
    return url.pathname === expectedSuffix
  } catch {
    return false
  }
}

const positiveInteger = (value: string | null): number | null => {
  if (!value || !/^\d+$/u.test(value)) return null
  const parsed = Number.parseInt(value, 10)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

const loadCvDocument = Effect.fn('CvPublication.load')(function* (
  binding: CvPublicResolverBinding,
  token: string,
  resolverUrl: string
) {
  const response = yield* Effect.tryPromise({
    try: (signal) =>
      binding.fetch(new Request(resolverUrl, { method: 'GET', signal })),
    catch: (cause) =>
      unavailablePublication('The CV publication resolver failed.', cause),
  })

  if (response.status === 404) return yield* new CvPublicationNotFound()
  if (!response.ok) {
    return yield* unavailablePublication(
      `The CV publication resolver returned HTTP ${response.status}.`,
      new Error(response.statusText || `HTTP ${response.status}`)
    )
  }

  const contractId = response.headers.get(headers.contractId)
  const contractVersion = response.headers.get(headers.contractVersion)
  const locale = response.headers.get(headers.locale)
  const publicUrl = response.headers.get(headers.publicUrl)
  const expectedSha256 = response.headers.get(headers.sha256)
  const expectedByteLength = positiveInteger(
    response.headers.get(headers.byteLength)
  )
  const contentLength = positiveInteger(response.headers.get('content-length'))
  const mediaType = response.headers.get('content-type')?.split(';', 1)[0]

  if (
    contractId !== cvDocumentV1ContractId ||
    contractVersion !== cvDocumentV1Version.toString(10) ||
    mediaType !== 'application/json' ||
    !locale ||
    !publicUrl ||
    !validPublicUrl(publicUrl, token) ||
    !expectedSha256 ||
    !/^[a-f0-9]{64}$/u.test(expectedSha256) ||
    expectedByteLength === null
  ) {
    return yield* invalidPublication('The publication metadata is invalid.')
  }

  if (
    expectedByteLength > maximumCvPublicationBytes ||
    (contentLength !== null && contentLength > maximumCvPublicationBytes)
  ) {
    return yield* invalidPublication('The publication body is too large.')
  }

  const buffer = yield* Effect.tryPromise({
    try: () => response.arrayBuffer(),
    catch: (cause) =>
      unavailablePublication(
        'The CV publication body could not be read.',
        cause
      ),
  })
  const bytes = new Uint8Array(buffer)

  if (
    bytes.byteLength > maximumCvPublicationBytes ||
    bytes.byteLength !== expectedByteLength
  ) {
    return yield* invalidPublication(
      'The publication body length does not match its metadata.'
    )
  }

  const crypto = yield* Crypto.Crypto
  const digest = yield* crypto
    .digest('SHA-256', bytes)
    .pipe(
      Effect.mapError((cause) =>
        unavailablePublication(
          'The CV publication integrity check failed.',
          cause
        )
      )
    )
  if (bytesToHex(digest) !== expectedSha256) {
    return yield* invalidPublication(
      'The publication body does not match its integrity metadata.'
    )
  }

  const document = yield* decodeDocument(bytes)
  if (document.locale !== locale) {
    return yield* invalidPublication(
      'The publication locale does not match its metadata.'
    )
  }

  return { document, publicUrl, tag: 'success' } satisfies LoadedCvPublication
})

export const loadCvPublication = (
  binding: CvPublicResolverBinding,
  token: string
) =>
  loadCvDocument(
    binding,
    token,
    `https://registry.internal/cv-publications/${encodeURIComponent(token)}`
  )

export const loadCvPreview = (
  binding: CvPublicResolverBinding,
  token: string,
  previewToken: string
) => {
  const url = new URL(
    `https://registry.internal/cv-previews/${encodeURIComponent(token)}`
  )
  url.searchParams.set('access', previewToken)
  return loadCvDocument(binding, token, url.toString())
}

export const asCvPublicationLoadResult = <R>(
  effect: Effect.Effect<
    LoadedCvPublication,
    CvPublicationNotFound | CvPublicationUnavailable | InvalidCvPublication,
    R
  >
): Effect.Effect<CvPublicationLoadResult, never, R> =>
  effect.pipe(
    Effect.match({
      onFailure: (error): CvPublicationLoadResult => {
        switch (error._tag) {
          case 'CvPublicationNotFound':
            return { tag: 'not-found' }
          case 'CvPublicationUnavailable':
            return { tag: 'unavailable' }
          case 'InvalidCvPublication':
            return { tag: 'invalid-publication' }
        }
      },
      onSuccess: (publication): CvPublicationLoadResult => publication,
    })
  )
