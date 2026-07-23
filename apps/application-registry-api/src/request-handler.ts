import { applicationRegistryApiPrefix } from '@cv/application-registry-api-contract'

const isPathAt = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`)

const isRegistryApiPath = (path: string) =>
  isPathAt(path, applicationRegistryApiPrefix)

const withPrivateCachePolicy = (request: Request, response: Response) => {
  const path = new URL(request.url).pathname
  if (isRegistryApiPath(path)) {
    response.headers.set('Cache-Control', 'private, no-store')
  }
  return response
}

export interface ApiServerRequestHandlerOptions {
  readonly apiHandler: (request: Request) => Promise<Response>
}

export const makeApiServerRequestHandler = (
  options: ApiServerRequestHandlerOptions
) => {
  return async (request: Request): Promise<Response> => {
    try {
      return withPrivateCachePolicy(request, await options.apiHandler(request))
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Registry API request failed.'
      return withPrivateCachePolicy(
        request,
        Response.json({ code: 'internal_error', message }, { status: 500 })
      )
    }
  }
}
