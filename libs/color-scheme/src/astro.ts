import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptCache = new Map<string, string>()
const currentDir = dirname(fileURLToPath(import.meta.url))

const getBrowserScriptPaths = (name: string) => [
  resolve(currentDir, 'browser', `${name}.js`),
  resolve(currentDir, '../dist/browser', `${name}.js`),
]

const readBrowserScript = (name: string) => {
  const cachedScript = scriptCache.get(name)

  if (cachedScript) {
    return cachedScript
  }

  const scriptPath = getBrowserScriptPaths(name).find((path) =>
    existsSync(path)
  )

  if (!scriptPath) {
    throw new Error(`Missing compiled color-scheme browser script: ${name}`)
  }

  const script = readFileSync(scriptPath, 'utf8').trim()
  scriptCache.set(name, script)
  return script
}

export const createColorSchemeBootScript = () => readBrowserScript('boot')

export const createColorSchemeRuntimeScript = () => readBrowserScript('runtime')
