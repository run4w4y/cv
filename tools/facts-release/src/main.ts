#!/usr/bin/env bun

import { Effect } from 'effect'

import { readFactsPublisherConfig } from './config'
import { publishFactsCheckout } from './publish'

const program = Effect.gen(function* () {
  const config = yield* readFactsPublisherConfig(process.env)
  return yield* publishFactsCheckout(config)
})

const result = await Effect.runPromise(
  program.pipe(
    Effect.match({
      onFailure: (error) => ({ error: error.message }),
      onSuccess: (published) => ({ published }),
    })
  )
)

if ('error' in result) {
  console.error(result.error)
  process.exitCode = 1
} else {
  console.log(JSON.stringify(result.published))
}
