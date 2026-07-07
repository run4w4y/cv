import { BrowserStreamSaveLayer } from '@cv/browser-stream-save'
import { PrivateCryptoLayer } from '@cv/private-content-crypto'
import { openContentFile } from '@cv/private-content-session'
import { Effect, Layer } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'
import * as Atom from 'effect/unstable/reactivity/Atom'
import { CvBrowserAccessTokenLayer } from '@/lib/private-content-session/browser-access-token'
import { CvBrowserPrivateFileIOLayer } from '@/lib/private-content-session/browser-private-file-io'
import {
  CvPageContext,
  type CvPageContextValue,
  readCvPageContext,
} from '@/lib/private-content-session/page-context'
import {
  CvContentCatalogLayer,
  loadCvSession,
} from '@/lib/private-content-session/session'

export const cvPageContextAtom = Atom.make<CvPageContextValue>(
  readCvPageContext()
).pipe(Atom.keepAlive)

const CvBrowserFetchOptionsLayer = Layer.succeed(FetchHttpClient.RequestInit, {
  cache: 'no-store',
  credentials: 'same-origin',
} satisfies RequestInit)

const CvBrowserHttpClientLayer = FetchHttpClient.layer.pipe(
  Layer.provide(CvBrowserFetchOptionsLayer)
)

const CvBrowserPrivateFileIODependenciesLayer = Layer.mergeAll(
  BrowserStreamSaveLayer,
  CvBrowserHttpClientLayer
)

const CvBrowserPrivateFileIOLiveLayer = CvBrowserPrivateFileIOLayer.pipe(
  Layer.provide(CvBrowserPrivateFileIODependenciesLayer)
)

const makeCvRuntimeLayer = (page: CvPageContextValue) =>
  Layer.mergeAll(
    Layer.succeed(CvPageContext, page),
    CvContentCatalogLayer,
    CvBrowserAccessTokenLayer,
    CvBrowserPrivateFileIOLiveLayer
  )

export const cvRuntime = Atom.runtime((get) =>
  makeCvRuntimeLayer(get(cvPageContextAtom))
)

export const cvSessionAtom = cvRuntime
  .atom(loadCvSession)
  .pipe(Atom.withServerValueInitial)
  .pipe(Atom.keepAlive)

export const openCvFileCommand = cvRuntime.fn<string>()((href, get) =>
  get
    .result(cvSessionAtom)
    .pipe(
      Effect.flatMap((session) =>
        openContentFile(session, href).pipe(Effect.provide(PrivateCryptoLayer))
      )
    )
)
