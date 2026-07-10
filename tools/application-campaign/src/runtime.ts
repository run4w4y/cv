import { type PdfExporter, PdfExporterLive } from '@cv/pdf-export'
import { WebCryptoApiLayer } from '@cv/private-content-crypto'
import {
  type PrivateContentLink,
  PrivateContentLinkLive,
} from '@cv/private-content-link'
import { BunServices } from '@effect/platform-bun'
import { Layer } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'
import type * as HttpClient from 'effect/unstable/http/HttpClient'

export type ApplicationCampaignRuntime =
  | BunServices.BunServices
  | HttpClient.HttpClient
  | PdfExporter
  | PrivateContentLink

const PlatformLayer = Layer.merge(BunServices.layer, FetchHttpClient.layer)
const PrivateContentLinkLayer = PrivateContentLinkLive.pipe(
  Layer.provide(WebCryptoApiLayer)
)
const PdfExporterLayer = PdfExporterLive.pipe(Layer.provide(PlatformLayer))

export const ApplicationCampaignRuntimeLayer = Layer.mergeAll(
  PlatformLayer,
  PrivateContentLinkLayer,
  PdfExporterLayer
)
