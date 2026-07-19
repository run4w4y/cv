import { SchemaAST } from 'effect'

import { appendJsonPointer } from '../json-pointer'
import type { EditorDescriptor, UnsupportedNode } from '../types'
import { areUnionOptionsUnambiguous } from './descriptor-match'
import { fallbackDescriptor } from './fallback'
import { isJsonPrimitive } from './json-value'
import { descriptorLabel, descriptorMetadata, withMetadata } from './metadata'
import type { InspectionState, InspectNode } from './model'
import { isJsonRepresentableAst } from './representation'

type CompositeArguments<A extends SchemaAST.AST> = {
  readonly ast: A
  readonly pointer: string
  readonly state: InspectionState
  readonly annotationSource: SchemaAST.AST
  readonly encoded: boolean
  readonly ignoreUndefined: boolean
  readonly inspectNode: InspectNode
}

export const inspectArrays = ({
  ast,
  pointer,
  state,
  annotationSource,
  encoded,
  inspectNode,
}: CompositeArguments<SchemaAST.Arrays>): EditorDescriptor => {
  const item = ast.rest[0]
  if (ast.elements.length === 0 && ast.rest.length === 1 && item) {
    return {
      kind: 'array',
      item: inspectNode(item, appendJsonPointer(pointer, 0), state),
      ...descriptorMetadata(ast, annotationSource, encoded),
    }
  }
  const jsonRepresentable = isJsonRepresentableAst(ast)
  return fallbackDescriptor(
    state,
    pointer,
    ast,
    jsonRepresentable
      ? 'Tuples and arrays with trailing elements require raw JSON editing.'
      : 'This tuple contains values that cannot be represented in JSON.',
    jsonRepresentable ? 'raw-json' : 'unrepresentable',
    annotationSource,
    encoded
  )
}

export const inspectObjects = ({
  ast,
  pointer,
  state,
  annotationSource,
  encoded,
  inspectNode,
}: CompositeArguments<SchemaAST.Objects>): EditorDescriptor => {
  if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
    return fallbackDescriptor(
      state,
      pointer,
      ast,
      'An object schema without fields accepts values that require raw JSON editing.',
      'raw-json',
      annotationSource,
      encoded
    )
  }
  if (ast.indexSignatures.length > 0) {
    const jsonRepresentable = isJsonRepresentableAst(ast)
    return fallbackDescriptor(
      state,
      pointer,
      ast,
      jsonRepresentable
        ? 'Record and index-signature schemas require raw JSON editing.'
        : 'This record contains values that cannot be represented in JSON.',
      jsonRepresentable ? 'raw-json' : 'unrepresentable',
      annotationSource,
      encoded
    )
  }
  if (ast.propertySignatures.some((field) => typeof field.name === 'symbol')) {
    return fallbackDescriptor(
      state,
      pointer,
      ast,
      'Symbol-keyed objects cannot be represented in JSON.',
      'unrepresentable',
      annotationSource,
      encoded
    )
  }

  return {
    kind: 'object',
    fields: ast.propertySignatures.map((field) => {
      const key = String(field.name)
      const fieldPointer = appendJsonPointer(pointer, key)
      return {
        key,
        pointer: fieldPointer,
        optional: SchemaAST.isOptional(field.type),
        descriptor: inspectNode(
          field.type,
          fieldPointer,
          state,
          field.type,
          false,
          true
        ),
      }
    }),
    ...descriptorMetadata(ast, annotationSource, encoded),
  }
}

const inspectUnionMembers = (
  members: ReadonlyArray<SchemaAST.AST>,
  pointer: string,
  state: InspectionState,
  inspectNode: InspectNode
) =>
  members.map((member) => {
    const unsupported: Array<UnsupportedNode> = []
    const descriptor = inspectNode(member, pointer, {
      active: state.active,
      unsupported,
    })
    return { descriptor, unsupported }
  })

export const inspectUnion = ({
  ast,
  pointer,
  state,
  annotationSource,
  encoded,
  ignoreUndefined,
  inspectNode,
}: CompositeArguments<SchemaAST.Union>): EditorDescriptor => {
  const nodeMetadata = descriptorMetadata(ast, annotationSource, encoded)
  const members = ignoreUndefined
    ? ast.types.filter((member) => member._tag !== 'Undefined')
    : ast.types
  const nullable = members.some((member) => member._tag === 'Null')
  const nonNullMembers = nullable
    ? members.filter((member) => member._tag !== 'Null')
    : members

  if (nullable && nonNullMembers.length === 1 && nonNullMembers[0]) {
    return {
      kind: 'nullable',
      value: inspectNode(nonNullMembers[0], pointer, state),
      ...nodeMetadata,
    }
  }

  const literalValues = members.flatMap((member) => {
    if (member._tag === 'Null') return [null]
    if (member._tag === 'Literal' && isJsonPrimitive(member.literal)) {
      return [member.literal]
    }
    return []
  })
  if (literalValues.length === members.length && literalValues.length > 0) {
    return literalValues.length === 1 && literalValues[0] !== undefined
      ? { kind: 'literal', value: literalValues[0], ...nodeMetadata }
      : { kind: 'choice', values: literalValues, ...nodeMetadata }
  }

  if (members.length === 1 && members[0]) {
    return withMetadata(inspectNode(members[0], pointer, state), nodeMetadata)
  }
  if (members.length === 0) {
    return fallbackDescriptor(
      state,
      pointer,
      ast,
      'A union without JSON-editable members cannot be edited here.',
      'unrepresentable',
      annotationSource,
      encoded
    )
  }

  const inspected = inspectUnionMembers(members, pointer, state, inspectNode)
  const descriptors = inspected.map((member) => member.descriptor)
  if (!areUnionOptionsUnambiguous(descriptors)) {
    const unrepresentable = inspected.some(
      (member) =>
        member.descriptor.kind === 'unrepresentable' ||
        member.unsupported.some(
          (unsupported) => unsupported.fallback === 'unrepresentable'
        )
    )
    return fallbackDescriptor(
      state,
      pointer,
      ast,
      unrepresentable
        ? 'At least one union member cannot be represented in JSON.'
        : 'Union members cannot be selected unambiguously; use raw JSON editing.',
      unrepresentable ? 'unrepresentable' : 'raw-json',
      annotationSource,
      encoded
    )
  }

  for (const member of inspected) {
    state.unsupported.push(...member.unsupported)
  }
  const options = descriptors.map((descriptor, index) => ({
    id: `${pointer || '/'}#${index}`,
    label: descriptorLabel(descriptor, index),
    descriptor,
  }))
  return { kind: 'union', mode: ast.mode, options, ...nodeMetadata }
}

export const inspectSuspend = ({
  ast,
  pointer,
  state,
  annotationSource,
  encoded,
  inspectNode,
}: CompositeArguments<SchemaAST.Suspend>): EditorDescriptor =>
  withMetadata(
    inspectNode(ast.thunk(), pointer, state),
    descriptorMetadata(ast, annotationSource, encoded)
  )
