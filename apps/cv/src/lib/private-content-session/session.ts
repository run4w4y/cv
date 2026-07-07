import {
  getContent,
  loadPrivateRuntimeProfile,
  privateContentFileIndex,
} from 'virtual:content/generated/runtime'
import { PrivateCryptoLayer } from '@cv/private-content-crypto'
import {
  ContentAccessToken,
  type ContentSessionRoute,
  type ContentSessionStatus,
  decodeContentFileIndex,
  loadContentSessionForToken as loadRuntimeCvSessionForToken,
  makeUnavailableContentSession as makeUnavailableRuntimeCvSession,
  type ContentSession as RuntimeCvSession,
  type ContentCatalog as SessionContentCatalog,
} from '@cv/private-content-session'
import { Context, Effect, Layer, Option } from 'effect'
import type { CvContent } from '@/cv-content/model'
import {
  CvPageContext,
  type CvPageContextValue,
} from '@/lib/private-content-session/page-context'

export type {
  ContentSessionRoute as CvSessionRoute,
  ContentSessionStatus as CvSessionStatus,
}

export type CvContentCatalogService = SessionContentCatalog<CvContent>

export class CvContentCatalog extends Context.Service<
  CvContentCatalog,
  CvContentCatalogService
>()('@cv/cv/CvContentCatalog') {}

const fileIndex = decodeContentFileIndex(privateContentFileIndex)

export const cvContentCatalog: CvContentCatalogService = {
  fileIndex,
  loadPrivateRuntimeProfile,
  readContent: getContent,
}

export const CvContentCatalogLayer = Layer.succeed(
  CvContentCatalog,
  cvContentCatalog
)

export type CvSession = RuntimeCvSession<CvContent, CvPageContextValue>

export const makePublicCvSession = ({
  content,
  page,
}: {
  content: CvContent
  page: CvPageContextValue
}): CvSession => ({
  content,
  files: cvContentCatalog.fileIndex,
  page,
  private: {
    fileKeys: null,
    variables: {},
  },
  route: null,
  status: 'public',
})

export const loadCvSession = Effect.gen(function* () {
  const page = yield* CvPageContext
  const catalog = yield* CvContentCatalog
  const accessToken = yield* ContentAccessToken
  const token = Option.getOrNull(yield* accessToken.read)

  return yield* loadRuntimeCvSessionForToken({
    catalog,
    page,
    token,
  }).pipe(
    Effect.provide(PrivateCryptoLayer),
    Effect.catchTag('PrivateCryptoUnavailableError', () =>
      Effect.succeed(makeUnavailableRuntimeCvSession({ catalog, page, token }))
    )
  )
})
