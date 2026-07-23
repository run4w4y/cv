import type {
  DesktopBridgeError,
  DesktopBridgeResult,
  DesktopHostBridge,
  DesktopRegistryConfiguration,
  DesktopRegistryConfigureInput,
} from '@cv/application-registry-desktop-contract'

import { desktopBridge } from './desktop'
import { webRegistryConnection } from './web-registry-connection'

export type RegistryConnectionConfiguration = {
  readonly configured: boolean
  readonly editable: boolean
  readonly origin: string | null
  readonly resettable: boolean
  readonly source:
    | 'default'
    | 'environment'
    | 'override'
    | 'stored'
    | 'unconfigured'
  readonly tokenConfigured: boolean
}

export type RegistryConnectionInput = {
  readonly origin: string
  readonly token?: string
}

export interface RegistryConnection {
  readonly configure: (
    input: RegistryConnectionInput
  ) => Promise<RegistryConnectionConfiguration>
  readonly current: () => RegistryConnectionConfiguration | null
  readonly kind: 'desktop' | 'web'
  readonly reset?: () => Promise<RegistryConnectionConfiguration>
  readonly status: () => Promise<RegistryConnectionConfiguration>
}

export class RegistryConnectionError extends Error {
  readonly code: DesktopBridgeError['code']
  readonly details: string | null

  constructor(error: DesktopBridgeError) {
    super(error.message, { cause: error })
    this.name = 'RegistryConnectionError'
    this.code = error.code
    this.details = error.details ?? null
  }
}

const desktopConfiguration = (
  configuration: DesktopRegistryConfiguration
): RegistryConnectionConfiguration => ({
  ...configuration,
  resettable: false,
  tokenConfigured: configuration.configured,
})

const desktopResult = async <Value>(
  operation: Promise<DesktopBridgeResult<Value>>
): Promise<Value> => {
  const result = await operation
  if (!result.ok) throw new RegistryConnectionError(result.error)
  return result.value
}

export const desktopRegistryConnection = (
  bridge: DesktopHostBridge
): RegistryConnection => ({
  configure: async (input: DesktopRegistryConfigureInput) =>
    desktopConfiguration(await desktopResult(bridge.registry.configure(input))),
  current: () => null,
  kind: 'desktop',
  status: async () =>
    desktopConfiguration(await desktopResult(bridge.registry.status())),
})

export const registryConnection = (): RegistryConnection => {
  const bridge = desktopBridge()
  return bridge === null
    ? webRegistryConnection()
    : desktopRegistryConnection(bridge)
}
