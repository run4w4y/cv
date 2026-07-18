import {
  type CvDocumentV1,
  CvDocumentV1Schema,
  cvDocumentV1ContractId,
  cvDocumentV1Version,
} from '@cv/contracts/document'
import { Effect, Result, Schema } from 'effect'

export interface CvPublicResolverBinding {
  readonly fetch: (request: Request) => Promise<Response>
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

const headers = {
  byteLength: 'x-cv-content-byte-length',
  contractId: 'x-cv-contract-id',
  contractVersion: 'x-cv-contract-version',
  locale: 'x-cv-document-locale',
  publicUrl: 'x-cv-public-url',
  sha256: 'x-cv-content-sha256',
} as const

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

export const sha256Hex = (bytes: Uint8Array): Promise<string> =>
  crypto.subtle
    .digest('SHA-256', Uint8Array.from(bytes).buffer)
    .then((digest) => bytesToHex(new Uint8Array(digest)))

const decodeDocument = (bytes: Uint8Array) =>
  Effect.try({
    try: () => {
      const json: unknown = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      )
      return json
    },
    catch: () => 'invalid-document' as const,
  }).pipe(
    Effect.flatMap((json) =>
      Schema.decodeUnknownEffect(CvDocumentV1Schema)(json)
    ),
    Effect.mapError(() => 'invalid-document' as const)
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

export const loadCvPublication = async (
  binding: CvPublicResolverBinding,
  token: string
): Promise<CvPublicationLoadResult> => {
  const response = await binding
    .fetch(
      new Request(
        `https://registry.internal/cv-publications/${encodeURIComponent(token)}`
      )
    )
    .catch(() => null)

  if (!response) return { tag: 'unavailable' }
  if (response.status === 404) return { tag: 'not-found' }
  if (!response.ok) return { tag: 'unavailable' }

  const contractId = response.headers.get(headers.contractId)
  const contractVersion = response.headers.get(headers.contractVersion)
  const locale = response.headers.get(headers.locale)
  const publicUrl = response.headers.get(headers.publicUrl)
  const expectedSha256 = response.headers.get(headers.sha256)
  const expectedByteLength = positiveInteger(
    response.headers.get(headers.byteLength)
  )
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
    return { tag: 'invalid-publication' }
  }

  const buffer = await response.arrayBuffer().catch(() => null)
  if (!buffer) return { tag: 'invalid-publication' }
  const bytes = new Uint8Array(buffer)
  if (bytes.byteLength !== expectedByteLength) {
    return { tag: 'invalid-publication' }
  }

  const actualSha256 = await sha256Hex(bytes).catch(() => null)
  if (actualSha256 !== expectedSha256) {
    return { tag: 'invalid-publication' }
  }

  const decoded = await decodeDocument(bytes).pipe(
    Effect.result,
    Effect.runPromise
  )
  if (Result.isFailure(decoded) || decoded.success.locale !== locale) {
    return { tag: 'invalid-publication' }
  }

  return { document: decoded.success, publicUrl, tag: 'success' }
}
