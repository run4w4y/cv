import { makeApplicationRegistryHttpClientLayer } from '@cv/application-registry-api-client'
import { BunServices } from '@effect/platform-bun'
import { Layer, Logger } from 'effect'
import { McpServer } from 'effect/unstable/ai'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'

import type { ApplicationRegistryMcpConfig } from './config'
import { ApplicationRegistryGatewayLive } from './gateway'
import {
  ApplicationRegistryToolkit,
  ApplicationRegistryToolkitHandlers,
} from './tools'

export const applicationRegistryMcpServerName = 'application-registry'
export const applicationRegistryMcpServerVersion = '0.1.0'

export const makeApplicationRegistryMcpServerLayer = (
  configuration: ApplicationRegistryMcpConfig
) => {
  const registrations = McpServer.toolkit(ApplicationRegistryToolkit).pipe(
    Layer.provide(ApplicationRegistryToolkitHandlers)
  )

  return Layer.merge(
    McpServer.layerStdio({
      name: applicationRegistryMcpServerName,
      version: applicationRegistryMcpServerVersion,
    }),
    registrations
  ).pipe(
    Layer.provide(ApplicationRegistryGatewayLive),
    Layer.provide(
      makeApplicationRegistryHttpClientLayer({
        baseUrl: configuration.apiUrl,
        token: configuration.token,
      })
    ),
    Layer.provide(Layer.merge(BunServices.layer, FetchHttpClient.layer)),
    Layer.provide(Layer.succeed(Logger.LogToStderr)(true))
  )
}
