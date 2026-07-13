import { ListingCheckRunIdentifierParamsSchema } from '@cv/application-registry-api-contract'
import { Console, Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'

import { ApplicationRegistryClient } from '../../client'
import { applicationIdentifierArgument, jsonFlag } from '../flags'
import { ListingScanOptionsSchema, runLocalListingScan } from '../listing-scan'
import { printJson } from '../output'

const identifier = applicationIdentifierArgument
const runIdentifier = Argument.string('run').pipe(
  Argument.withSchema(ListingCheckRunIdentifierParamsSchema.fields.id)
)

export const listingHistoryCommand = Command.make(
  'history',
  { identifier, json: jsonFlag },
  (options) =>
    ApplicationRegistryClient.pipe(
      Effect.flatMap((client) => client.listingChecks(options.identifier)),
      Effect.flatMap(printJson)
    )
)

export const listingRunCommand = Command.make(
  'run',
  { identifier: runIdentifier, json: jsonFlag },
  (options) =>
    ApplicationRegistryClient.pipe(
      Effect.flatMap((client) => client.listingCheckRun(options.identifier)),
      Effect.flatMap(printJson)
    )
)

const listingScanFlags = {
  archive: Flag.boolean('archive').pipe(
    Flag.withDescription(
      'Archive eligible not-started applications after the grace policy passes.'
    )
  ),
  batchSize: Flag.integer('batch-size').pipe(
    Flag.withSchema(ListingScanOptionsSchema.fields.batchSize),
    Flag.withDefault(50),
    Flag.withDescription('Findings submitted per durable API batch (1–50).')
  ),
  concurrency: Flag.integer('concurrency').pipe(
    Flag.withSchema(ListingScanOptionsSchema.fields.concurrency),
    Flag.withDefault(64),
    Flag.withDescription('Maximum simultaneous local checks.')
  ),
  dryRun: Flag.boolean('dry-run').pipe(
    Flag.withDescription('Run every check locally without submitting findings.')
  ),
  perHost: Flag.integer('per-host').pipe(
    Flag.withSchema(ListingScanOptionsSchema.fields.perHost),
    Flag.withDefault(6),
    Flag.withDescription('Maximum simultaneous checks against one hostname.')
  ),
}

export const listingScanCommand = Command.make(
  'scan',
  { ...listingScanFlags, json: jsonFlag },
  (options) =>
    runLocalListingScan(options).pipe(
      Effect.flatMap((result) =>
        options.json
          ? printJson(result)
          : Console.log(
              `Run ${result.runId}: ${result.checked}/${result.total} checked; ${result.open} open, ${result.closed} closed, ${result.unknown} unknown; ${result.submittedBatches} submitted batches, ${result.queuedBatches} queued, ${result.rejected} rejected, ${result.archived} archived${result.dryRun ? ' (dry run)' : ''}.`
            )
      )
    )
)

const listingRoot = Command.make('listing')
export const listingCommand = listingRoot.pipe(
  Command.withSubcommands([
    listingScanCommand,
    listingHistoryCommand,
    listingRunCommand,
  ])
)
