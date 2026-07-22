import type { SchemaAST } from 'effect'

import type { EditorDescriptor, UnsupportedFallback } from '../types'
import { descriptorMetadata } from './metadata'
import type { InspectionState } from './model'

export const fallbackDescriptor = (
  state: InspectionState,
  pointer: string,
  ast: SchemaAST.AST,
  reason: string,
  fallback: UnsupportedFallback,
  annotationSource = ast,
  encoded = false
): EditorDescriptor => {
  state.unsupported.push({
    pointer,
    astTag: ast._tag,
    reason,
    fallback,
  })
  const common = {
    astTag: ast._tag,
    reason,
    ...descriptorMetadata(ast, annotationSource, encoded),
  }
  return fallback === 'raw-json'
    ? { kind: 'raw', ...common }
    : { kind: 'unrepresentable', ...common }
}
