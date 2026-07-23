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

const requestUrl = (input: RequestInfo | URL) => {
  if (input instanceof Request) return input.url
  const value = input instanceof URL ? input.href : input
  if (value.startsWith('/')) return value
  return new URL(value, globalThis.location?.href).href
}

const serializeRequest = async (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<DesktopFetchRequest> => {
  const url = requestUrl(input)
  const request =
    input instanceof Request
      ? new Request(input, init)
      : new Request(
          url.startsWith('/') ? `https://desktop.invalid${url}` : url,
          init
        )
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

    const result = await bridge.network.fetch(
      await serializeRequest(input, init)
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
