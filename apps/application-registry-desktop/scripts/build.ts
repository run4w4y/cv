import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import { Effect } from 'effect'
import { FileSystem } from 'effect/FileSystem'

import { desktopProduct } from '../desktop.config'

const projectRoot = dirname(
  fileURLToPath(new URL('../package.json', import.meta.url))
)
const workspaceRoot = dirname(dirname(projectRoot))
const distRoot = join(projectRoot, 'dist')

const run = (command: ReadonlyArray<string>, cwd = workspaceRoot) =>
  Effect.tryPromise({
    try: async () => {
      const process = Bun.spawn([...command], {
        cwd,
        stderr: 'inherit',
        stdin: 'inherit',
        stdout: 'inherit',
      })
      const exitCode = await process.exited
      if (exitCode !== 0) {
        throw new Error(`${command[0]} exited with ${exitCode}.`)
      }
    },
    catch: (cause) =>
      new Error(`Command failed: ${command.join(' ')}`, { cause }),
  })

const bundle = (
  entrypoint: string,
  outfile: string,
  format: 'cjs' | 'esm',
  external: ReadonlyArray<string>
) =>
  Effect.tryPromise({
    try: async () => {
      const result = await Bun.build({
        entrypoints: [entrypoint],
        external: [...external],
        format,
        naming: basename(outfile),
        outdir: dirname(outfile),
        sourcemap: 'none',
        target: 'node',
      })
      if (!result.success) {
        throw new AggregateError(result.logs, `Could not bundle ${entrypoint}.`)
      }
    },
    catch: (cause) => new Error(`Could not bundle ${entrypoint}.`, { cause }),
  })

const program = Effect.gen(function* () {
  const fs = yield* FileSystem
  yield* Effect.acquireUseRelease(
    fs.makeTempDirectory({
      directory: projectRoot,
      prefix: '.dist-',
    }),
    (staging) =>
      Effect.gen(function* () {
        const renderer = join(staging, 'renderer')
        yield* run([
          'bunx',
          'vite',
          'build',
          '--mode',
          'desktop',
          '--config',
          'apps/application-registry/vite.config.ts',
          '--outDir',
          renderer,
          '--emptyOutDir',
        ])
        yield* Effect.all(
          [
            bundle(
              join(projectRoot, 'src/main.ts'),
              join(staging, 'main.mjs'),
              'esm',
              ['electron', '@openai/codex-sdk']
            ),
            bundle(
              join(projectRoot, 'src/preload.ts'),
              join(staging, 'preload.cjs'),
              'cjs',
              ['electron']
            ),
          ],
          { concurrency: 2 }
        )
        yield* fs.writeFileString(
          join(staging, 'package.json'),
          `${JSON.stringify(
            {
              dependencies: { '@openai/codex-sdk': '0.144.4' },
              main: 'main.mjs',
              name: desktopProduct.packageName,
              productName: desktopProduct.name,
              type: 'module',
              version: desktopProduct.version,
            },
            null,
            2
          )}\n`
        )
        yield* fs.remove(distRoot, { force: true, recursive: true })
        yield* fs.rename(staging, distRoot)
      }),
    (staging) =>
      fs.remove(staging, { force: true, recursive: true }).pipe(Effect.ignore)
  )
}).pipe(Effect.provide(NodeFileSystem.layer))

Effect.runPromise(program).catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
