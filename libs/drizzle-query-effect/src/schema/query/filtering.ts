import type { FilterValueDescriptor, QueryFieldInfo } from '@cv/drizzle-query'
import { Schema } from 'effect'

import { effectSchemaAnnotation } from '../operator'

type RuntimeSchema = Schema.Constraint
type DescriptorType = FilterValueDescriptor['type']
type Descriptor<Type extends DescriptorType> = Extract<
  FilterValueDescriptor,
  { readonly type: Type }
>
type DescriptorCompilers = {
  readonly [Type in DescriptorType]: (
    descriptor: Descriptor<Type>
  ) => RuntimeSchema
}

const descriptorCompilers = {
  string: () => Schema.String,
  number: () => Schema.Number,
  bigint: () => Schema.BigIntFromString,
  boolean: () => Schema.Boolean,
  date: () => Schema.DateFromString,
  enum: (descriptor) =>
    descriptor.values.length === 0
      ? Schema.Never
      : Schema.Literals(descriptor.values as readonly [string, ...string[]]),
  unknown: () => Schema.Unknown,
  array: (descriptor) => Schema.Array(descriptorSchema(descriptor.item)),
  tuple: (descriptor) => Schema.Tuple(descriptor.items.map(descriptorSchema)),
  struct: (descriptor) =>
    Schema.Struct(
      Object.fromEntries(
        Object.entries(descriptor.fields).map(([name, value]) => [
          name,
          descriptorSchema(value),
        ])
      )
    ),
} satisfies DescriptorCompilers

const descriptorSchema = (descriptor: FilterValueDescriptor): RuntimeSchema => {
  const compile = descriptorCompilers[descriptor.type] as (
    input: FilterValueDescriptor
  ) => RuntimeSchema
  return compile(descriptor)
}

const operatorValueSchema = (
  field: QueryFieldInfo,
  operator: QueryFieldInfo['filterOperatorInfo'][number]
): RuntimeSchema => {
  if (operator.annotations?.has(effectSchemaAnnotation) === true) {
    const annotation = operator.annotations.get(effectSchemaAnnotation)
    if (!Schema.isSchema(annotation)) {
      throw new TypeError(
        `Filter operator "${field.name}.${operator.name}" has invalid Effect Schema metadata.`
      )
    }
    return annotation
  }
  if (operator.value === undefined) {
    throw new TypeError(
      `Binary filter operator "${field.name}.${operator.name}" has no value descriptor.`
    )
  }
  return descriptorSchema(operator.value)
}

const union = (members: readonly RuntimeSchema[]): RuntimeSchema =>
  members.length === 0
    ? Schema.Never
    : members.length === 1
      ? (members[0] as RuntimeSchema)
      : Schema.Union(members as readonly [RuntimeSchema, ...RuntimeSchema[]])

/** @internal Derives the recursive filter-node schema from field metadata. */
export const filterNodeSchema = (
  fields: readonly QueryFieldInfo[]
): RuntimeSchema => {
  const conditions = fields.flatMap((field) =>
    field.filterOperatorInfo.map((operator) =>
      operator.kind === 'unary'
        ? Schema.Struct({
            type: Schema.Literal('condition'),
            field: Schema.Literal(field.name),
            operator: Schema.Literal(operator.name),
          })
        : Schema.Struct({
            type: Schema.Literal('condition'),
            field: Schema.Literal(field.name),
            operator: Schema.Literal(operator.name),
            value: operatorValueSchema(field, operator),
          })
    )
  )

  let node: RuntimeSchema = Schema.Never
  const child = Schema.suspend(() => node)
  const groups: readonly RuntimeSchema[] = [
    Schema.Struct({
      type: Schema.Literal('group'),
      combinator: Schema.Literals(['and', 'or']),
      children: Schema.NonEmptyArray(child),
    }),
    Schema.Struct({
      type: Schema.Literal('group'),
      combinator: Schema.Literal('not'),
      children: Schema.Tuple([child]),
    }),
  ]
  node = union([...conditions, ...groups])
  return node
}

/** @internal Derives the ordering schema from sortable field metadata. */
export const orderingSchema = (
  fields: readonly QueryFieldInfo[]
): RuntimeSchema => {
  const sortableFields = fields.filter((field) => field.sortable)
  if (sortableFields.length === 0) return Schema.Array(Schema.Never)

  return Schema.Array(
    Schema.Struct({
      field: Schema.Literals(
        sortableFields.map((field) => field.name) as [string, ...string[]]
      ),
      direction: Schema.optional(Schema.Literals(['asc', 'desc'])),
      nulls: Schema.optional(Schema.Literals(['first', 'last'])),
    })
  )
}
