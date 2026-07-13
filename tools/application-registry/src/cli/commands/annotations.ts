import {
  type AddApplicationNoteRequest,
  AddApplicationNoteRequestSchema,
  ReplaceApplicationLabelsRequestSchema,
} from '@cv/application-registry-api-contract'
import { applicationNoteKindValues } from '@cv/application-registry-entity'
import { Crypto, Effect, Option } from 'effect'
import { Argument, Command, Flag } from 'effect/unstable/cli'
import { uniq } from 'es-toolkit'

import { ApplicationRegistryClient } from '../../client'
import {
  applicationIdentifierArgument,
  inputFlag,
  jsonFlag,
  optionalFlag,
  optionalStringFlag,
} from '../flags'
import { ApplicationRegistryCliInputError, decodeJsonInput } from '../input'
import { printJson, printWriteResult } from '../output'

const identifier = applicationIdentifierArgument
const input = optionalStringFlag('input')

export const annotationListCommand = Command.make(
  'list',
  { identifier, json: jsonFlag },
  (options) =>
    ApplicationRegistryClient.pipe(
      Effect.flatMap((client) => client.annotations(options.identifier)),
      Effect.flatMap(printJson)
    )
).pipe(Command.withDescription('List notes and labels on an application.'))

const annotationRoot = Command.make('annotation')
export const annotationCommand = annotationRoot.pipe(
  Command.withSubcommands([annotationListCommand])
)

const noteBody = Argument.string('body').pipe(Argument.optional)
const noteKind = Flag.choice('kind', applicationNoteKindValues).pipe(
  Flag.withDefault('general')
)
const noteSource = Flag.string('source').pipe(
  Flag.withSchema(AddApplicationNoteRequestSchema.fields.source),
  Flag.withDefault('application-registry-cli')
)
const operationId = optionalFlag(
  Flag.string('operation-id').pipe(
    Flag.withSchema(AddApplicationNoteRequestSchema.fields.operationId)
  )
)

export const noteAddCommand = Command.make(
  'add',
  {
    body: noteBody,
    identifier,
    input,
    json: jsonFlag,
    kind: noteKind,
    operationId,
    source: noteSource,
  },
  (options) =>
    Effect.gen(function* () {
      const body = Option.getOrUndefined(options.body)
      const crypto = yield* Crypto.Crypto
      const generatedOperationId = yield* crypto.randomUUIDv7
      let request: AddApplicationNoteRequest
      if (options.input !== undefined) {
        request = yield* decodeJsonInput(
          options.input,
          AddApplicationNoteRequestSchema
        )
      } else if (body !== undefined) {
        request = {
          body,
          kind: options.kind,
          operationId: options.operationId ?? generatedOperationId,
          source: options.source,
        }
      } else {
        return yield* new ApplicationRegistryCliInputError({
          message: 'Provide a note body or --input <file|->.',
        })
      }
      const client = yield* ApplicationRegistryClient
      const result = yield* client.addNote(options.identifier, request)
      yield* printWriteResult(result, options.json)
    })
).pipe(Command.withDescription('Add a typed application note.'))

const noteRoot = Command.make('notes')
export const noteCommand = noteRoot.pipe(
  Command.withSubcommands([noteAddCommand])
)

export const labelListCommand = Command.make(
  'list',
  { identifier, json: jsonFlag },
  (options) =>
    ApplicationRegistryClient.pipe(
      Effect.flatMap((client) => client.labels(options.identifier)),
      Effect.flatMap(printJson)
    )
)

export const labelSetCommand = Command.make(
  'set',
  { identifier, input: inputFlag, json: jsonFlag },
  (options) =>
    Effect.gen(function* () {
      const request = yield* decodeJsonInput(
        options.input,
        ReplaceApplicationLabelsRequestSchema
      )
      const client = yield* ApplicationRegistryClient
      const labels = yield* client.replaceLabels(options.identifier, request)
      yield* printJson(labels)
    })
)

const labelValues = Argument.string('label').pipe(Argument.variadic({ min: 1 }))

const changeLabels = (
  mode: 'add' | 'remove',
  options: {
    readonly identifier: string
    readonly json: boolean
    readonly labels: readonly string[]
  }
) =>
  Effect.gen(function* () {
    const client = yield* ApplicationRegistryClient
    const current = yield* client.labels(options.identifier)
    const existing = current.items.map(({ label }) => label)
    const labels =
      mode === 'add'
        ? uniq([...existing, ...options.labels])
        : existing.filter((label) => !options.labels.includes(label))
    const updated = yield* client.replaceLabels(options.identifier, { labels })
    yield* printJson(updated)
  })

export const labelAddCommand = Command.make(
  'add',
  { identifier, json: jsonFlag, labels: labelValues },
  (options) => changeLabels('add', options)
)

export const labelRemoveCommand = Command.make(
  'remove',
  { identifier, json: jsonFlag, labels: labelValues },
  (options) => changeLabels('remove', options)
)

const labelRoot = Command.make('label')
export const labelCommand = labelRoot.pipe(
  Command.withSubcommands([
    labelListCommand,
    labelSetCommand,
    labelAddCommand,
    labelRemoveCommand,
  ])
)
