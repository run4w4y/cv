import type {
  ListActivitiesQuery,
  ListActivitiesResponse,
} from '@cv/application-registry-api-contract'
import {
  type ApplicationActivityKind,
  applicationActivityKindValues,
  UtcIsoTimestampSchema,
} from '@cv/application-registry-entity'
import { Effect } from 'effect'
import { Command, Flag } from 'effect/unstable/cli'
import { compact } from 'es-toolkit/array'

import { ApplicationRegistryClient } from '../../client'
import {
  allFlag,
  jsonFlag,
  listPageSizeFlag,
  optionalFlag,
  optionalStringFlag,
} from '../flags'
import { printActivities, printJson } from '../output'

const query = {
  after: optionalStringFlag('after'),
  from: optionalFlag(
    Flag.string('from').pipe(Flag.withSchema(UtcIsoTimestampSchema))
  ),
  kind: optionalFlag(Flag.choice('kind', applicationActivityKindValues)).pipe(
    Flag.map((value) => (value === undefined ? undefined : [value]))
  ),
  size: listPageSizeFlag,
  to: optionalFlag(
    Flag.string('to').pipe(Flag.withSchema(UtcIsoTimestampSchema))
  ),
}
const application = optionalStringFlag('application')

type ActivityFilterOptions = {
  readonly after?: string
  readonly from?: string
  readonly kind?: readonly ApplicationActivityKind[]
  readonly size?: number
  readonly to?: string
}

const activityFilters = (
  options: ActivityFilterOptions
): ListActivitiesQuery['filters'] =>
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

type ActivityListOptions = {
  readonly all: boolean
  readonly application: string | undefined
  readonly json: boolean
  readonly query: ActivityFilterOptions
}

export const activityListCommand = Command.make(
  'list',
  { all: allFlag, application, json: jsonFlag, query },
  (options: ActivityListOptions) =>
    Effect.gen(function* () {
      const client = yield* ApplicationRegistryClient
      if (options.application !== undefined) {
        const response = yield* client.activities(options.application)
        return yield* options.json
          ? printJson(response)
          : printActivities(response.items, false)
      }

      const makeQuery = (cursor: string | undefined): ListActivitiesQuery => ({
        filters: activityFilters(options.query),
        pagination: {
          after: cursor,
          size: options.all ? 100 : options.query.size,
        },
      })
      const first = yield* client.listActivities(makeQuery(options.query.after))
      if (!options.all || first.pageInfo.nextCursor === null) {
        return yield* options.json
          ? printJson(first)
          : printActivities(first.items, false)
      }

      const items = [...first.items]
      let pageInfo = first.pageInfo
      let cursor: string | null = first.pageInfo.nextCursor
      while (cursor !== null) {
        const page: ListActivitiesResponse = yield* client.listActivities(
          makeQuery(cursor)
        )
        items.push(...page.items)
        pageInfo = page.pageInfo
        cursor = page.pageInfo.nextCursor
      }
      const response = { items, pageInfo }
      return yield* options.json
        ? printJson(response)
        : printActivities(response.items, false)
    })
).pipe(Command.withDescription('List backend-issued application activities.'))

export const activityCommand = Command.make('activity').pipe(
  Command.withDescription('Inspect backend-issued activity annotations.'),
  Command.withSubcommands([activityListCommand])
)
