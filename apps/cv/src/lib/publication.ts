import { type CvDocumentV1, CvDocumentV1Schema } from '@cv/contracts/document'
import { Effect, Schema } from 'effect'

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

const publicUrlHeader = 'x-cv-public-url'

const invalidPublication = (message: string) =>
  new InvalidCvPublication({ message })

const unavailablePublication = (message: string, cause: unknown) =>
  new CvPublicationUnavailable({ cause, message })

const decodeDocument = (text: string) =>
  Effect.try({
    try: () => JSON.parse(text) as unknown,
    catch: () => invalidPublication('The publication body is not valid JSON.'),
  }).pipe(
    Effect.flatMap((json) =>
      Schema.decodeUnknownEffect(CvDocumentV1Schema)(json)
    ),
    Effect.mapError(() =>
      invalidPublication('The publication does not satisfy cv.document.v1.')
    )
  )

const loadCvDocument = Effect.fn('CvPublication.load')(function* (
  binding: CvPublicResolverBinding,
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

  const text = yield* Effect.tryPromise({
    try: () => response.text(),
    catch: (cause) =>
      unavailablePublication(
        'The CV publication body could not be read.',
        cause
      ),
  })
  const document = yield* decodeDocument(text)
  const publicUrl = response.headers.get(publicUrlHeader)
  if (publicUrl === null) {
    return yield* invalidPublication(
      'The CV publication resolver omitted its public URL.'
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
  return loadCvDocument(binding, url.toString())
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
