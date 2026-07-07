import type { WebCryptoApi } from '@cv/private-content-crypto'
import { PrivateRuntimeManifestError } from '@cv/private-content-protocol'
import {
  decodePrivateCapabilityToken,
  type PrivateCapabilityTokenError,
} from '@cv/private-content-tokens'
import { Effect, Option } from 'effect'
import { ContentAccessToken } from './access-token'
import type {
  ContentCatalog,
  ContentPageContext,
  ContentSession,
  ContentSessionRoute,
  ContentSessionStatus,
} from './types'
import {
  type PrivateContentUnlockError,
  type PrivateContentUnlockResult,
  unlockPrivateContentProfile,
} from './unlock'

type AuthenticatedContentSessionRoute = ContentSessionRoute & {
  readonly token: string
}

type ContentSessionInput<
  Content,
  Page extends ContentPageContext = ContentPageContext,
> = {
  readonly catalog: ContentCatalog<Content>
  readonly page: Page
}

type ContentSessionTokenInput<
  Content,
  Page extends ContentPageContext = ContentPageContext,
> = ContentSessionInput<Content, Page> & {
  readonly token: string | null
}

type PublicSessionOptions<
  Content,
  Page extends ContentPageContext = ContentPageContext,
> = ContentSessionInput<Content, Page> & {
  readonly route: ContentSessionRoute | null
  readonly status: ContentSessionStatus
}

type LoadPrivateRuntimeProfileInput<Content> = {
  readonly catalog: ContentCatalog<Content>
  readonly locale: ContentPageContext['locale']
  readonly selector: string
}

type UnlockPrivateSessionContentInput<
  Content,
  Page extends ContentPageContext = ContentPageContext,
> = ContentSessionInput<Content, Page> & {
  readonly content: Content
  readonly route: AuthenticatedContentSessionRoute
}

type SessionFromUnlockResultInput<
  Content,
  Page extends ContentPageContext = ContentPageContext,
> = ContentSessionInput<Content, Page> & {
  readonly result: PrivateContentUnlockResult<Content>
  readonly route: ContentSessionRoute
}

export const contentSessionRoute = (
  page: ContentPageContext,
  token: string | null
): ContentSessionRoute | null =>
  page.audience
    ? {
        audienceId: page.audience,
        token,
      }
    : null

const readPublicContent = <Content>(
  catalog: ContentCatalog<Content>,
  page: ContentPageContext
) =>
  catalog.readContent({
    locale: page.locale,
    profile: page.contentProfile ?? page.profile,
  })

const publicSession = <
  Content,
  Page extends ContentPageContext = ContentPageContext,
>({
  catalog,
  page,
  route,
  status,
}: PublicSessionOptions<Content, Page>): ContentSession<Content, Page> => {
  const content = readPublicContent(catalog, page)

  return {
    content,
    files: catalog.fileIndex,
    page,
    private: {
      fileKeys: null,
      variables: {},
    },
    route,
    status,
  }
}

export const makeInitialContentSession = <
  Content,
  Page extends ContentPageContext = ContentPageContext,
>({
  catalog,
  page,
}: ContentSessionInput<Content, Page>): ContentSession<Content, Page> => {
  const route = contentSessionRoute(page, null)

  return publicSession({
    catalog,
    page,
    route,
    status: route ? 'loading' : 'public',
  })
}

export const makeUnavailableContentSession = <
  Content,
  Page extends ContentPageContext = ContentPageContext,
>({
  catalog,
  page,
  token,
}: ContentSessionTokenInput<Content, Page>): ContentSession<Content, Page> =>
  publicSession({
    catalog,
    page,
    route: contentSessionRoute(page, token),
    status: 'unavailable',
  })

const loadPrivateRuntimeProfile = <Content>({
  catalog,
  locale,
  selector,
}: LoadPrivateRuntimeProfileInput<Content>) =>
  Effect.tryPromise({
    try: () =>
      catalog.loadPrivateRuntimeProfile({
        locale,
        selector,
      }),
    catch: (cause) =>
      new PrivateRuntimeManifestError({
        cause,
        message: 'Could not load private runtime profile',
      }),
  }).pipe(
    Effect.flatMap((profile) =>
      profile
        ? Effect.succeed(profile)
        : Effect.fail(
            new PrivateRuntimeManifestError({
              message: `No private runtime profile matches ${locale}/${selector}`,
            })
          )
    )
  )

const unlockPrivateSessionContent = <
  Content,
  Page extends ContentPageContext = ContentPageContext,
>({
  catalog,
  content,
  page,
  route,
}: UnlockPrivateSessionContentInput<Content, Page>): Effect.Effect<
  PrivateContentUnlockResult<Content>,
  PrivateContentUnlockError | PrivateCapabilityTokenError,
  WebCryptoApi
> =>
  decodePrivateCapabilityToken(route.token).pipe(
    Effect.flatMap((capability) =>
      loadPrivateRuntimeProfile({
        catalog,
        locale: page.locale,
        selector: capability.profileSelector,
      }).pipe(
        Effect.flatMap((profile) =>
          unlockPrivateContentProfile({
            capability,
            locale: page.locale,
            profile,
            publicContent: content,
          })
        )
      )
    )
  )

const sessionFromUnlockResult = <
  Content,
  Page extends ContentPageContext = ContentPageContext,
>({
  catalog,
  page,
  result,
  route,
}: SessionFromUnlockResultInput<Content, Page>): ContentSession<
  Content,
  Page
> => ({
  content: result.content,
  files: catalog.fileIndex,
  page,
  private: {
    fileKeys: result.fileKeys,
    variables: result.variables,
  },
  route: {
    ...route,
    profileId: result.profileId,
  },
  status: 'unlocked',
})

export const loadContentSessionForToken = <
  Content,
  Page extends ContentPageContext = ContentPageContext,
>({
  catalog,
  page,
  token,
}: ContentSessionTokenInput<Content, Page>) =>
  Effect.gen(function* () {
    if (!page.audience) {
      return publicSession({
        catalog,
        page,
        route: null,
        status: 'public',
      })
    }

    const route = {
      audienceId: page.audience,
      token,
    } satisfies ContentSessionRoute
    const content = readPublicContent(catalog, page)

    if (!route.token) {
      return publicSession({
        catalog,
        page,
        route,
        status: 'invalid',
      })
    }

    return yield* unlockPrivateSessionContent({
      catalog,
      content,
      page,
      route: {
        ...route,
        token: route.token,
      },
    }).pipe(
      Effect.map((result) =>
        sessionFromUnlockResult({
          catalog,
          page,
          result,
          route,
        })
      ),
      Effect.catchTag('PrivateCryptoUnavailableError', () =>
        Effect.succeed(
          publicSession({
            catalog,
            page,
            route,
            status: 'unavailable',
          })
        )
      ),
      Effect.catch(() =>
        Effect.succeed(
          publicSession({
            catalog,
            page,
            route,
            status: 'invalid',
          })
        )
      )
    )
  })

export const loadContentSession = <
  Content,
  Page extends ContentPageContext = ContentPageContext,
>({
  catalog,
  page,
}: ContentSessionInput<Content, Page>) =>
  Effect.gen(function* () {
    const accessToken = yield* ContentAccessToken
    const token = Option.getOrNull(yield* accessToken.read)

    return yield* loadContentSessionForToken({
      catalog,
      page,
      token,
    })
  })
