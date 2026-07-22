import {
  type ApplicationRegistryError,
  CvPublicationsService,
} from '@cv/application-registry-service'
import { Effect, Match } from 'effect'
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from 'effect/unstable/http'

export const cvPublicationHeaders = {
  byteLength: 'x-cv-content-byte-length',
  contractId: 'x-cv-contract-id',
  contractVersion: 'x-cv-contract-version',
  locale: 'x-cv-document-locale',
  publicUrl: 'x-cv-public-url',
  sha256: 'x-cv-content-sha256',
} as const

export type PublicCvResolution = {
  readonly byteLength: number
  readonly bytes: Uint8Array
  readonly contractId: string
  readonly contractVersion: string
  readonly locale: string
  readonly mediaType: string
  readonly publicUrl: string
  readonly sha256: string
}

export type ResolvePublicCv = (
  token: string
) => Effect.Effect<PublicCvResolution, ApplicationRegistryError>

export type ResolveCvPreview = (
  token: string,
  previewToken: string
) => Effect.Effect<PublicCvResolution, ApplicationRegistryError>

const notFound = () =>
  new Response('Not found', {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    },
    status: 404,
  })

const methodNotAllowed = () =>
  new Response('Method not allowed', {
    headers: {
      Allow: 'GET',
      'Cache-Control': 'private, no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
    status: 405,
  })

const internalError = () =>
  new Response('Internal resolver error', {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
    status: 500,
  })

const resolutionErrorResponse = Match.type<ApplicationRegistryError>().pipe(
  Match.tags({
    RegistryAnalyticsError: internalError,
    RegistryArtifactError: internalError,
    RegistryBadRequestError: internalError,
    RegistryConflictError: internalError,
    RegistryDatabaseError: internalError,
    RegistryEventPublishError: internalError,
    RegistryNotFoundError: notFound,
    RegistryQueryTooComplexError: internalError,
  }),
  Match.exhaustive
)

export const parseCvPublicationResolverToken = (
  pathname: string
): string | null => {
  const match = /^\/cv-publications\/([^/]+)$/u.exec(pathname)
  if (!match?.[1]) return null

  try {
    const token = decodeURIComponent(match[1])
    return token.length > 0 && !token.includes('/') ? token : null
  } catch {
    return null
  }
}

export const parseCvPreviewResolverToken = (
  pathname: string
): string | null => {
  const match = /^\/cv-previews\/([^/]+)$/u.exec(pathname)
  if (!match?.[1]) return null

  try {
    const token = decodeURIComponent(match[1])
    return token.length > 0 && !token.includes('/') ? token : null
  } catch {
    return null
  }
}

const publicationResponse = (publication: PublicCvResolution) =>
  new Response(Uint8Array.from(publication.bytes).buffer, {
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Type': publication.mediaType,
      [cvPublicationHeaders.byteLength]: publication.byteLength.toString(10),
      [cvPublicationHeaders.contractId]: publication.contractId,
      [cvPublicationHeaders.contractVersion]: publication.contractVersion,
      [cvPublicationHeaders.locale]: publication.locale,
      [cvPublicationHeaders.publicUrl]: publication.publicUrl,
      [cvPublicationHeaders.sha256]: publication.sha256,
    },
    status: 200,
  })

export const makeCvPublicResolverHandler = (
  resolve: ResolvePublicCv,
  resolvePreview?: ResolveCvPreview
) =>
  async function handleCvPublicResolverRequest(
    request: Request
  ): Promise<Response> {
    const url = new URL(request.url)
    const publicToken = parseCvPublicationResolverToken(url.pathname)
    const previewToken = parseCvPreviewResolverToken(url.pathname)
    if (!publicToken && !previewToken) return notFound()
    if (request.method !== 'GET') return methodNotAllowed()

    let resolution: ReturnType<ResolvePublicCv> | null = null
    if (publicToken !== null) {
      resolution = resolve(publicToken)
    } else if (resolvePreview !== undefined && previewToken !== null) {
      const access = url.searchParams.get('access')
      if (access !== null && access.length > 0) {
        resolution = resolvePreview(previewToken, access)
      }
    }
    if (resolution === null) return notFound()

    return resolution.pipe(
      Effect.match({
        onFailure: resolutionErrorResponse,
        onSuccess: publicationResponse,
      }),
      Effect.runPromise
    )
  }

const resolvePublicCv =
  (publications: CvPublicationsService): ResolvePublicCv =>
  (token) =>
    Effect.gen(function* () {
      const { bytes, entry, link, revision } =
        yield* publications.resolve(token)

      return {
        byteLength: revision.byteLength,
        bytes,
        contractId: revision.contractId,
        contractVersion: revision.contractVersion,
        locale: entry.locale,
        mediaType: revision.mediaType,
        publicUrl: link.publicUrl,
        sha256: revision.sha256,
      }
    })

const resolveCvPreview =
  (publications: CvPublicationsService): ResolveCvPreview =>
  (token, previewToken) =>
    Effect.gen(function* () {
      const { bytes, entry, link, revision } =
        yield* publications.resolvePreview(token, previewToken)

      return {
        byteLength: revision.byteLength,
        bytes,
        contractId: revision.contractId,
        contractVersion: revision.contractVersion,
        locale: entry.locale,
        mediaType: revision.mediaType,
        publicUrl: link.publicUrl,
        sha256: revision.sha256,
      }
    })

export const CvPublicResolverRoutesLayer = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const publications = yield* CvPublicationsService
    const handler = makeCvPublicResolverHandler(
      resolvePublicCv(publications),
      resolveCvPreview(publications)
    )
    const route = (request: HttpServerRequest.HttpServerRequest) =>
      HttpServerRequest.toWeb(request).pipe(
        Effect.orDie,
        Effect.flatMap((webRequest) =>
          Effect.promise(() =>
            handler(webRequest).then(HttpServerResponse.fromWeb)
          )
        )
      )

    yield* router.add('*', '/cv-publications/:token', route)
    yield* router.add('*', '/cv-previews/:token', route)
  })
)
