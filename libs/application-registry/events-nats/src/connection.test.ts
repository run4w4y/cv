import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'

import { releaseNatsConnection } from './connection'

describe('NATS connection release', () => {
  test('drains the connection during normal release', async () => {
    const actions: string[] = []

    await Effect.runPromise(
      releaseNatsConnection({
        close: async () => {
          actions.push('close')
        },
        drain: async () => {
          actions.push('drain')
        },
      })
    )

    expect(actions).toEqual(['drain'])
  })

  test('closes the connection when draining fails', async () => {
    const actions: string[] = []

    await Effect.runPromise(
      releaseNatsConnection({
        close: async () => {
          actions.push('close')
        },
        drain: async () => {
          actions.push('drain')
          throw new Error('drain failed')
        },
      })
    )

    expect(actions).toEqual(['drain', 'close'])
  })
})
