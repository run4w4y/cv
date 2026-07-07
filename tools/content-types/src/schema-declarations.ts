import {
  isBoolean,
  isFunction,
  isNull,
  isNumber,
  isObject,
  isString,
} from 'es-toolkit/compat'

type SchemaAst = {
  readonly _tag: string
  readonly [key: string]: unknown
}

type SchemaLike = {
  readonly ast: SchemaAst
}

type SchemaMap = Record<string, SchemaLike | undefined>

export type ContentSchemaRegistry = {
  readonly ambient?: SchemaMap
  readonly declarations: SchemaMap
  readonly entries: SchemaMap
  readonly mdxMeta: SchemaMap
  readonly modules: SchemaMap
}

type CompileContext = {
  readonly currentName?: string
  readonly references: ReadonlyMap<SchemaAst, string>
}

const hasObjectProperties = (
  value: unknown
): value is Record<string, unknown> => isObject(value) || isFunction(value)

const isSchemaAst = (value: unknown): value is SchemaAst =>
  hasObjectProperties(value) && isString(value._tag)

export const isContentSchemaRegistry = (
  value: unknown
): value is ContentSchemaRegistry =>
  hasObjectProperties(value) &&
  hasObjectProperties(value.declarations) &&
  hasObjectProperties(value.entries) &&
  hasObjectProperties(value.mdxMeta) &&
  hasObjectProperties(value.modules)

const isSchemaLike = (value: unknown): value is SchemaLike =>
  hasObjectProperties(value) && isSchemaAst(value.ast)

const schemaEntries = (schemas: SchemaMap) =>
  Object.entries(schemas).filter(
    (entry): entry is [string, SchemaLike] => entry[1] !== undefined
  )

const isReferenceableAst = (ast: SchemaAst) =>
  !['Boolean', 'Literal', 'Number', 'String', 'Undefined', 'Unknown'].includes(
    ast._tag
  )

const schemaFor = (
  schemas: SchemaMap,
  name: string,
  context: string
): SchemaLike => {
  const schema = schemas[name]

  if (!isSchemaLike(schema)) {
    throw new Error(`${context} schema "${name}" is not an Effect Schema.`)
  }

  return schema
}

const collectReferences = (registry: ContentSchemaRegistry) => {
  const references = new Map<SchemaAst, string>()

  for (const schemas of [
    registry.ambient ?? {},
    registry.declarations,
  ] satisfies readonly SchemaMap[]) {
    for (const [name, schema] of schemaEntries(schemas)) {
      if (isReferenceableAst(schema.ast)) {
        references.set(schema.ast, name)
      }
    }
  }

  return references
}

const hasUndefined = (ast: SchemaAst): boolean =>
  ast._tag === 'Undefined' ||
  (ast._tag === 'Union' &&
    Array.isArray(ast.types) &&
    ast.types.some((member) => isSchemaAst(member) && hasUndefined(member)))

const isOptionalAst = (ast: SchemaAst) =>
  hasUndefined(ast) ||
  (hasObjectProperties(ast.context) && ast.context.isOptional === true)

const withoutUndefined = (ast: SchemaAst): SchemaAst => {
  if (
    ast._tag !== 'Union' ||
    !Array.isArray(ast.types) ||
    !ast.types.every(hasObjectProperties)
  ) {
    return ast
  }

  const types = ast.types.filter((member) => member._tag !== 'Undefined')

  return types.length === 1 ? (types[0] as SchemaAst) : { ...ast, types }
}

const propertyName = (name: unknown) => {
  if (isNumber(name)) {
    return String(name)
  }

  if (!isString(name)) {
    throw new Error(`Unsupported schema property name: ${String(name)}`)
  }

  return /^[$A-Z_a-z][$\w]*$/u.test(name) ? name : JSON.stringify(name)
}

const literalType = (literal: unknown) => {
  if (
    isNull(literal) ||
    isString(literal) ||
    isNumber(literal) ||
    isBoolean(literal)
  ) {
    return JSON.stringify(literal)
  }

  throw new Error(`Unsupported schema literal: ${String(literal)}`)
}

const indentLines = (source: string, depth: number) => {
  const indentation = '  '.repeat(depth)

  return source
    .split('\n')
    .map((line) => (line.length === 0 ? line : `${indentation}${line}`))
    .join('\n')
}

const parenthesizeForArray = (source: string) =>
  source.includes('|') || source.includes('&') || source.startsWith('{')
    ? `(${source})`
    : source

const compileUnion = (ast: SchemaAst, context: CompileContext): string => {
  if (!Array.isArray(ast.types)) {
    throw new Error('Schema union is missing a types array.')
  }

  const members = ast.types.map((member) =>
    compileAst(member as SchemaAst, context)
  )

  return members.length === 0 ? 'never' : members.join(' | ')
}

const compileArray = (ast: SchemaAst, context: CompileContext): string => {
  if (!Array.isArray(ast.rest) || ast.rest.length !== 1) {
    throw new Error('Only homogeneous readonly array schemas are supported.')
  }

  return `readonly ${parenthesizeForArray(
    compileAst(ast.rest[0] as SchemaAst, context)
  )}[]`
}

const compileIndexSignature = (
  signature: Record<string, unknown>,
  context: CompileContext
) => {
  const parameter = signature.parameter as SchemaAst | undefined
  const value = signature.type as SchemaAst | undefined

  if (!parameter || !value) {
    throw new Error('Malformed schema index signature.')
  }

  const key =
    parameter._tag === 'String'
      ? 'string'
      : parameter._tag === 'Number'
        ? 'number'
        : null

  if (!key) {
    throw new Error(`Unsupported schema index signature key: ${parameter._tag}`)
  }

  return `readonly [key: ${key}]: ${compileAst(value, context)}`
}

const compileObject = (ast: SchemaAst, context: CompileContext): string => {
  const properties = Array.isArray(ast.propertySignatures)
    ? ast.propertySignatures
    : []
  const indexes = Array.isArray(ast.indexSignatures) ? ast.indexSignatures : []
  const members = [
    ...properties.map((property) => {
      if (!hasObjectProperties(property) || !isSchemaAst(property.type)) {
        throw new Error('Malformed schema property signature.')
      }

      const optional = isOptionalAst(property.type)
      const type = withoutUndefined(property.type as SchemaAst)

      return `readonly ${propertyName(property.name)}${optional ? '?' : ''}: ${compileAst(type, context)}`
    }),
    ...indexes.map((signature) => {
      if (!hasObjectProperties(signature)) {
        throw new Error('Malformed schema index signature.')
      }

      return compileIndexSignature(signature, context)
    }),
  ]

  return members.length === 0
    ? '{}'
    : `{\n${members.map((member) => indentLines(member, 1)).join('\n')}\n}`
}

const compileAst = (ast: SchemaAst, context: CompileContext): string => {
  const reference = context.references.get(ast)

  if (reference && reference !== context.currentName) {
    return reference
  }

  switch (ast._tag) {
    case 'String':
      return 'string'
    case 'Number':
      return 'number'
    case 'Boolean':
      return 'boolean'
    case 'Unknown':
      return 'unknown'
    case 'Undefined':
      return 'undefined'
    case 'Literal':
      return literalType(ast.literal)
    case 'Union':
      return compileUnion(ast, context)
    case 'Arrays':
      return compileArray(ast, context)
    case 'Objects':
      return compileObject(ast, context)
    default:
      throw new Error(`Unsupported Effect Schema AST tag: ${ast._tag}`)
  }
}

const genericDeclarations = new Map([
  [
    'CvSectionList',
    `export type CvSectionList<Item> = {
  readonly description?: string
  readonly items: readonly Item[]
  readonly label: string
}`,
  ],
])

const compileDeclaration = (
  name: string,
  registry: ContentSchemaRegistry,
  references: ReadonlyMap<SchemaAst, string>
) => {
  const genericDeclaration = genericDeclarations.get(name)

  if (genericDeclaration) {
    return genericDeclaration
  }

  const schema = schemaFor(registry.declarations, name, 'declaration')

  return `export type ${name} = ${compileAst(schema.ast, {
    currentName: name,
    references,
  })}`
}

const compileSchemaMap = (
  name: string,
  schemas: SchemaMap,
  references: ReadonlyMap<SchemaAst, string>
) => {
  const members = schemaEntries(schemas).map(
    ([key, schema]) =>
      `readonly ${propertyName(key)}: ${compileAst(schema.ast, { references })}`
  )

  return `export type ${name} = {\n${members
    .map((member) => indentLines(member, 1))
    .join('\n')}\n}`
}

export const compileContentSchemaDeclarations = (
  registry: ContentSchemaRegistry
) => {
  const references = collectReferences(registry)
  const declarations = Object.keys(registry.declarations).map((name) =>
    compileDeclaration(name, registry, references)
  )

  return [
    ...declarations,
    compileSchemaMap('ContentModules', registry.modules, references),
    compileSchemaMap('ContentEntries', registry.entries, references),
    compileSchemaMap('ContentMdxMeta', registry.mdxMeta, references),
  ].join('\n\n')
}
