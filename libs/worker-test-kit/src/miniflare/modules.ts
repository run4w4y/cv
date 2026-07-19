import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ModuleDefinition } from 'miniflare'

const findModules = async (
  directory: string,
  extension: string
): Promise<readonly string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const paths = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name)
      return entry.isDirectory()
        ? findModules(path, extension)
        : Promise.resolve(entry.name.endsWith(extension) ? [path] : [])
    })
  )
  return paths.flat().sort()
}

export const loadEsModules = async (
  directory: string,
  options: {
    readonly entryFileName?: string
    readonly extension?: string
  } = {}
): Promise<readonly ModuleDefinition[]> => {
  const entryFileName = options.entryFileName ?? 'entry.mjs'
  const extension = options.extension ?? '.mjs'
  return Promise.all(
    [...(await findModules(directory, extension))]
      .sort((left, right) => {
        const leftMain = left.endsWith(`/${entryFileName}`) ? 0 : 1
        const rightMain = right.endsWith(`/${entryFileName}`) ? 0 : 1
        return leftMain - rightMain || left.localeCompare(right)
      })
      .map(async (path) => ({
        contents: await readFile(path, 'utf8'),
        path,
        type: 'ESModule' as const,
      }))
  )
}
