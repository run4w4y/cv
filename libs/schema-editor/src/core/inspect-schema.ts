import { SchemaAST } from 'effect'

import { appendJsonPointer } from './json-pointer'
import type {
  DescriptorMetadata,
  EditorDescriptor,
  JsonPrimitive,
  JsonValue,
  SchemaInspection,
  UnsupportedNode,
} from './types'

type InspectionState = {
  readonly unsupported: Array<UnsupportedNode>
  readonly active: Set<SchemaAST.AST>
}

const isStringRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isJsonValue = (
  value: unknown,
  active: Set<object> = new Set()
): value is JsonValue => {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return true
  }
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value !== 'object') return false
  if (active.has(value)) return false

  active.add(value)
  const valid = Array.isArray(value)
    ? value.every((item) => isJsonValue(item, active))
    : isStringRecord(value) &&
      Object.values(value).every((item) => isJsonValue(item, active))
  active.delete(value)
  return valid
}

const metadata = (
  ast: SchemaAST.AST,
  annotationSource: SchemaAST.AST,
  encoded: boolean
): DescriptorMetadata => {
  const annotations = {
    ...SchemaAST.resolve(ast),
    ...SchemaAST.resolve(annotationSource),
    ...annotationSource.context?.annotations,
  }
  const examples = Array.isArray(annotations.examples)
    ? annotations.examples.filter((example): example is JsonValue =>
        isJsonValue(example)
      )
    : undefined

  return {
    title:
      typeof annotations.title === 'string' ? annotations.title : undefined,
    description:
      typeof annotations.description === 'string'
        ? annotations.description
        : undefined,
    documentation:
      typeof annotations.documentation === 'string'
        ? annotations.documentation
        : undefined,
    defaultValue: isJsonValue(annotations.default)
      ? annotations.default
      : undefined,
    examples: examples && examples.length > 0 ? examples : undefined,
    expected:
      typeof annotations.expected === 'string'
        ? annotations.expected
        : undefined,
    format:
      typeof annotations.format === 'string' ? annotations.format : undefined,
    checked:
      (annotationSource.checks?.length ?? 0) > 0 ||
      (ast.checks?.length ?? 0) > 0,
    encoded,
  }
}

const withMetadata = (
  descriptor: EditorDescriptor,
  override: DescriptorMetadata
): EditorDescriptor =>
  Object.assign({}, descriptor, {
    title: override.title ?? descriptor.title,
    description: override.description ?? descriptor.description,
    documentation: override.documentation ?? descriptor.documentation,
    defaultValue: override.defaultValue ?? descriptor.defaultValue,
    examples: override.examples ?? descriptor.examples,
    expected: override.expected ?? descriptor.expected,
    format: override.format ?? descriptor.format,
    checked: override.checked || descriptor.checked,
    encoded: override.encoded || descriptor.encoded,
  })

const labelFor = (descriptor: EditorDescriptor, index: number): string =>
  descriptor.title ??
  (descriptor.kind === 'literal'
    ? String(descriptor.value)
    : descriptor.kind === 'object'
      ? `Object ${index + 1}`
      : `${descriptor.kind} ${index + 1}`)

const unsupported = (
  state: InspectionState,
  pointer: string,
  ast: SchemaAST.AST,
  reason: string,
  annotationSource = ast,
  encoded = false
): EditorDescriptor => {
  const expected = SchemaAST.resolve(ast)?.expected
  state.unsupported.push({ pointer, astTag: ast._tag, reason })
  return {
    kind: 'raw',
    astTag: ast._tag,
    reason,
    expected: typeof expected === 'string' ? expected : undefined,
    ...metadata(ast, annotationSource, encoded),
  }
}

const isJsonPrimitive = (value: unknown): value is JsonPrimitive =>
  value === null ||
  typeof value === 'string' ||
  (typeof value === 'number' && Number.isFinite(value)) ||
  typeof value === 'boolean'

const inspectNode = (
  ast: SchemaAST.AST,
  pointer: string,
  state: InspectionState,
  annotationSource = ast,
  encoded = false,
  ignoreUndefined = false
): EditorDescriptor => {
  if (ast.encoding !== undefined) {
    return inspectNode(
      SchemaAST.toEncoded(ast),
      pointer,
      state,
      ast,
      true,
      ignoreUndefined
    )
  }

  if (state.active.has(ast)) {
    return unsupported(
      state,
      pointer,
      ast,
      'Recursive schema branches require raw JSON editing.',
      annotationSource,
      encoded
    )
  }

  state.active.add(ast)
  const nodeMetadata = metadata(ast, annotationSource, encoded)
  let descriptor: EditorDescriptor

  switch (ast._tag) {
    case 'String':
    case 'TemplateLiteral':
      descriptor = { kind: 'string', ...nodeMetadata }
      break
    case 'Number':
      descriptor = { kind: 'number', ...nodeMetadata }
      break
    case 'Boolean':
      descriptor = { kind: 'boolean', ...nodeMetadata }
      break
    case 'Null':
      descriptor = { kind: 'literal', value: null, ...nodeMetadata }
      break
    case 'Literal':
      descriptor = isJsonPrimitive(ast.literal)
        ? { kind: 'literal', value: ast.literal, ...nodeMetadata }
        : unsupported(
            state,
            pointer,
            ast,
            'BigInt literals cannot be represented directly in JSON.',
            annotationSource,
            encoded
          )
      break
    case 'Enum':
      descriptor = ast.enums.every((entry) => isJsonPrimitive(entry[1]))
        ? {
            kind: 'choice',
            values: ast.enums.map((entry) => entry[1]),
            ...nodeMetadata,
          }
        : unsupported(
            state,
            pointer,
            ast,
            'Non-finite enum values cannot be represented directly in JSON.',
            annotationSource,
            encoded
          )
      break
    case 'Arrays': {
      const item = ast.rest[0]
      descriptor =
        ast.elements.length === 0 && ast.rest.length === 1 && item
          ? {
              kind: 'array',
              item: inspectNode(item, appendJsonPointer(pointer, 0), state),
              ...nodeMetadata,
            }
          : unsupported(
              state,
              pointer,
              ast,
              'Tuples and arrays with trailing elements require raw JSON editing.',
              annotationSource,
              encoded
            )
      break
    }
    case 'Objects': {
      if (ast.indexSignatures.length > 0) {
        descriptor = unsupported(
          state,
          pointer,
          ast,
          'Record and index-signature schemas require raw JSON editing.',
          annotationSource,
          encoded
        )
        break
      }
      if (
        ast.propertySignatures.some((field) => typeof field.name === 'symbol')
      ) {
        descriptor = unsupported(
          state,
          pointer,
          ast,
          'Symbol-keyed objects cannot be represented in JSON.',
          annotationSource,
          encoded
        )
        break
      }
      descriptor = {
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
        ...nodeMetadata,
      }
      break
    }
    case 'Union': {
      const members = ignoreUndefined
        ? ast.types.filter((member) => member._tag !== 'Undefined')
        : ast.types
      const nullable = members.some((member) => member._tag === 'Null')
      const nonNullMembers = nullable
        ? members.filter((member) => member._tag !== 'Null')
        : members

      if (nullable && nonNullMembers.length === 1 && nonNullMembers[0]) {
        descriptor = {
          kind: 'nullable',
          value: inspectNode(nonNullMembers[0], pointer, state),
          ...nodeMetadata,
        }
        break
      }

      const literalValues = members.flatMap((member) => {
        if (member._tag === 'Null') return [null]
        if (member._tag === 'Literal' && isJsonPrimitive(member.literal)) {
          return [member.literal]
        }
        return []
      })
      if (literalValues.length === members.length && literalValues.length > 0) {
        descriptor =
          literalValues.length === 1 && literalValues[0] !== undefined
            ? {
                kind: 'literal',
                value: literalValues[0],
                ...nodeMetadata,
              }
            : { kind: 'choice', values: literalValues, ...nodeMetadata }
        break
      }

      if (members.length === 1 && members[0]) {
        descriptor = withMetadata(
          inspectNode(members[0], pointer, state),
          nodeMetadata
        )
        break
      }

      if (members.length === 0) {
        descriptor = unsupported(
          state,
          pointer,
          ast,
          'A union without editable members requires raw JSON editing.',
          annotationSource,
          encoded
        )
        break
      }

      const options = members.map((member, index) => {
        const optionDescriptor = inspectNode(member, pointer, state)
        return {
          id: `${pointer || '/'}#${index}`,
          label: labelFor(optionDescriptor, index),
          descriptor: optionDescriptor,
        }
      })
      descriptor = { kind: 'union', mode: ast.mode, options, ...nodeMetadata }
      break
    }
    case 'Suspend':
      descriptor = withMetadata(
        inspectNode(ast.thunk(), pointer, state),
        nodeMetadata
      )
      break
    case 'Declaration':
      descriptor = unsupported(
        state,
        pointer,
        ast,
        'Opaque declaration schemas require raw JSON editing.',
        annotationSource,
        encoded
      )
      break
    case 'Unknown':
    case 'Any':
      descriptor = unsupported(
        state,
        pointer,
        ast,
        'Unconstrained values require raw JSON editing.',
        annotationSource,
        encoded
      )
      break
    case 'ObjectKeyword':
      descriptor = unsupported(
        state,
        pointer,
        ast,
        'The object keyword does not describe editable fields.',
        annotationSource,
        encoded
      )
      break
    case 'BigInt':
    case 'Symbol':
    case 'UniqueSymbol':
      descriptor = unsupported(
        state,
        pointer,
        ast,
        `${ast._tag} values cannot be represented directly in JSON.`,
        annotationSource,
        encoded
      )
      break
    case 'Undefined':
    case 'Void':
    case 'Never':
      descriptor = unsupported(
        state,
        pointer,
        ast,
        `${ast._tag} does not have an editable JSON value.`,
        annotationSource,
        encoded
      )
      break
  }

  state.active.delete(ast)
  return descriptor
}

export interface InspectableSchema {
  readonly ast: SchemaAST.AST
}

export const inspectSchema = (schema: InspectableSchema): SchemaInspection => {
  const unsupportedNodes: Array<UnsupportedNode> = []
  const descriptor = inspectNode(schema.ast, '', {
    unsupported: unsupportedNodes,
    active: new Set(),
  })

  return {
    descriptor,
    unsupported: unsupportedNodes,
    structurallyEditable: unsupportedNodes.length === 0,
  }
}
