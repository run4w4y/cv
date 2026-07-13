import {
  AppendApplicationEventRequestSchema,
  type ListEventsQuery,
  type ListEventsResponse,
} from '@cv/application-registry-api-contract'
import {
  applicationEventKindValues,
  UtcIsoTimestampSchema,
} from '@cv/application-registry-entity'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'

import { ApplicationRegistryClient } from '../../client'
import {
  allFlag,
  applicationIdentifierArgument,
  inputFlag,
  jsonFlag,
  listLimitFlag,
  optionalFlag,
  optionalStringFlag,
} from '../flags'
import { decodeJsonInput } from '../input'
import { printEvents, printJson, printWriteResult } from '../output'

const query = {
  after: optionalStringFlag('after'),
  from: optionalFlag(
    Flag.string('from').pipe(Flag.withSchema(UtcIsoTimestampSchema))
  ),
  kind: optionalFlag(Flag.choice('kind', applicationEventKindValues)),
  limit: listLimitFlag,
  to: optionalFlag(
    Flag.string('to').pipe(Flag.withSchema(UtcIsoTimestampSchema))
  ),
}
const application = optionalStringFlag('application')
const identifier = applicationIdentifierArgument

type EventListOptions = {
  readonly all: boolean
  readonly application: string | undefined
  readonly json: boolean
  readonly query: ListEventsQuery
}

export const eventListCommand = Command.make(
  'list',
  { all: allFlag, application, json: jsonFlag, query },
  (options: EventListOptions) =>
    Effect.gen(function* () {
      const client = yield* ApplicationRegistryClient
      const applicationIdentifier = options.application
      if (applicationIdentifier !== undefined) {
        const response = yield* client.events(applicationIdentifier)
        return yield* options.json
          ? printJson(response)
          : printEvents(response.items, false)
      }

      const makeQuery = (cursor: string | undefined): ListEventsQuery => ({
        ...options.query,
        after: cursor,
        limit: options.all ? 100 : options.query.limit,
      })
      const first = yield* client.listEvents(makeQuery(options.query.after))
      if (!options.all || first.nextCursor === null) {
        return yield* options.json
          ? printJson(first)
          : printEvents(first.items, false)
      }

      const items = [...first.items]
      let checkpoint = first.checkpoint
      let cursor: string | null = first.nextCursor
      while (cursor !== null) {
        const page: ListEventsResponse = yield* client.listEvents(
          makeQuery(cursor)
        )
        items.push(...page.items)
        checkpoint = page.checkpoint
        cursor = page.nextCursor
      }
      const response = { checkpoint, items, nextCursor: null }
      return yield* options.json
        ? printJson(response)
        : printEvents(response.items, false)
    })
).pipe(Command.withDescription('List application or registry-wide events.'))

export const eventAppendCommand = Command.make(
  'append',
  { identifier, input: inputFlag, json: jsonFlag },
  (options) =>
    Effect.gen(function* () {
      const request = yield* decodeJsonInput(
        options.input,
        AppendApplicationEventRequestSchema
      )
      const client = yield* ApplicationRegistryClient
      const result = yield* client.appendEvent(options.identifier, request)
      yield* printWriteResult(result, options.json)
    })
).pipe(Command.withDescription('Append a typed application event.'))

const eventRoot = Command.make('event').pipe(
  Command.withDescription('Query and append lifecycle events.')
)

export const eventCommand = eventRoot.pipe(
  Command.withSubcommands([eventListCommand, eventAppendCommand])
)
