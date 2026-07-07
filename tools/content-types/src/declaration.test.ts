import { describe, expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import ts from 'typescript'
import { buildDeclaration } from './declaration'

const authoringSourcePath = 'apps/cv/src/cv-content/authoring/components.tsx'
const contentSourcePath = 'apps/cv/src/cv-content/schema/registry.ts'

const forbiddenPortablePatterns = [
  '@cv/',
  'effect/',
  'from "effect"',
  "from 'effect'",
  'node_modules',
  ...(process.env.HOME ? [process.env.HOME] : []),
]

const renderDeclaration = () =>
  Effect.runPromise(
    buildDeclaration({ authoringSourcePath, contentSourcePath }).pipe(
      Effect.provide(BunServices.layer)
    )
  )

const formatDiagnostic = (diagnostic: ts.Diagnostic) =>
  ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')

const assertPortableDeclaration = (source: string) => {
  const match = forbiddenPortablePatterns.find((pattern) =>
    source.includes(pattern)
  )

  if (match) {
    throw new Error(`Generated declarations are not portable: found ${match}`)
  }
}

const assertValidTypeScriptDeclaration = (source: string) => {
  const fileName = 'content-authoring.d.ts'
  const options: ts.CompilerOptions = {
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.Latest,
  }
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  const host = ts.createCompilerHost(options)
  const originalGetSourceFile = host.getSourceFile.bind(host)

  host.fileExists = (candidate) =>
    candidate === fileName || ts.sys.fileExists(candidate)
  host.readFile = (candidate) =>
    candidate === fileName ? source : ts.sys.readFile(candidate)
  host.getSourceFile = (candidate, languageVersion, onError) =>
    candidate === fileName
      ? sourceFile
      : originalGetSourceFile(candidate, languageVersion, onError)

  const program = ts.createProgram([fileName], options, host)
  const diagnostics = [
    ...program.getSyntacticDiagnostics(),
    ...program.getSemanticDiagnostics(),
  ]

  if (diagnostics.length > 0) {
    throw new Error(diagnostics.map(formatDiagnostic).join('\n'))
  }
}

const assertValidTypeScriptUsage = (
  declarationSource: string,
  usageSource: string
) => {
  const declarationFileName = 'content-authoring.d.ts'
  const usageFileName = 'content-usage.tsx'
  const options: ts.CompilerOptions = {
    jsx: ts.JsxEmit.ReactJSX,
    jsxImportSource: 'react',
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    noEmit: true,
    skipLibCheck: true,
    strict: true,
    target: ts.ScriptTarget.Latest,
  }
  const sourceFiles = new Map([
    [
      declarationFileName,
      ts.createSourceFile(
        declarationFileName,
        declarationSource,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS
      ),
    ],
    [
      usageFileName,
      ts.createSourceFile(
        usageFileName,
        usageSource,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      ),
    ],
  ])
  const host = ts.createCompilerHost(options)
  const originalGetSourceFile = host.getSourceFile.bind(host)

  host.fileExists = (candidate) =>
    sourceFiles.has(candidate) || ts.sys.fileExists(candidate)
  host.readFile = (candidate) => {
    const sourceFile = sourceFiles.get(candidate)

    return sourceFile?.text ?? ts.sys.readFile(candidate)
  }
  host.getSourceFile = (candidate, languageVersion, onError) =>
    sourceFiles.get(candidate) ??
    originalGetSourceFile(candidate, languageVersion, onError)

  const program = ts.createProgram(
    [declarationFileName, usageFileName],
    options,
    host
  )
  const diagnostics = [
    ...program.getSyntacticDiagnostics(),
    ...program.getSemanticDiagnostics(),
  ]

  if (diagnostics.length > 0) {
    throw new Error(diagnostics.map(formatDiagnostic).join('\n'))
  }
}

describe('content authoring declarations', () => {
  test('generate portable TypeScript declarations', async () => {
    const source = await renderDeclaration()

    expect(() => assertPortableDeclaration(source)).not.toThrow()
    expect(() => assertValidTypeScriptDeclaration(source)).not.toThrow()
  })

  test('include the authoring namespace and virtual module', async () => {
    const source = await renderDeclaration()

    expect(source).toContain('declare namespace ContentAuthoring')
    expect(source).toContain("declare module 'virtual:content'")
    expect(source).toContain('CvContent')
    expect(source).toContain('export type CvDocument = {')
    expect(source).toContain('export type ContentModules = {')
    expect(source).toContain('export type Module<Name extends keyof')
    expect(source).toContain('export type Entry<Name extends keyof')
    expect(source).toContain('export type MdxMeta<Name extends keyof')
    expect(source).toContain('export const Summary:')
    expect(source).toContain('export const variableLookup:')
    expect(source).toContain('export const redactedSection:')
    expect(source).toContain('export type ContentVariablesSource')
    expect(source).not.toContain('DocumentModule')
    expect(source).not.toContain('export type ProfileDocument')
    expect(source).not.toContain('ExperienceMdxMeta')
  })

  test('type structured redactions as data helpers instead of JSX', async () => {
    const source = await renderDeclaration()
    const usage = `
      import {
        VariableLookup,
        variableLookup,
        type MdxMeta,
        type Module,
      } from 'virtual:content'

      export const identity = {
        name: variableLookup({
          fallback: 'Name hidden',
          label: 'Name',
          variable: 'person.name',
        }),
      } satisfies Module<'identity'>

      export const meta = {
        company: variableLookup({
          fallback: 'Company hidden',
          variable: 'employer.current.company',
        }),
      } satisfies MdxMeta<'experience'>

      export const invalidIdentity = {
        // @ts-expect-error Structured content accepts descriptor data, not JSX elements.
        name: <VariableLookup fallback="Name hidden" variable="person.name" />,
      } satisfies Module<'identity'>
    `

    expect(() => assertValidTypeScriptUsage(source, usage)).not.toThrow()
  })
})
