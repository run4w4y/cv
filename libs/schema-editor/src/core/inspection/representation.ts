import { SchemaAST } from 'effect'

import { isJsonPrimitive } from './json-value'

/** Whether the encoded AST contains no intrinsically non-JSON node kinds. */
export const isJsonRepresentableAst = (
  ast: SchemaAST.AST,
  active: Set<SchemaAST.AST> = new Set(),
  ignoreUndefined = false
): boolean => {
  if (ast.encoding !== undefined) {
    return isJsonRepresentableAst(
      SchemaAST.toEncoded(ast),
      active,
      ignoreUndefined
    )
  }
  if (active.has(ast)) return true

  active.add(ast)
  try {
    switch (ast._tag) {
      case 'Literal':
        return isJsonPrimitive(ast.literal)
      case 'Enum':
        return ast.enums.every((entry) => isJsonPrimitive(entry[1]))
      case 'Arrays':
        return [...ast.elements, ...ast.rest].every((member) =>
          isJsonRepresentableAst(member, active)
        )
      case 'Objects':
        return (
          ast.propertySignatures.every(
            (field) =>
              typeof field.name !== 'symbol' &&
              isJsonRepresentableAst(
                field.type,
                active,
                SchemaAST.isOptional(field.type)
              )
          ) &&
          ast.indexSignatures.every(
            (signature) =>
              isJsonRepresentableAst(signature.parameter, active) &&
              isJsonRepresentableAst(signature.type, active)
          )
        )
      case 'Union':
        return ast.types
          .filter((member) => !(ignoreUndefined && member._tag === 'Undefined'))
          .every((member) => isJsonRepresentableAst(member, active))
      case 'Suspend':
        return isJsonRepresentableAst(ast.thunk(), active, ignoreUndefined)
      case 'BigInt':
      case 'Symbol':
      case 'UniqueSymbol':
      case 'Undefined':
      case 'Void':
      case 'Never':
        return false
      case 'Declaration':
      case 'Null':
      case 'Unknown':
      case 'Any':
      case 'String':
      case 'Number':
      case 'Boolean':
      case 'ObjectKeyword':
      case 'TemplateLiteral':
        return true
    }
  } finally {
    active.delete(ast)
  }
}
