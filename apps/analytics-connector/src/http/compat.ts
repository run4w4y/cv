import { knownConnectorPaths } from './api'

const jsonHeaders = {
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json; charset=utf-8',
}

export const jsonResponse = (
  value: unknown,
  init: ResponseInit = {}
): Response =>
  new Response(JSON.stringify(value), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...init.headers,
    },
  })

export const errorResponse = (
  status: number,
  code: string,
  message: string
): Response =>
  jsonResponse(
    {
      code,
      message,
    },
    { status }
  )

export const isKnownConnectorPath = (request: Request) => {
  const url = new URL(request.url)

  return knownConnectorPaths.has(url.pathname)
}
