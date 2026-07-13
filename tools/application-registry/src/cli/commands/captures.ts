import { CreateCampaignCaptureRequestSchema } from '@cv/application-registry-api-contract'
import { Effect } from 'effect'
import { Command } from 'effect/unstable/cli'

import { ApplicationRegistryClient } from '../../client'
import { applicationIdentifierArgument, inputFlag, jsonFlag } from '../flags'
import { decodeJsonInput } from '../input'
import { printCaptures, printJson, printWriteResult } from '../output'

const identifier = applicationIdentifierArgument

export const captureListCommand = Command.make(
  'list',
  { identifier, json: jsonFlag },
  (options) =>
    ApplicationRegistryClient.pipe(
      Effect.flatMap((client) => client.captures(options.identifier)),
      Effect.flatMap((response) =>
        options.json
          ? printJson(response)
          : printCaptures(response.items, false)
      )
    )
)

export const captureCreateCommand = Command.make(
  'create',
  { input: inputFlag, json: jsonFlag },
  (options) =>
    Effect.gen(function* () {
      const request = yield* decodeJsonInput(
        options.input,
        CreateCampaignCaptureRequestSchema
      )
      const client = yield* ApplicationRegistryClient
      const result = yield* client.capture(request)
      yield* printWriteResult(result, options.json)
    })
)

const captureRoot = Command.make('capture')
export const captureCommand = captureRoot.pipe(
  Command.withSubcommands([captureListCommand, captureCreateCommand])
)
