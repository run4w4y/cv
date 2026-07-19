import { Command } from 'effect/unstable/cli'
import {
  annotationCommand,
  labelCommand,
  noteCommand,
} from './commands/annotations'
import { applicationCommand } from './commands/applications'
import { compensationCommand } from './commands/compensations'
import { eventCommand } from './commands/events'
import { listingCommand } from './commands/listings'
import { outboxCommand } from './commands/outbox'
import { healthCommand } from './commands/system'

const rootCommand = Command.make('application-registry').pipe(
  Command.withDescription(
    'Query and update the synchronized application registry.'
  )
)

export const applicationRegistryCommand = rootCommand.pipe(
  Command.withSubcommands([
    applicationCommand,
    annotationCommand,
    compensationCommand,
    eventCommand,
    healthCommand,
    labelCommand,
    listingCommand,
    noteCommand,
    outboxCommand,
  ])
)
