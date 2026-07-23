import { applicationRegistryApiPrefix } from '@cv/application-registry-api-contract'
import type {
  DesktopFetchRequest,
  DesktopHostBridge,
} from '@cv/application-registry-desktop-contract'
import { webRegistryConnection } from './web-registry-connection'

declare global {
  interface Window {
    readonly cvDesktop?: DesktopHostBridge
  }
}

export const desktopBridge = (): DesktopHostBridge | null =>
  globalThis.window?.cvDesktop ?? null

export const isDesktopHost = () => desktopBridge() !== null

const requestUrl = (input: RequestInfo | URL): URL => {
  if (input instanceof Request) return new URL(input.url)
  const value = input instanceof URL ? input.href : input
  return new URL(value, globalThis.location?.href)
}

const registryRequestPath = (input: RequestInfo | URL): string | null => {
  const url = requestUrl(input)
  if (
    url.pathname !== applicationRegistryApiPrefix &&
    !url.pathname.startsWith(`${applicationRegistryApiPrefix}/`)
  ) {
    return null
  }
  return `${url.pathname}${url.search}`
}

const serializeRequest = async (
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  url: string
): Promise<DesktopFetchRequest> => {
  const request =
    input instanceof Request
      ? new Request(input, init)
      : new Request(`https://desktop.invalid${url}`, init)
  const body =
    request.method === 'GET' || request.method === 'HEAD'
      ? null
      : new Uint8Array(await request.arrayBuffer())

  return {
    body,
    headers: headerEntries(request.headers),
    method: request.method,
    url,
  }
}

const headerEntries = (headers: Headers) => {
  const entries: Array<readonly [string, string]> = []
  headers.forEach((value, key) => {
    entries.push([key, value])
  })
  return entries
}

export const hostFetch = Object.assign(
  async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const bridge = desktopBridge()
    if (bridge === null) return webRegistryConnection().fetch(input, init)

    const registryUrl = registryRequestPath(input)
    if (registryUrl === null) return globalThis.fetch(input, init)

    const result = await bridge.network.fetch(
      await serializeRequest(input, init, registryUrl)
    )
    if (!result.ok) {
      throw new Error(result.error.message)
    }

    return new Response(Uint8Array.from(result.value.body).buffer, {
      headers: result.value.headers.map(
        ([key, value]) => [key, value] as [string, string]
      ),
      status: result.value.status,
      statusText: result.value.statusText,
    })
  },
  {
    preconnect: (...args: Parameters<typeof globalThis.fetch.preconnect>) =>
      globalThis.fetch.preconnect(...args),
  }
) satisfies typeof globalThis.fetch
