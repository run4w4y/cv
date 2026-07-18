import { fileURLToPath } from 'node:url'

const fsPromisesStub = fileURLToPath(
  new URL('../src/pdf/fs-promises-unavailable.ts', import.meta.url)
)

const result = await Bun.build({
  entrypoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
  external: ['cloudflare:workers'],
  outdir: fileURLToPath(new URL('../dist', import.meta.url)),
  plugins: [
    {
      name: 'cloudflare-browser-no-node-fs',
      setup(build) {
        build.onResolve({ filter: /^fs\/promises$/u }, () => ({
          path: fsPromisesStub,
        }))
      },
    },
  ],
  target: 'browser',
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exitCode = 1
}
