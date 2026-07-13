import {
  type ApplicationStatus,
  applicationStatusValues,
  CurrencyCodeSchema,
  type TargetStage,
  targetStageValues,
} from '@cv/application-registry-entity'
import { Console, Crypto, DateTime, Effect, Option } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { ApplicationRegistryClient } from '../client'
import { readApplicationRegistryClientConfig } from '../config'
import { runLocalListingScan } from './listing-scan'
import {
  printApplication,
  printApplications,
  printCaptures,
  printCompensations,
  printEvents,
  printJson,
  printWriteResult,
} from './output'

const jsonOutput = Flag.boolean('json').pipe(
  Flag.withDescription('Print machine-readable JSON.')
)

const company = Flag.string('company').pipe(
  Flag.withDescription('Filter applications by company.'),
  Flag.optional
)
const applicationStatusFilter = Flag.choice(
  'status',
  applicationStatusValues
).pipe(
  Flag.withDescription('Filter applications by lifecycle status.'),
  Flag.optional
)
const targetStageFilter = Flag.choice('target-stage', targetStageValues).pipe(
  Flag.withDescription('Filter applications by research/triage stage.'),
  Flag.optional
)
const label = Flag.string('label').pipe(
  Flag.withDescription('Filter applications by an exact label.'),
  Flag.optional
)
const url = Flag.string('url').pipe(
  Flag.withDescription('Filter applications by canonical job URL.'),
  Flag.optional
)
const after = Flag.string('after').pipe(
  Flag.withDescription('Continue after an API cursor.'),
  Flag.optional
)
const limit = Flag.integer('limit').pipe(
  Flag.withDescription('Maximum applications to return (1–100).'),
  Flag.optional
)

const identifier = Argument.string('application').pipe(
  Argument.withDescription('Application UUID or exact job key.')
)

const option = Option.getOrUndefined

const listWithOptions = (options: {
  readonly after: Option.Option<string>
  readonly applicationStatus: Option.Option<ApplicationStatus>
  readonly company: Option.Option<string>
  readonly json: boolean
  readonly limit: Option.Option<number>
  readonly label: Option.Option<string>
  readonly targetStage: Option.Option<TargetStage>
  readonly url: Option.Option<string>
}) =>
  ApplicationRegistryClient.pipe(
    Effect.flatMap((client) =>
      client.list({
        after: option(options.after),
        applicationStatus: option(options.applicationStatus),
        company: option(options.company),
        label: option(options.label),
        limit: option(options.limit),
        targetStage: option(options.targetStage),
        url: option(options.url),
      })
    ),
    Effect.flatMap((response) =>
      options.json
        ? printJson(response)
        : printApplications(response.items, false)
    )
  )

export const listCommand = Command.make(
  'list',
  {
    after,
    company,
    json: jsonOutput,
    label,
    limit,
    status: applicationStatusFilter,
    targetStage: targetStageFilter,
    url,
  },
  (options) =>
    listWithOptions({
      ...options,
      applicationStatus: options.status,
    })
).pipe(Command.withDescription('List applications in the registry.'))

const search = Argument.string('query').pipe(
  Argument.withDescription('Company name to find.')
)

export const findCommand = Command.make(
  'find',
  {
    json: jsonOutput,
    label,
    limit,
    query: search,
    status: applicationStatusFilter,
    targetStage: targetStageFilter,
    url,
  },
  (options) =>
    listWithOptions({
      after: Option.none(),
      applicationStatus: options.status,
      company: Option.some(options.query),
      json: options.json,
      limit: options.limit,
      label: options.label,
      targetStage: options.targetStage,
      url: options.url,
    })
).pipe(Command.withDescription('Find applications by company.'))

export const showCommand = Command.make(
  'show',
  { identifier, json: jsonOutput },
  (options) =>
    ApplicationRegistryClient.pipe(
      Effect.flatMap((client) => client.show(options.identifier)),
      Effect.flatMap((application) =>
        printApplication(application, options.json)
      )
    )
).pipe(Command.withDescription('Show one application.'))

export const eventsCommand = Command.make(
  'events',
  { identifier, json: jsonOutput },
  (options) =>
    ApplicationRegistryClient.pipe(
      Effect.flatMap((client) => client.events(options.identifier)),
      Effect.flatMap((response) => printEvents(response.items, options.json))
    )
).pipe(Command.withDescription('List an application’s event history.'))

export const capturesCommand = Command.make(
  'captures',
  { identifier, json: jsonOutput },
  (options) =>
    ApplicationRegistryClient.pipe(
      Effect.flatMap((client) => client.captures(options.identifier)),
      Effect.flatMap((response) => printCaptures(response.items, options.json))
    )
).pipe(
  Command.withDescription(
    'List campaign captures, submission details, and artifacts.'
  )
)

const currency = Flag.string('currency').pipe(
  Flag.withSchema(CurrencyCodeSchema),
  Flag.withDescription(
    'Convert compensation ranges to this ISO 4217 currency code.'
  ),
  Flag.optional
)

export const compensationsCommand = Command.make(
  'compensations',
  { currency, identifier, json: jsonOutput },
  (options) =>
    ApplicationRegistryClient.pipe(
      Effect.flatMap((client) =>
        client.compensations(options.identifier, {
          currency: option(options.currency),
        })
      ),
      Effect.flatMap((response) =>
        printCompensations(response.items, options.json)
      )
    )
).pipe(
  Command.withDescription(
    'List compensation ranges, optionally converted to another currency.'
  )
)

const eventTime = Flag.string('at').pipe(
  Flag.withDescription('Event time as an ISO timestamp. Defaults to now.'),
  Flag.optional
)
const expectedVersion = Flag.integer('expected-version').pipe(
  Flag.withDescription('Reject the update if the application version changed.'),
  Flag.optional
)

const appendEvent = (options: {
  readonly expectedVersion: Option.Option<number>
  readonly identifier: string
  readonly json: boolean
  readonly kind: 'stage_changed'
  readonly nextApplicationStatus: ApplicationStatus
  readonly occurredAt: Option.Option<string>
  readonly payload: { readonly applicationStatus: ApplicationStatus }
}) =>
  Effect.gen(function* () {
    const client = yield* ApplicationRegistryClient
    const config = yield* readApplicationRegistryClientConfig
    const crypto = yield* Crypto.Crypto
    const operationId = yield* crypto.randomUUIDv7
    const now = DateTime.formatIso(yield* DateTime.now)
    const result = yield* client.appendEvent(options.identifier, {
      deviceId: config.deviceId,
      expectedVersion: Option.getOrNull(options.expectedVersion),
      kind: options.kind,
      nextApplicationStatus: options.nextApplicationStatus,
      occurredAt: Option.getOrElse(options.occurredAt, () => now),
      operationId,
      payload: options.payload,
    })
    yield* printWriteResult(result, options.json)
  })

const nextStatus = Argument.choice('status', applicationStatusValues).pipe(
  Argument.withDescription('New application lifecycle status.')
)

export const statusCommand = Command.make(
  'status',
  {
    expectedVersion,
    identifier,
    json: jsonOutput,
    occurredAt: eventTime,
    status: nextStatus,
  },
  (options) =>
    appendEvent({
      expectedVersion: options.expectedVersion,
      identifier: options.identifier,
      json: options.json,
      kind: 'stage_changed',
      nextApplicationStatus: options.status,
      occurredAt: options.occurredAt,
      payload: { applicationStatus: options.status },
    })
).pipe(Command.withDescription('Change an application’s lifecycle status.'))

const note = Argument.string('note').pipe(
  Argument.withDescription('Note text. Quote text containing spaces.')
)

export const noteCommand = Command.make(
  'note',
  {
    identifier,
    json: jsonOutput,
    note,
  },
  (options) =>
    Effect.gen(function* () {
      const client = yield* ApplicationRegistryClient
      const crypto = yield* Crypto.Crypto
      const result = yield* client.addNote(options.identifier, {
        body: options.note,
        kind: 'general',
        operationId: yield* crypto.randomUUIDv7,
        source: 'application-registry-cli',
      })
      yield* printWriteResult(result, options.json)
    })
).pipe(Command.withDescription('Append a note to an application.'))

const archiveEligible = Flag.boolean('archive').pipe(
  Flag.withDescription(
    'Archive eligible not-started applications after the grace policy passes.'
  )
)
const checkLimit = Flag.integer('concurrency').pipe(
  Flag.withDescription('Maximum simultaneous local checks.'),
  Flag.withDefault(64)
)
const perHost = Flag.integer('per-host').pipe(
  Flag.withDescription('Maximum simultaneous checks against one hostname.'),
  Flag.withDefault(6)
)
const batchSize = Flag.integer('batch-size').pipe(
  Flag.withDescription('Findings submitted per durable API batch (1–50).'),
  Flag.withDefault(50)
)
const dryRun = Flag.boolean('dry-run').pipe(
  Flag.withDescription('Run every check locally without submitting findings.')
)

export const checkCommand = Command.make(
  'check',
  {
    archive: archiveEligible,
    batchSize,
    concurrency: checkLimit,
    dryRun,
    json: jsonOutput,
    perHost,
  },
  (options) =>
    Effect.gen(function* () {
      const result = yield* runLocalListingScan({
        archive: options.archive,
        batchSize: options.batchSize,
        concurrency: options.concurrency,
        dryRun: options.dryRun,
        perHost: options.perHost,
      })
      return yield* options.json
        ? printJson(result)
        : Console.log(
            `Run ${result.runId}: ${result.checked}/${result.total} checked; ${result.open} open, ${result.closed} closed, ${result.unknown} unknown; ${result.submittedBatches} submitted batches, ${result.queuedBatches} queued, ${result.rejected} rejected, ${result.archived} archived${result.dryRun ? ' (dry run)' : ''}.`
          )
    })
).pipe(
  Command.withDescription(
    'Scan every application locally and submit findings in durable batches.'
  )
)

export const syncCommand = Command.make(
  'sync',
  { json: jsonOutput },
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
).pipe(Command.withDescription('Replay pending registry updates.'))

const rootCommand = Command.make('application-registry').pipe(
  Command.withDescription(
    'Query and update the synchronized application registry.'
  )
)

export const applicationRegistryCommand = rootCommand.pipe(
  Command.withSubcommands([
    listCommand,
    findCommand,
    showCommand,
    eventsCommand,
    capturesCommand,
    compensationsCommand,
    statusCommand,
    noteCommand,
    checkCommand,
    syncCommand,
  ])
)
