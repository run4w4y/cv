import {
  is,
  isSQLWrapper,
  Param,
  Placeholder,
  SQL,
  type SQLChunk,
  type SQLWrapper,
  Subquery,
  View,
} from 'drizzle-orm'

type CountContext = {
  readonly inline: boolean
  readonly stack: WeakSet<object>
}

const inlinesParameters = (expression: SQL): boolean =>
  Reflect.get(expression, 'shouldInlineParams') === true

const countSql = (expression: SQL, context: CountContext): number => {
  if (context.stack.has(expression)) return 0

  context.stack.add(expression)
  const nested = {
    inline: context.inline || inlinesParameters(expression),
    stack: context.stack,
  }
  const count = expression.queryChunks.reduce<number>(
    (total, chunk) => total + countChunk(chunk, nested),
    0
  )
  context.stack.delete(expression)
  return count
}

const countParameter = (parameter: Param, context: CountContext): number => {
  if (is(parameter.value, Placeholder)) return 1
  if (is(parameter.value, SQL)) return countSql(parameter.value, context)

  const encoded =
    parameter.value === null
      ? null
      : parameter.encoder.mapToDriverValue(parameter.value)
  return is(encoded, SQL) ? countSql(encoded, context) : context.inline ? 0 : 1
}

const countWrapper = (wrapper: SQLWrapper, context: CountContext): number => {
  if (context.stack.has(wrapper)) return 0

  context.stack.add(wrapper)
  const expression = wrapper.getSQL()
  const count = expression === wrapper ? 0 : countSql(expression, context)
  context.stack.delete(wrapper)
  return count
}

const countChunk = (chunk: SQLChunk, context: CountContext): number => {
  if (chunk === undefined) return 0
  if (Array.isArray(chunk)) {
    return chunk.reduce<number>(
      (total, nested) => total + countChunk(nested, context),
      0
    )
  }
  if (is(chunk, SQL)) return countSql(chunk, context)
  if (is(chunk, Placeholder)) return 1
  if (is(chunk, Param)) return countParameter(chunk, context)
  if (is(chunk, SQL.Aliased)) {
    return Reflect.get(chunk, 'isSelectionField') === true
      ? 0
      : countSql(chunk.sql, context)
  }
  if (is(chunk, Subquery)) {
    return chunk._.isWith ? 0 : countSql(chunk._.sql, context)
  }
  if (is(chunk, View)) return 0
  if (isSQLWrapper(chunk)) return countWrapper(chunk, context)

  // Primitive chunks are emitted as bound parameters unless an enclosing SQL
  // fragment explicitly opted into inlining.
  return context.inline ? 0 : 1
}

/** Counts parameters in already-resolved Drizzle SQL without rendering SQL text. */
export const countBoundParameters = (
  ...expressions: readonly (SQLWrapper | undefined)[]
): number => {
  const context: CountContext = {
    inline: false,
    stack: new WeakSet(),
  }
  return expressions.reduce<number>(
    (total, expression) =>
      total +
      (expression === undefined
        ? 0
        : is(expression, SQL)
          ? countSql(expression, context)
          : countWrapper(expression, context)),
    0
  )
}
