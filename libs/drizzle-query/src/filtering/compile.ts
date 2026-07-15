import { and, or, type SQL, sql } from 'drizzle-orm'
import { QueryError } from '../error'
import type { FieldRuntime } from '../fields/index'
import type { AnyFilterOperator } from './operators/index'
import type {
  BinaryFilterCondition,
  FilterCompilation,
  FilterCondition,
  FilterGroup,
  FilterNode,
} from './types'

export type FilterFieldSource =
  | readonly FieldRuntime[]
  | ReadonlyMap<string, FieldRuntime>

type CompilerContext = {
  readonly fields: ReadonlyMap<string, FieldRuntime>
  readonly operatorContext: unknown
}

const fieldMap = (
  fields: readonly FieldRuntime[]
): ReadonlyMap<string, FieldRuntime> =>
  new Map(
    fields.flatMap((field) =>
      field.name === undefined ? [] : ([[field.name, field]] as const)
    )
  )

const missingTypedFilterTarget = (condition: FilterCondition): QueryError =>
  new QueryError(
    'invalid-filter',
    `The typed filter target "${condition.field}.${condition.operator}" is not part of this query definition.`
  )

type OperatorHandlers = {
  readonly [Kind in AnyFilterOperator['kind']]: (
    operator: Extract<AnyFilterOperator, { readonly kind: Kind }>,
    condition: FilterCondition,
    field: FieldRuntime,
    context: unknown
  ) => SQL
}

const operatorHandlers = {
  unary: (operator, _condition, field, context) =>
    operator.compile({
      expression: field.expression,
      context: context as never,
    } as never),
  binary: (operator, condition, field, context) =>
    operator.compile({
      expression: field.expression,
      value: (condition as BinaryFilterCondition).value as never,
      bind: field.bind,
      context: context as never,
    } as never),
} satisfies OperatorHandlers

const compileOperator = (
  operator: AnyFilterOperator,
  condition: FilterCondition,
  field: FieldRuntime,
  context: unknown
): SQL => {
  return operator.kind === 'unary'
    ? operatorHandlers.unary(operator, condition, field, context)
    : operatorHandlers.binary(operator, condition, field, context)
}

const compileCondition = (
  condition: FilterCondition,
  context: CompilerContext
): SQL => {
  const field = context.fields.get(condition.field)
  const operator = field?.operatorMap?.get(condition.operator)
  if (field === undefined || operator === undefined) {
    throw missingTypedFilterTarget(condition)
  }
  return compileOperator(operator, condition, field, context.operatorContext)
}

type GroupHandler = (children: readonly (SQL | undefined)[]) => SQL | undefined

const groupHandlers = {
  and: (children) => and(...children),
  or: (children) => or(...children),
  not: (children) => {
    const child = children[0]
    return child === undefined ? undefined : sql`not (${child})`
  },
} satisfies Readonly<Record<FilterGroup['combinator'], GroupHandler>>

const compileGroup = (
  group: FilterGroup,
  context: CompilerContext
): SQL | undefined =>
  groupHandlers[group.combinator](
    group.children.map((child) => compileNode(child, context))
  )

type NodeHandlers = {
  readonly [Type in FilterNode['type']]: (
    node: Extract<FilterNode, { readonly type: Type }>,
    context: CompilerContext
  ) => SQL | undefined
}

const nodeHandlers = {
  condition: compileCondition,
  group: compileGroup,
} satisfies NodeHandlers

const compileNode = (
  node: FilterNode,
  context: CompilerContext
): SQL | undefined => {
  const handler = nodeHandlers[node.type] as (
    target: FilterNode,
    compiler: CompilerContext
  ) => SQL | undefined
  return handler(node, context)
}

export const compileFilters = (
  fields: FilterFieldSource,
  filters: readonly FilterNode[] = [],
  operatorContext?: unknown
): FilterCompilation => {
  const context: CompilerContext = {
    fields: Array.isArray(fields)
      ? fieldMap(fields)
      : (fields as ReadonlyMap<string, FieldRuntime>),
    operatorContext,
  }
  return {
    where: and(...filters.map((node) => compileNode(node, context))),
  }
}
