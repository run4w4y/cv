import { Effect } from 'effect'
import { Command } from 'effect/unstable/cli'

import { ApplicationRegistryClient } from '../../client'
import { applicationIdentifierArgument, currencyFlag, jsonFlag } from '../flags'
import { printCompensations, printJson } from '../output'

export const compensationListCommand = Command.make(
  'list',
  {
    currency: currencyFlag,
    identifier: applicationIdentifierArgument,
    json: jsonFlag,
  },
  (options) =>
    ApplicationRegistryClient.pipe(
      Effect.flatMap((client) =>
        client.compensations(options.identifier, {
          currency: options.currency,
        })
      ),
      Effect.flatMap((response) =>
        options.json
          ? printJson(response)
          : printCompensations(response.items, false)
      )
    )
)

const compensationRoot = Command.make('compensation')
export const compensationCommand = compensationRoot.pipe(
  Command.withSubcommands([compensationListCommand])
)
