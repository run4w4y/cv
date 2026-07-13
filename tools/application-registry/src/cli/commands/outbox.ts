import { Console, Effect } from 'effect'
import { Command } from 'effect/unstable/cli'

import { ApplicationRegistryClient } from '../../client'
import { jsonFlag } from '../flags'
import { printJson } from '../output'

export const outboxListCommand = Command.make(
  'list',
  { json: jsonFlag },
  (options) =>
    ApplicationRegistryClient.pipe(
      Effect.flatMap((client) => client.outbox()),
      Effect.flatMap((entries) =>
        options.json
          ? printJson(entries)
          : entries.length === 0
            ? Console.log('The registry outbox is empty.')
            : Console.log(
                entries
                  .map(
                    (entry) =>
                      `${entry.createdAt}  ${entry.disposition}  ${entry.command._tag}  attempts=${entry.attemptCount}`
                  )
                  .join('\n')
              )
      )
    )
)

export const outboxSyncCommand = Command.make(
  'sync',
  { json: jsonFlag },
  (options) =>
    ApplicationRegistryClient.pipe(
      Effect.flatMap((client) => client.sync()),
      Effect.flatMap((result) =>
        options.json
          ? printJson(result)
          : Console.log(
              `Outbox sync: ${result.synced} synchronized, ${result.failed.length} retry failures, ${result.blocked} blocked, ${result.deadLetter} dead-lettered, ${result.attempted} attempted.`
            )
      )
    )
)

const outboxRoot = Command.make('outbox')
export const outboxCommand = outboxRoot.pipe(
  Command.withSubcommands([outboxListCommand, outboxSyncCommand])
)
