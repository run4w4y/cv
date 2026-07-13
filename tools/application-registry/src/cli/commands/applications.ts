import {
  CompensationDisplayCurrencySchema,
  CreateApplicationRequestSchema,
  FollowUpStateSchema,
  type ListApplicationsQuery,
  type ListApplicationsResponse,
  PatchApplicationRequestSchema,
} from '@cv/application-registry-api-contract'
import {
  applicationStatusValues,
  FitScoreSchema,
  personalPriorityValues,
  targetStageValues,
} from '@cv/application-registry-entity'
import { Console, Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'

import { ApplicationRegistryClient } from '../../client'
import {
  allFlag,
  applicationIdentifierArgument,
  expectedVersionFlag,
  inputFlag,
  jsonFlag,
  listLimitFlag,
  NonEmptyTrimmedStringSchema,
  optionalFlag,
  optionalStringFlag,
} from '../flags'
import { ApplicationRegistryCliInputError, decodeJsonInput } from '../input'
import { printApplication, printApplications, printJson } from '../output'

const after = optionalStringFlag('after').pipe(
  Flag.withDescription('Continue after an API cursor.')
)
const company = optionalStringFlag('company')
const location = optionalStringFlag('location')
const role = optionalStringFlag('role')
const label = optionalStringFlag('label')
const url = optionalStringFlag('url')
const limit = listLimitFlag
const fitScoreMin = optionalFlag(
  Flag.integer('fit-score-min').pipe(Flag.withSchema(FitScoreSchema))
)
const fitScoreMax = optionalFlag(
  Flag.integer('fit-score-max').pipe(Flag.withSchema(FitScoreSchema))
)
const applicationStatus = optionalFlag(
  Flag.choice('status', applicationStatusValues)
)
const targetStage = optionalFlag(Flag.choice('target-stage', targetStageValues))
const personalPriority = optionalFlag(
  Flag.choice('personal-priority', personalPriorityValues)
)
const followUpState = optionalFlag(
  Flag.choice('follow-up-state', FollowUpStateSchema.literals)
)
const currency = optionalFlag(
  Flag.string('currency').pipe(
    Flag.withSchema(CompensationDisplayCurrencySchema)
  )
)

const identifier = applicationIdentifierArgument
const queryArgument = Argument.string('query').pipe(
  Argument.withSchema(NonEmptyTrimmedStringSchema),
  Argument.withDescription('Text to find across registry application fields.')
)
const filters = {
  after,
  applicationStatus,
  company,
  currency,
  fitScoreMax,
  fitScoreMin,
  followUpState,
  label,
  limit,
  location,
  personalPriority,
  role,
  targetStage,
  url,
}

type ListOptions = {
  readonly all: boolean
  readonly filters: ListApplicationsQuery
  readonly json: boolean
}

const listQuery = (
  options: ListOptions,
  cursor: string | undefined
): ListApplicationsQuery => ({
  ...options.filters,
  after: cursor,
  limit: options.all ? 100 : options.filters.limit,
})

const listApplications = (options: ListOptions) =>
  Effect.gen(function* () {
    const client = yield* ApplicationRegistryClient
    const firstCursor = options.filters.after
    const first = yield* client.list(listQuery(options, firstCursor))
    if (!options.all || first.nextCursor === null) return first

    const items = [...first.items]
    let checkpoint = first.checkpoint
    let cursor: string | null = first.nextCursor
    while (cursor !== null) {
      const page: ListApplicationsResponse = yield* client.list(
        listQuery(options, cursor)
      )
      items.push(...page.items)
      checkpoint = page.checkpoint
      cursor = page.nextCursor
    }
    return { checkpoint, items, nextCursor: null }
  })

const renderApplications = (options: ListOptions) =>
  listApplications(options).pipe(
    Effect.flatMap((response) =>
      options.json
        ? printJson(response)
        : printApplications(response.items, false)
    )
  )

const listFields = { all: allFlag, filters, json: jsonFlag }

export const applicationListCommand = Command.make(
  'list',
  listFields,
  renderApplications
).pipe(Command.withDescription('List and filter registry applications.'))

export const applicationSearchCommand = Command.make(
  'search',
  { ...listFields, query: queryArgument },
  (options) =>
    renderApplications({
      all: options.all,
      filters: { ...options.filters, q: options.query },
      json: options.json,
    })
).pipe(Command.withDescription('Search across application fields.'))

export const applicationGetCommand = Command.make(
  'get',
  { identifier, json: jsonFlag },
  (options) =>
    ApplicationRegistryClient.pipe(
      Effect.flatMap((client) => client.show(options.identifier)),
      Effect.flatMap((application) =>
        printApplication(application, options.json)
      )
    )
).pipe(Command.withDescription('Get one registry application.'))

const writeApplication = (
  operation: 'create' | 'upsert',
  options: { readonly input: string; readonly json: boolean }
) =>
  Effect.gen(function* () {
    const request = yield* decodeJsonInput(
      options.input,
      CreateApplicationRequestSchema
    )
    const client = yield* ApplicationRegistryClient
    const application = yield* operation === 'create'
      ? client.create(request)
      : client.upsert(request)
    yield* printApplication(application, options.json)
  })

export const applicationCreateCommand = Command.make(
  'create',
  { input: inputFlag, json: jsonFlag },
  (options) => writeApplication('create', options)
).pipe(Command.withDescription('Create an application; fail if it exists.'))

export const applicationUpsertCommand = Command.make(
  'upsert',
  { input: inputFlag, json: jsonFlag },
  (options) => writeApplication('upsert', options)
).pipe(Command.withDescription('Create or replace an application by job key.'))

export const applicationUpdateCommand = Command.make(
  'update',
  { identifier, input: inputFlag, json: jsonFlag },
  (options) =>
    Effect.gen(function* () {
      const request = yield* decodeJsonInput(
        options.input,
        PatchApplicationRequestSchema
      )
      const client = yield* ApplicationRegistryClient
      const application = yield* client.patch(options.identifier, request)
      yield* printApplication(application, options.json)
    })
).pipe(Command.withDescription('Patch application metadata and triage fields.'))

const yes = Flag.boolean('yes').pipe(
  Flag.withDescription('Confirm destructive deletion.')
)

export const applicationDeleteCommand = Command.make(
  'delete',
  { expectedVersion: expectedVersionFlag, identifier, json: jsonFlag, yes },
  (options) =>
    Effect.gen(function* () {
      if (!options.yes) {
        return yield* new ApplicationRegistryCliInputError({
          message: 'Refusing to delete without --yes.',
        })
      }
      const client = yield* ApplicationRegistryClient
      yield* client.remove(options.identifier, options.expectedVersion)
      yield* options.json
        ? printJson({ deleted: true, identifier: options.identifier })
        : Console.log(`Deleted ${options.identifier}.`)
    })
).pipe(Command.withDescription('Delete one registry application.'))

export const applicationFacetsCommand = Command.make(
  'facets',
  { json: jsonFlag },
  (options) =>
    ApplicationRegistryClient.pipe(
      Effect.flatMap((client) => client.facets()),
      Effect.flatMap((facets) =>
        options.json
          ? printJson(facets)
          : Console.log(
              [
                `Companies: ${facets.companies.join(', ')}`,
                `Statuses: ${facets.applicationStatuses.join(', ')}`,
                `Target stages: ${facets.targetStages.join(', ')}`,
                `Priorities: ${facets.personalPriorities.join(', ') || '—'}`,
                `Labels: ${facets.labels.join(', ') || '—'}`,
              ].join('\n')
            )
      )
    )
).pipe(Command.withDescription('List application filter facets.'))

const applicationRoot = Command.make('application').pipe(
  Command.withDescription('Create, query, update, and delete applications.')
)

export const applicationCommand = applicationRoot.pipe(
  Command.withSubcommands([
    applicationListCommand,
    applicationSearchCommand,
    applicationGetCommand,
    applicationCreateCommand,
    applicationUpsertCommand,
    applicationUpdateCommand,
    applicationDeleteCommand,
    applicationFacetsCommand,
  ])
)
