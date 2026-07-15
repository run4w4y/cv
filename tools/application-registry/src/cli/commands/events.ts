import {
  AppendApplicationEventRequestSchema,
  type ListEventsQuery,
  type ListEventsResponse,
} from '@cv/application-registry-api-contract'
import {
  type ApplicationEventKind,
  applicationEventKindValues,
  UtcIsoTimestampSchema,
} from '@cv/application-registry-entity'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { compact } from 'es-toolkit/array'

import { ApplicationRegistryClient } from '../../client'
import {
  allFlag,
  applicationIdentifierArgument,
  inputFlag,
  jsonFlag,
  listPageSizeFlag,
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
  kind: optionalFlag(Flag.choice('kind', applicationEventKindValues)).pipe(
    Flag.map((value) => (value === undefined ? undefined : [value]))
  ),
  size: listPageSizeFlag,
  to: optionalFlag(
    Flag.string('to').pipe(Flag.withSchema(UtcIsoTimestampSchema))
  ),
}
const application = optionalStringFlag('application')
const identifier = applicationIdentifierArgument

type EventFilterOptions = {
  readonly after?: string
  readonly from?: string
  readonly kind?: readonly ApplicationEventKind[]
  readonly size?: number
  readonly to?: string
}

const eventFilters = (
  options: EventFilterOptions
): ListEventsQuery['filters'] =>
  compact([
    options.from === undefined
      ? undefined
      : {
          type: 'condition' as const,
          field: 'occurredAt' as const,
          operator: 'gte' as const,
          value: options.from,
        },
    options.kind === undefined
      ? undefined
      : {
          type: 'condition' as const,
          field: 'kind' as const,
          operator: 'in' as const,
          value: options.kind,
        },
    options.to === undefined
      ? undefined
      : {
          type: 'condition' as const,
          field: 'occurredAt' as const,
          operator: 'lte' as const,
          value: options.to,
        },
  ])

type EventListOptions = {
  readonly all: boolean
  readonly application: string | undefined
  readonly json: boolean
  readonly query: EventFilterOptions
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
        filters: eventFilters(options.query),
        pagination: {
          after: cursor,
          size: options.all ? 100 : options.query.size,
        },
      })
      const first = yield* client.listEvents(makeQuery(options.query.after))
      if (!options.all || first.pageInfo.nextCursor === null) {
        return yield* options.json
          ? printJson(first)
          : printEvents(first.items, false)
      }

      const items = [...first.items]
      let pageInfo = first.pageInfo
      let cursor: string | null = first.pageInfo.nextCursor
      while (cursor !== null) {
        const page: ListEventsResponse = yield* client.listEvents(
          makeQuery(cursor)
        )
        items.push(...page.items)
        pageInfo = page.pageInfo
        cursor = page.pageInfo.nextCursor
      }
      const response = { items, pageInfo }
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
