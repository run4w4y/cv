import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { renderFactsAuthoringDeclarations } from '@cv/facts-authoring'
import { format } from 'prettier'

const outputArgument = () => {
  const index = process.argv.lastIndexOf('--out')
  const value = index === -1 ? undefined : process.argv[index + 1]
  if (!value) {
    throw new Error('Usage: facts-types --out <facts-authoring.d.ts>')
  }
  return resolve(value)
}

const outputPath = outputArgument()
await mkdir(dirname(outputPath), { recursive: true })
const source = await format(renderFactsAuthoringDeclarations(), {
  parser: 'typescript',
  printWidth: 80,
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
})
await writeFile(outputPath, source, 'utf8')
process.stdout.write(`Generated ${outputPath}\n`)
