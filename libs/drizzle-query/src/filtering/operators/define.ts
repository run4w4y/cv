import type {
  BinaryFilterOperator,
  BinaryFilterOperatorOptions,
  UnaryFilterOperator,
  UnaryFilterOperatorOptions,
} from './types'

/** Defines a unary operator such as `isNull`, optionally requiring compile context. */
export const unaryFilterOperator = <const Name extends string, Context = never>(
  name: Name,
  options: UnaryFilterOperatorOptions<Context>
): UnaryFilterOperator<Name, Context> => ({
  kind: 'unary',
  name,
  compile: options.compile,
})

/** Defines a binary operator with a typed value and optional compile context. */
export const binaryFilterOperator = <
  const Name extends string,
  Value,
  Context = never,
>(
  name: Name,
  options: BinaryFilterOperatorOptions<Value, Context>
): BinaryFilterOperator<Name, Value, Context> => ({
  kind: 'binary',
  name,
  valueShape: options.valueShape ?? 'field',
  ...(options.valueDescriptor === undefined
    ? {}
    : { valueDescriptor: options.valueDescriptor }),
  ...(options.annotations === undefined
    ? {}
    : { annotations: options.annotations }),
  compile: options.compile,
})
