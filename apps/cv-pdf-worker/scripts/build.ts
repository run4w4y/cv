import { fileURLToPath } from 'node:url'

const result = await Bun.build({
  entrypoints: [fileURLToPath(new URL('../src/index.ts', import.meta.url))],
  external: ['cloudflare:workers'],
  outdir: fileURLToPath(new URL('../dist', import.meta.url)),
  target: 'browser',
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exitCode = 1
}
