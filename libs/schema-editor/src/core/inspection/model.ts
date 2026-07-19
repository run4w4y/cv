import type { SchemaAST } from 'effect'

import type { EditorDescriptor, UnsupportedNode } from '../types'

export type InspectionState = {
  readonly unsupported: Array<UnsupportedNode>
  readonly active: Set<SchemaAST.AST>
}

export type InspectNode = (
  ast: SchemaAST.AST,
  pointer: string,
  state: InspectionState,
  annotationSource?: SchemaAST.AST,
  encoded?: boolean,
  ignoreUndefined?: boolean
) => EditorDescriptor
