import Ajv, { type ValidateFunction } from 'ajv'
import { Effect } from 'effect'
import {
  AiProviderOutputValidationError,
  AiProviderSchemaError,
} from '../errors'
import type { AiJsonSchema } from '../model'

const ajv = new Ajv({
  addUsedSchema: false,
  allErrors: true,
  allowUnionTypes: true,
  strictSchema: true,
  strictTypes: false,
  validateFormats: false,
})

export const compileJsonSchema = <Output>(
  schema: AiJsonSchema
): Effect.Effect<ValidateFunction<Output>, AiProviderSchemaError> =>
  Effect.try({
    try: () => ajv.compile<Output>(schema),
    catch: (cause) =>
      new AiProviderSchemaError({
        cause,
        message: 'The supplied output JSON Schema could not be compiled.',
      }),
  })

export const validateJsonOutput = <Output>(
  validator: ValidateFunction<Output>,
  value: unknown,
  modelId: string
): Effect.Effect<Output, AiProviderOutputValidationError> => {
  if (validator(value)) {
    return Effect.succeed(value)
  }

  return Effect.fail(
    new AiProviderOutputValidationError({
      cause: validator.errors,
      message: `Generated JSON did not match the supplied schema: ${ajv.errorsText(validator.errors)}.`,
      modelId,
    })
  )
}

export class JsonSchemaOutputError extends Error {
  readonly validationErrors: ValidateFunction['errors']

  constructor(validator: ValidateFunction) {
    super(
      `Generated JSON did not match the supplied schema: ${ajv.errorsText(validator.errors)}.`
    )
    this.name = 'JsonSchemaOutputError'
    this.validationErrors = validator.errors
  }
}
