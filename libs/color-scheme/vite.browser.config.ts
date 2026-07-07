import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

const browserScripts = {
  boot: {
    entry: 'src/browser/boot.ts',
    fileName: 'browser/boot.js',
    name: 'BrowserBoot',
  },
  runtime: {
    entry: 'src/browser/runtime.ts',
    fileName: 'browser/runtime.js',
    name: 'BrowserRuntime',
  },
} as const

export default defineConfig(({ mode }) => {
  const script = browserScripts[mode as keyof typeof browserScripts]

  if (!script) {
    throw new Error(`Unknown color-scheme browser script mode: ${mode}`)
  }

  return {
    build: {
      emptyOutDir: false,
      lib: {
        entry: resolve(projectRoot, script.entry),
        fileName: () => script.fileName,
        formats: ['iife'],
        name: script.name,
      },
      minify: true,
      outDir: resolve(projectRoot, 'dist'),
      sourcemap: false,
    },
    publicDir: false,
    root: projectRoot,
  }
})
