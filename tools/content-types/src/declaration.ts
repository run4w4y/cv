import { pathToFileURL } from 'node:url'
import { Effect } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'
import ts from 'typescript'
import {
  ContentTypesFileSystemError,
  ContentTypesGenerationError,
} from './errors'
import {
  compileContentSchemaDeclarations,
  isContentSchemaRegistry,
} from './schema-declarations'
import { renderDeclarationTemplate } from './templates'

export type BuildDeclarationInput = {
  readonly authoringSourcePath: string
  readonly contentSourcePath: string
}

const indentBlock = (source: string, depth: number) => {
  const indentation = '  '.repeat(depth)

  return source
    .trim()
    .split('\n')
    .map((line) => (line.length === 0 ? line : `${indentation}${line}`))
    .join('\n')
}

const hasExportModifier = (node: ts.Node) =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node) ?? []).some(
    (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
  )

const declarationName = (statement: ts.Statement) =>
  ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)
    ? statement.name.text
    : null

const sourceFileFrom = (
  source: string,
  fileName: string,
  kind: ts.ScriptKind
) => ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, kind)

type AuthoringComponentDeclaration = {
  readonly name: string
  readonly propsTypeName: string
}

const isDefineAuthoringComponentCall = (
  expression: ts.Expression
): expression is ts.CallExpression =>
  ts.isCallExpression(expression) &&
  ts.isIdentifier(expression.expression) &&
  expression.expression.text === 'defineAuthoringComponent'

const typeReferenceName = (node: ts.TypeNode | undefined) =>
  node && ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)
    ? node.typeName.text
    : null

const collectAuthoringComponents = (sourceFile: ts.SourceFile) => {
  const components: AuthoringComponentDeclaration[] = []

  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement) || !hasExportModifier(statement)) {
      continue
    }

    for (const declaration of statement.declarationList.declarations) {
      const name = ts.isIdentifier(declaration.name)
        ? declaration.name.text
        : null
      const initializer = declaration.initializer

      if (
        !name ||
        !initializer ||
        !isDefineAuthoringComponentCall(initializer)
      ) {
        continue
      }

      const propsTypeName = typeReferenceName(initializer.typeArguments?.[0])

      if (!propsTypeName) {
        throw new Error(
          `${name} must pass a named props type to defineAuthoringComponent.`
        )
      }

      components.push({ name, propsTypeName })
    }
  }

  return components
}

const collectTypeDeclarations = (sourceFile: ts.SourceFile) => {
  const declarations = new Map<
    string,
    ts.InterfaceDeclaration | ts.TypeAliasDeclaration
  >()

  for (const statement of sourceFile.statements) {
    const name = declarationName(statement)

    if (
      name &&
      (ts.isTypeAliasDeclaration(statement) ||
        ts.isInterfaceDeclaration(statement))
    ) {
      declarations.set(name, statement)
    }
  }

  return declarations
}

const portableAuthoringDeclaration = (
  declaration: ts.InterfaceDeclaration | ts.TypeAliasDeclaration,
  sourceFile: ts.SourceFile
) => {
  const exported = hasExportModifier(declaration)
    ? declaration.getText(sourceFile)
    : `export ${declaration.getText(sourceFile)}`

  return exported
    .replace(/\bReactElement\b/gu, 'AuthoringElement')
    .replace(/\bReactNode\b/gu, 'AuthoringChildren')
}

const extractAuthoring = (source: string, fileName: string) => {
  const sourceFile = sourceFileFrom(source, fileName, ts.ScriptKind.TSX)
  const components = collectAuthoringComponents(sourceFile)
  const typeDeclarations = collectTypeDeclarations(sourceFile)
  const propsTypeNames = [
    ...new Set(components.map((component) => component.propsTypeName)),
  ]
  const authoringDeclarations = propsTypeNames.map((name) => {
    const declaration = typeDeclarations.get(name)

    if (!declaration) {
      throw new Error(`Missing authoring props declaration: ${name}`)
    }

    return portableAuthoringDeclaration(declaration, sourceFile)
  })

  if (components.length === 0) {
    throw new Error(`No authoring components found in ${fileName}`)
  }

  return {
    authoringDeclarations: authoringDeclarations.join('\n\n'),
    componentExports: components
      .map(
        ({ name, propsTypeName }) =>
          `export const ${name}: ContentAuthoring.Component<ContentAuthoring.${propsTypeName}>`
      )
      .join('\n'),
  }
}

const readSourceFile = (sourcePath: string) =>
  Effect.gen(function* () {
    const path = yield* Path
    const fileSystem = yield* FileSystem
    const resolvedSourcePath = path.resolve(sourcePath)
    const source = yield* fileSystem.readFileString(resolvedSourcePath).pipe(
      Effect.mapError(
        (cause) =>
          new ContentTypesFileSystemError({
            cause,
            operation: 'read',
            path: resolvedSourcePath,
          })
      )
    )

    return { path: resolvedSourcePath, source }
  })

const importSourceModule = (sourcePath: string) =>
  Effect.gen(function* () {
    const path = yield* Path
    const resolvedSourcePath = path.resolve(sourcePath)
    const sourceUrl = pathToFileURL(resolvedSourcePath)
    sourceUrl.searchParams.set('generatedAt', String(Date.now()))

    return yield* Effect.tryPromise({
      try: () => import(sourceUrl.href) as Promise<Record<string, unknown>>,
      catch: (cause) =>
        new ContentTypesGenerationError({
          cause,
          message: `Could not import content schema module from ${resolvedSourcePath}`,
        }),
    })
  })

const buildContentDeclarations = (sourcePath: string) =>
  importSourceModule(sourcePath).pipe(
    Effect.flatMap((sourceModule) =>
      Effect.try({
        try: () => {
          const registry = sourceModule.contentSchemas

          if (!isContentSchemaRegistry(registry)) {
            throw new Error(
              `${sourcePath} must export a contentSchemas registry.`
            )
          }

          return indentBlock(compileContentSchemaDeclarations(registry), 2)
        },
        catch: (cause) =>
          new ContentTypesGenerationError({
            cause,
            message: `Could not generate content declarations from ${sourcePath}`,
          }),
      })
    )
  )

const buildAuthoringDeclarations = (sourcePath: string) =>
  readSourceFile(sourcePath).pipe(
    Effect.flatMap(({ path, source }) =>
      Effect.try({
        try: () => {
          const { authoringDeclarations, componentExports } = extractAuthoring(
            source,
            path
          )

          return {
            authoringDeclarations: indentBlock(authoringDeclarations, 1),
            componentExports: indentBlock(componentExports, 1),
          }
        },
        catch: (cause) =>
          new ContentTypesGenerationError({
            cause,
            message: `Could not extract authoring declarations from ${path}`,
          }),
      })
    )
  )

export const buildDeclaration = ({
  authoringSourcePath,
  contentSourcePath,
}: BuildDeclarationInput) =>
  Effect.gen(function* () {
    const contentDeclarations =
      yield* buildContentDeclarations(contentSourcePath)
    const { authoringDeclarations, componentExports } =
      yield* buildAuthoringDeclarations(authoringSourcePath)

    return yield* renderDeclarationTemplate({
      authoringDeclarations,
      componentExports,
      contentDeclarations,
    })
  })
