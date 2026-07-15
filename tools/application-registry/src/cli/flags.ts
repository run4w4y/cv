import {
  ApplicationIdentifierParamsSchema,
  PaginationSizeSchema,
} from '@cv/application-registry-api-contract'
import {
  CurrencyCodeSchema,
  ExpectedApplicationVersionSchema,
  NonEmptyTrimmedStringSchema,
} from '@cv/application-registry-entity'
import { Option } from 'effect'
import { Argument, Flag } from 'effect/unstable/cli'

export { NonEmptyTrimmedStringSchema }

export const optionalFlag = <A>(flag: Flag.Flag<A>) =>
  flag.pipe(Flag.optional, Flag.map(Option.getOrUndefined))

export const nonEmptyStringFlag = (name: string) =>
  Flag.string(name).pipe(Flag.withSchema(NonEmptyTrimmedStringSchema))

export const optionalStringFlag = (name: string) =>
  optionalFlag(nonEmptyStringFlag(name))

export const applicationIdentifierArgument = Argument.string(
  'application'
).pipe(
  Argument.withSchema(ApplicationIdentifierParamsSchema.fields.id),
  Argument.withDescription('Application UUID or exact job key.')
)

export const currencyFlag = optionalFlag(
  Flag.string('currency').pipe(
    Flag.withSchema(CurrencyCodeSchema),
    Flag.withDescription(
      'Convert compensation ranges to this ISO 4217 currency code.'
    )
  )
)

export const expectedVersionFlag = optionalFlag(
  Flag.integer('expected-version').pipe(
    Flag.withSchema(ExpectedApplicationVersionSchema),
    Flag.withDescription(
      'Reject the update if the application version changed.'
    )
  )
)

export const listPageSizeFlag = optionalFlag(
  Flag.integer('size').pipe(
    Flag.withSchema(PaginationSizeSchema),
    Flag.withDescription('Maximum results to return (1–100).')
  )
)

export const allFlag = Flag.boolean('all').pipe(
  Flag.withDescription('Follow every continuation cursor.')
)

export const inputFlag = Flag.string('input').pipe(
  Flag.withDefault('-'),
  Flag.withDescription('JSON input file, or - for standard input.')
)

export const jsonFlag = Flag.boolean('json').pipe(
  Flag.withDescription('Print machine-readable JSON.')
)
