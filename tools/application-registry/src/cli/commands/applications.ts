import {
  CompensationDisplayCurrencySchema,
  CreateApplicationRequestSchema,
  type ListApplicationsResponse,
  PatchApplicationRequestSchema,
} from '@cv/application-registry-api-contract'
import {
  applicationStatusValues,
  FitScoreSchema,
  personalPriorityValues,
  targetStageValues,
} from '@cv/application-registry-entity'
import { Console, DateTime, Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'

import { ApplicationRegistryClient } from '../../client'
import {
  registryDeduplicationFlags,
  runRegistryDeduplication,
} from '../deduplicate'
import {
  allFlag,
  applicationIdentifierArgument,
  expectedVersionFlag,
  inputFlag,
  jsonFlag,
  listPageSizeFlag,
  NonEmptyTrimmedStringSchema,
  optionalFlag,
  optionalStringFlag,
} from '../flags'
import { ApplicationRegistryCliInputError, decodeJsonInput } from '../input'
import { printApplication, printApplications, printJson } from '../output'
import {
  type ApplicationFilterOptions,
  followUpShortcutValues,
  makeApplicationListQuery,
} from './application-list-query'

const after = optionalStringFlag('after').pipe(
  Flag.withDescription('Continue after an API cursor.')
)
const company = optionalStringFlag('company')
const location = optionalStringFlag('location')
const role = optionalStringFlag('role')
const label = optionalStringFlag('label').pipe(
  Flag.map((value) => (value === undefined ? undefined : [value]))
)
const url = optionalStringFlag('url')
const size = listPageSizeFlag
const fitScoreMin = optionalFlag(
  Flag.integer('fit-score-min').pipe(Flag.withSchema(FitScoreSchema))
)
const fitScoreMax = optionalFlag(
  Flag.integer('fit-score-max').pipe(Flag.withSchema(FitScoreSchema))
)
const applicationStatus = optionalFlag(
  Flag.choice('status', applicationStatusValues)
).pipe(Flag.map((value) => (value === undefined ? undefined : [value])))
const targetStage = optionalFlag(
  Flag.choice('target-stage', targetStageValues)
).pipe(Flag.map((value) => (value === undefined ? undefined : [value])))
const personalPriority = optionalFlag(
  Flag.choice('personal-priority', personalPriorityValues)
).pipe(Flag.map((value) => (value === undefined ? undefined : [value])))
const followUpShortcut = optionalFlag(
  Flag.choice('follow-up-state', followUpShortcutValues)
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
  followUpShortcut,
  label,
  size,
  location,
  personalPriority,
  role,
  targetStage,
  url,
}

type ListOptions = {
  readonly all: boolean
  readonly filters: ApplicationFilterOptions
  readonly json: boolean
  readonly search?: string
}

const listApplications = (options: ListOptions) =>
  Effect.gen(function* () {
    const client = yield* ApplicationRegistryClient
    const query = makeApplicationListQuery(options.filters, {
      all: options.all,
      referenceTime: DateTime.formatIso(yield* DateTime.now),
      search: options.search,
    })
    const firstCursor = options.filters.after
    const first = yield* client.list(query(firstCursor))
    if (!options.all || first.pageInfo.nextCursor === null) return first

    const items = [...first.items]
    let pageInfo = first.pageInfo
    let cursor: string | null = first.pageInfo.nextCursor
    while (cursor !== null) {
      const page: ListApplicationsResponse = yield* client.list(query(cursor))
      items.push(...page.items)
      pageInfo = page.pageInfo
      cursor = page.pageInfo.nextCursor
    }
    return { items, pageInfo }
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
      filters: options.filters,
      json: options.json,
      search: options.query,
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

export const applicationDeduplicateCommand = Command.make(
  'deduplicate',
  registryDeduplicationFlags,
  runRegistryDeduplication
).pipe(
  Command.withDescription(
    'Find duplicate canonical URLs and resolve each conflict explicitly.'
  )
)

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
    applicationDeduplicateCommand,
    applicationFacetsCommand,
  ])
)
