import { SchemaAST } from 'effect'

import {
  inspectArrays,
  inspectObjects,
  inspectSuspend,
  inspectUnion,
} from './inspection/composites'
import { fallbackDescriptor } from './inspection/fallback'
import { isJsonPrimitive } from './inspection/json-value'
import { descriptorMetadata } from './inspection/metadata'
import type { InspectNode } from './inspection/model'
import type {
  EditorDescriptor,
  SchemaInspection,
  UnsupportedNode,
} from './types'

const inspectNode: InspectNode = (
  ast,
  pointer,
  state,
  annotationSource = ast,
  encoded = false,
  ignoreUndefined = false
) => {
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
    return fallbackDescriptor(
      state,
      pointer,
      ast,
      'Recursive schema branches require raw JSON editing.',
      'raw-json',
      annotationSource,
      encoded
    )
  }

  state.active.add(ast)
  try {
    const nodeMetadata = descriptorMetadata(ast, annotationSource, encoded)
    switch (ast._tag) {
      case 'String':
      case 'TemplateLiteral':
        return { kind: 'string', ...nodeMetadata }
      case 'Number':
        return { kind: 'number', ...nodeMetadata }
      case 'Boolean':
        return { kind: 'boolean', ...nodeMetadata }
      case 'Null':
        return { kind: 'literal', value: null, ...nodeMetadata }
      case 'Literal':
        return isJsonPrimitive(ast.literal)
          ? { kind: 'literal', value: ast.literal, ...nodeMetadata }
          : fallbackDescriptor(
              state,
              pointer,
              ast,
              'BigInt literals cannot be represented directly in JSON.',
              'unrepresentable',
              annotationSource,
              encoded
            )
      case 'Enum':
        return ast.enums.every((entry) => isJsonPrimitive(entry[1]))
          ? {
              kind: 'choice',
              values: ast.enums.map((entry) => entry[1]),
              ...nodeMetadata,
            }
          : fallbackDescriptor(
              state,
              pointer,
              ast,
              'Enum values that are not finite JSON primitives cannot be edited here.',
              'unrepresentable',
              annotationSource,
              encoded
            )
      case 'Arrays':
        return inspectArrays({
          ast,
          pointer,
          state,
          annotationSource,
          encoded,
          ignoreUndefined,
          inspectNode,
        })
      case 'Objects':
        return inspectObjects({
          ast,
          pointer,
          state,
          annotationSource,
          encoded,
          ignoreUndefined,
          inspectNode,
        })
      case 'Union':
        return inspectUnion({
          ast,
          pointer,
          state,
          annotationSource,
          encoded,
          ignoreUndefined,
          inspectNode,
        })
      case 'Suspend':
        return inspectSuspend({
          ast,
          pointer,
          state,
          annotationSource,
          encoded,
          ignoreUndefined,
          inspectNode,
        })
      case 'Declaration':
        return fallbackDescriptor(
          state,
          pointer,
          ast,
          'Opaque declaration schemas require raw JSON editing.',
          'raw-json',
          annotationSource,
          encoded
        )
      case 'Unknown':
      case 'Any':
        return fallbackDescriptor(
          state,
          pointer,
          ast,
          'Unconstrained values require raw JSON editing.',
          'raw-json',
          annotationSource,
          encoded
        )
      case 'ObjectKeyword':
        return fallbackDescriptor(
          state,
          pointer,
          ast,
          'The object keyword does not describe editable fields.',
          'raw-json',
          annotationSource,
          encoded
        )
      case 'BigInt':
      case 'Symbol':
      case 'UniqueSymbol':
        return fallbackDescriptor(
          state,
          pointer,
          ast,
          `${ast._tag} values cannot be represented directly in JSON.`,
          'unrepresentable',
          annotationSource,
          encoded
        )
      case 'Undefined':
      case 'Void':
      case 'Never':
        return fallbackDescriptor(
          state,
          pointer,
          ast,
          `${ast._tag} does not have an editable JSON value.`,
          'unrepresentable',
          annotationSource,
          encoded
        )
    }
  } finally {
    state.active.delete(ast)
  }
}

export interface InspectableSchema {
  readonly ast: SchemaAST.AST
}

export const inspectSchema = (schema: InspectableSchema): SchemaInspection => {
  const unsupported: Array<UnsupportedNode> = []
  const descriptor: EditorDescriptor = inspectNode(schema.ast, '', {
    unsupported,
    active: new Set(),
  })

  return {
    descriptor,
    unsupported,
    structurallyEditable: unsupported.length === 0,
    jsonEditable: unsupported.every((node) => node.fallback === 'raw-json'),
  }
}
