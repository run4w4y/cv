import { describe, expect, test } from 'bun:test'
import { makeApiServerRequestHandler } from './request-handler'

const makeHandler = (requests: Request[] = []) =>
  makeApiServerRequestHandler({
    apiHandler: (request) => {
      requests.push(request)
      return Promise.resolve(
        Response.json({ path: new URL(request.url).pathname })
      )
    },
  })

describe('application registry API server request boundary', () => {
  test('passes canonical API requests to the authenticated API router unchanged', async () => {
    const requests: Request[] = []
    const response = await makeHandler(requests)(
      new Request('https://registry.test/api/registry/applications', {
        headers: { authorization: 'Bearer registry-token' },
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(new URL(requests[0]?.url ?? '').pathname).toBe(
      '/api/registry/applications'
    )
    expect(requests[0]?.headers.get('authorization')).toBe(
      'Bearer registry-token'
    )
  })

  test('applies the private cache policy to every canonical Registry route', async () => {
    const requests: Request[] = []
    const response = await makeHandler(requests)(
      new Request(
        'https://registry.test/api/registry/facts/objects/releases/current.json',
        { headers: { authorization: 'Bearer registry-token' } }
      )
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(requests).toHaveLength(1)
  })
})
