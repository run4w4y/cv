import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

const workspaceRootCandidates = [
  process.cwd(),
  resolve(process.cwd(), '../..'),
] as const

export const workspaceRoot =
  workspaceRootCandidates.find((candidate) =>
    existsSync(resolve(candidate, 'nx.json'))
  ) ?? process.cwd()

export const workspacePackageDist = (name: string, ...segments: string[]) =>
  resolve(workspaceRoot, 'libs', name, 'dist', ...segments)

// The nested Vite server runs with configFile=false, so it does not inherit
// app aliases. Bun also does not materialize node_modules/@cv/* symlinks here.
export const workspaceAliases = [
  {
    find: /^@cv\/content-composer$/u,
    replacement: workspacePackageDist('content-composer', 'index.js'),
  },
  {
    find: /^@cv\/content-core$/u,
    replacement: workspacePackageDist('content-core', 'index.js'),
  },
  {
    find: /^@cv\/content-core\/schema$/u,
    replacement: workspacePackageDist('content-core', 'schema.js'),
  },
]
