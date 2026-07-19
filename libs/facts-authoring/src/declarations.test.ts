import { describe, expect, test } from 'bun:test'
import ts from 'typescript'

import { renderFactsAuthoringDeclarations } from './declarations'

describe('facts authoring declarations', () => {
  test('are portable and valid TypeScript', () => {
    const source = renderFactsAuthoringDeclarations()
    const fileName = 'facts-authoring.d.ts'
    const options: ts.CompilerOptions = {
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      noEmit: true,
      skipLibCheck: true,
      strict: true,
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
    const getSourceFile = host.getSourceFile.bind(host)
    host.fileExists = (candidate) =>
      candidate === fileName || ts.sys.fileExists(candidate)
    host.readFile = (candidate) =>
      candidate === fileName ? source : ts.sys.readFile(candidate)
    host.getSourceFile = (candidate, languageVersion, onError) =>
      candidate === fileName
        ? sourceFile
        : getSourceFile(candidate, languageVersion, onError)
    const program = ts.createProgram([fileName], options, host)
    const diagnostics = [
      ...program.getSyntacticDiagnostics(),
      ...program.getSemanticDiagnostics(),
    ]

    expect(diagnostics).toEqual([])
    expect(source).toContain("declare module 'virtual:facts'")
    expect(source).toContain('export type ExperienceSection')
    expect(source).toContain('export type ProjectEntry')
    expect(source).toContain('readonly guidance?: FactTailoringGuidance')
    expect(source).toContain('Readonly<Record<string, FactEvidence>>')
    expect(source).not.toContain('readonly id: string')
    expect(source).not.toContain('export type FactSection =')
    expect(source).not.toContain('readonly tags')
    expect(source).not.toContain('@cv/')
    expect(source).not.toContain('effect/')
  })
})
