import { describe, expect, test } from 'bun:test'
import { createServer } from 'node:http'
import { Effect } from 'effect'
import * as FetchHttpClient from 'effect/unstable/http/FetchHttpClient'
import { waitForServer } from './preview'

const listen = () =>
  new Promise<{ close: () => Promise<void>; url: string }>(
    (resolve, reject) => {
      const server = createServer((request, response) => {
        if (request.url === '/ready') {
          response.writeHead(200)
          response.end('ok')
          return
        }

        response.writeHead(404)
        response.end('not found')
      })

      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()

        if (typeof address !== 'object' || address === null) {
          reject(new Error('Test server did not expose a TCP address'))
          return
        }

        resolve({
          close: () =>
            new Promise<void>((closeResolve, closeReject) => {
              server.close((error) =>
                error ? closeReject(error) : closeResolve()
              )
            }),
          url: `http://127.0.0.1:${address.port}`,
        })
      })
    }
  )

describe('pdf export preview helpers', () => {
  test('waitForServer resolves when the preview responds successfully', async () => {
    const server = await listen()

    try {
      await expect(
        Effect.runPromise(
          waitForServer(server.url, '/ready').pipe(
            Effect.provide(FetchHttpClient.layer)
          )
        )
      ).resolves.toBeUndefined()
    } finally {
      await server.close()
    }
  })
})
