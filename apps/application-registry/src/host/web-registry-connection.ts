import {
  applicationRegistryApiPrefix,
  HealthResponseSchema,
  normalizeRegistryOrigin,
  RegistryOriginSchema,
} from '@cv/application-registry-api-contract'
import { Option, Schema } from 'effect'

import type {
  RegistryConnection,
  RegistryConnectionConfiguration,
  RegistryConnectionInput,
} from './registry-connection'

export const WEB_REGISTRY_CONNECTION_SCHEMA_VERSION = 1
export const WEB_REGISTRY_CONNECTION_STORAGE_KEY =
  'cv.application-registry.connection'

type RegistryFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>

type WebRegistryEnvironment = {
  readonly VITE_REGISTRY_API_URL?: string
}

type DirectConnection = {
  readonly mode: 'direct'
  readonly origin: string
  readonly source: 'default' | 'override'
  readonly token: string
}

type UnconfiguredConnection = {
  readonly mode: 'unconfigured'
  readonly origin: string
  readonly source: 'default'
}

type ActiveWebRegistryConnection = DirectConnection | UnconfiguredConnection

export interface WebRegistryConnection extends RegistryConnection {
  readonly fetch: RegistryFetch
  readonly reset: () => Promise<RegistryConnectionConfiguration>
}

const RegistryTokenSchema = Schema.Trim.pipe(Schema.check(Schema.isNonEmpty()))
const StoredConnectionSchema = Schema.Struct({
  schemaVersion: Schema.Literal(WEB_REGISTRY_CONNECTION_SCHEMA_VERSION),
  origin: RegistryOriginSchema,
  token: RegistryTokenSchema,
})

const runtimeEnvironment: WebRegistryEnvironment = {
  VITE_REGISTRY_API_URL: import.meta.env.VITE_REGISTRY_API_URL,
}

const DEFAULT_REGISTRY_API_URL = 'https://cv-api.4w4y.run'

const browserStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

const parseRegistryOrigin = (raw: string): string => {
  try {
    return normalizeRegistryOrigin(raw)
  } catch {
    throw new Error('Enter a valid Registry API URL.')
  }
}

const parseRegistryToken = (raw: string): string => {
  try {
    return Schema.decodeUnknownSync(RegistryTokenSchema)(raw)
  } catch {
    throw new Error('The Registry bearer token is required.')
  }
}

const directConnection = (
  origin: string,
  token: string,
  source: DirectConnection['source']
): DirectConnection => ({
  mode: 'direct',
  origin: parseRegistryOrigin(origin),
  source,
  token: parseRegistryToken(token),
})

const loadStoredConnection = (
  storage: Storage | null
): DirectConnection | null => {
  if (storage === null) return null
  let raw: string | null
  try {
    raw = storage.getItem(WEB_REGISTRY_CONNECTION_STORAGE_KEY)
  } catch {
    return null
  }
  if (raw === null) return null

  try {
    const decoded = Option.getOrNull(
      Schema.decodeUnknownOption(StoredConnectionSchema)(JSON.parse(raw))
    )
    return decoded === null
      ? null
      : {
          mode: 'direct',
          origin: normalizeRegistryOrigin(decoded.origin),
          source: 'override',
          token: decoded.token,
        }
  } catch {
    return null
  }
}

const defaultConnection = (
  environment: WebRegistryEnvironment
): UnconfiguredConnection => ({
  mode: 'unconfigured',
  origin: parseRegistryOrigin(
    environment.VITE_REGISTRY_API_URL?.trim() || DEFAULT_REGISTRY_API_URL
  ),
  source: 'default',
})

const connectionConfiguration = (
  connection: ActiveWebRegistryConnection
): RegistryConnectionConfiguration => ({
  configured: connection.mode === 'direct',
  editable: true,
  origin: connection.origin,
  resettable: connection.source === 'override',
  source: connection.source,
  tokenConfigured: connection.mode === 'direct',
})

const isRegistryRequest = (url: URL) =>
  url.pathname === applicationRegistryApiPrefix ||
  url.pathname.startsWith(`${applicationRegistryApiPrefix}/`)

const requestUrl = (input: RequestInfo | URL, hostOrigin: string): URL => {
  if (input instanceof Request) return new URL(input.url)
  return new URL(input instanceof URL ? input.href : input, hostOrigin)
}

const authenticatedRequest = (
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  connection: DirectConnection,
  hostOrigin: string
): readonly [URL, RequestInit] => {
  const incomingUrl = requestUrl(input, hostOrigin)
  const target = new URL(
    `${incomingUrl.pathname}${incomingUrl.search}`,
    connection.origin
  )
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined)
  )
  headers.set('authorization', `Bearer ${connection.token}`)
  if (!(input instanceof Request)) return [target, { ...init, headers }]

  const method = init?.method ?? input.method
  return [
    target,
    {
      body:
        method === 'GET' || method === 'HEAD'
          ? undefined
          : (init?.body ?? input.body),
      cache: input.cache,
      credentials: input.credentials,
      integrity: input.integrity,
      keepalive: input.keepalive,
      method,
      mode: input.mode,
      redirect: input.redirect,
      referrer: input.referrer,
      referrerPolicy: input.referrerPolicy,
      signal: init?.signal ?? input.signal,
      ...init,
      headers,
    },
  ]
}

const verifyConnection = async (
  connection: DirectConnection,
  fetcher: RegistryFetch,
  timeoutMs: number
) =>
  withVerificationTimeout(timeoutMs, async (signal) => {
    const response = await fetcher(
      new URL(`${applicationRegistryApiPrefix}/health`, connection.origin),
      {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${connection.token}`,
        },
        signal,
      }
    )
    if (response.status === 401 || response.status === 403) {
      throw new Error('The Registry API rejected the bearer token.')
    }
    if (response.status !== 200) {
      throw new Error(
        `The Registry health check returned HTTP ${response.status}.`
      )
    }

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new Error('The Registry health check returned an invalid response.')
    }
    const health = Option.getOrNull(
      Schema.decodeUnknownOption(HealthResponseSchema)(payload)
    )
    if (health?.ok !== true) {
      throw new Error(
        'The Registry health check did not report a healthy service.'
      )
    }
  })

const withVerificationTimeout = async <Value>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<Value>
): Promise<Value> => {
  const controller = new AbortController()
  let timeout: ReturnType<typeof globalThis.setTimeout> | undefined
  const expired = new Promise<never>((_resolve, reject) => {
    timeout = globalThis.setTimeout(() => {
      controller.abort()
      reject(new Error('The Registry health check timed out.'))
    }, timeoutMs)
  })

  try {
    return await Promise.race([operation(controller.signal), expired])
  } finally {
    if (timeout !== undefined) globalThis.clearTimeout(timeout)
  }
}

const persistConnection = (
  storage: Storage | null,
  connection: DirectConnection
) => {
  if (storage === null) {
    throw new Error('Browser storage is unavailable.')
  }
  try {
    storage.setItem(
      WEB_REGISTRY_CONNECTION_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: WEB_REGISTRY_CONNECTION_SCHEMA_VERSION,
        origin: connection.origin,
        token: connection.token,
      })
    )
  } catch {
    throw new Error('The Registry connection could not be saved.')
  }
}

const clearConnection = (storage: Storage | null) => {
  if (storage === null) {
    throw new Error('Browser storage is unavailable.')
  }
  try {
    storage.removeItem(WEB_REGISTRY_CONNECTION_STORAGE_KEY)
  } catch {
    throw new Error('The Registry connection could not be reset.')
  }
}

export const createWebRegistryConnection = (
  options: {
    readonly environment?: WebRegistryEnvironment
    readonly fetch?: RegistryFetch
    readonly hostOrigin?: string
    readonly storage?: Storage | null
    readonly verificationTimeoutMs?: number
  } = {}
): WebRegistryConnection => {
  const environment = options.environment ?? runtimeEnvironment
  const fetcher =
    options.fetch ??
    ((input: RequestInfo | URL, init?: RequestInit) =>
      globalThis.fetch(input, init))
  const hostOrigin =
    options.hostOrigin ?? globalThis.location?.origin ?? 'http://localhost'
  const storage =
    options.storage === undefined ? browserStorage() : options.storage
  const verificationTimeoutMs = options.verificationTimeoutMs ?? 15_000
  let active: ActiveWebRegistryConnection | null = null

  const readActive = () => {
    active ??= loadStoredConnection(storage) ?? defaultConnection(environment)
    return active
  }

  const configure = async (
    input: RegistryConnectionInput
  ): Promise<RegistryConnectionConfiguration> => {
    const current = readActive()
    const replacementToken = input.token?.trim() ?? ''
    const token =
      replacementToken.length > 0
        ? replacementToken
        : current.mode === 'direct'
          ? current.token
          : ''
    const next = directConnection(input.origin, token, 'override')
    await verifyConnection(next, fetcher, verificationTimeoutMs)
    persistConnection(storage, next)
    active = next
    return connectionConfiguration(next)
  }

  const reset = async (): Promise<RegistryConnectionConfiguration> => {
    clearConnection(storage)
    active = defaultConnection(environment)
    return connectionConfiguration(active)
  }

  return {
    configure,
    current: () => connectionConfiguration(readActive()),
    fetch: async (input, init) => {
      const connection = readActive()
      const url = requestUrl(input, hostOrigin)
      if (!isRegistryRequest(url)) return fetcher(input, init)
      if (connection.mode !== 'direct') {
        throw new Error('The Registry API connection is not configured.')
      }
      const [target, routedInit] = authenticatedRequest(
        input,
        init,
        connection,
        hostOrigin
      )
      return fetcher(target, routedInit)
    },
    kind: 'web',
    reset,
    status: async () => connectionConfiguration(readActive()),
  }
}

let defaultWebRegistryConnection: WebRegistryConnection | undefined

export const webRegistryConnection = (): WebRegistryConnection => {
  defaultWebRegistryConnection ??= createWebRegistryConnection()
  return defaultWebRegistryConnection
}

export const invalidateWebRegistryConnection = () => {
  defaultWebRegistryConnection = undefined
}
