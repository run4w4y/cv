import { Console, Effect } from 'effect'
import { Command } from 'effect/unstable/cli'

import { ApplicationRegistryClient } from '../../client'
import { jsonFlag } from '../flags'
import { printJson } from '../output'

export const healthCommand = Command.make(
  'health',
  { json: jsonFlag },
  (options) =>
    ApplicationRegistryClient.pipe(
      Effect.flatMap((client) => client.health()),
      Effect.flatMap((health) =>
        options.json
          ? printJson(health)
          : Console.log('Registry API is healthy.')
      )
    )
)
