import {
  type ApplicationFacetsResponse,
  CompensationDisplayCurrencySchema,
  CreateApplicationRequestSchema,
  type ListApplicationsResponse,
  UpdateApplicationRequestSchema,
} from '@cv/application-registry-api-contract'
import {
  applicationStatusValues,
  personalPriorityValues,
  targetStageValues,
} from '@cv/application-registry-entity'
import { Console, Crypto, DateTime, Effect } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'

import { ApplicationRegistryClient } from '../../client'
import {
  allFlag,
  applicationIdentifierArgument,
  inputFlag,
  jsonFlag,
  listPageSizeFlag,
  NonEmptyTrimmedStringSchema,
  optionalFlag,
  optionalStringFlag,
} from '../flags'
import { decodeJsonInput } from '../input'
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

const writeApplication = (options: {
  readonly input: string
  readonly json: boolean
}) =>
  Effect.gen(function* () {
    const request = yield* decodeJsonInput(
      options.input,
      CreateApplicationRequestSchema
    )
    const client = yield* ApplicationRegistryClient
    const application = yield* client.create(request)
    yield* printApplication(application, options.json)
  })

export const applicationCreateCommand = Command.make(
  'create',
  { input: inputFlag, json: jsonFlag },
  writeApplication
).pipe(Command.withDescription('Create an application; fail if it exists.'))

export const applicationUpdateCommand = Command.make(
  'update',
  { identifier, input: inputFlag, json: jsonFlag },
  (options) =>
    Effect.gen(function* () {
      const request = yield* decodeJsonInput(
        options.input,
        UpdateApplicationRequestSchema
      )
      const client = yield* ApplicationRegistryClient
      const crypto = yield* Crypto.Crypto
      const idempotencyKey = yield* crypto.randomUUIDv7
      const result = yield* client.update(
        options.identifier,
        idempotencyKey,
        request
      )
      yield* printApplication(result.application, options.json)
    })
).pipe(Command.withDescription('Patch application metadata and triage fields.'))

const formatFacetValues = (values: readonly string[]) =>
  values.join(', ') || '—'

export const formatApplicationFacets = (facets: ApplicationFacetsResponse) =>
  [
    `Companies: ${formatFacetValues(facets.companies)}`,
    `Labels: ${formatFacetValues(facets.labels)}`,
  ].join('\n')

export const applicationFacetsCommand = Command.make(
  'facets',
  { json: jsonFlag },
  (options) =>
    ApplicationRegistryClient.pipe(
      Effect.flatMap((client) => client.facets()),
      Effect.flatMap((facets) =>
        options.json
          ? printJson(facets)
          : Console.log(formatApplicationFacets(facets))
      )
    )
).pipe(Command.withDescription('List dynamic application filter facets.'))

const applicationRoot = Command.make('application').pipe(
  Command.withDescription('Create, query, and update applications.')
)

export const applicationCommand = applicationRoot.pipe(
  Command.withSubcommands([
    applicationListCommand,
    applicationSearchCommand,
    applicationGetCommand,
    applicationCreateCommand,
    applicationUpdateCommand,
    applicationFacetsCommand,
  ])
)
