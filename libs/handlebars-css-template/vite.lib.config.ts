import { isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

const entries = {
  index: resolve(projectRoot, 'src/index.ts'),
  'plugin/index': resolve(projectRoot, 'src/plugin/index.ts'),
  'runtime/index': resolve(projectRoot, 'src/runtime/index.ts'),
}

const external = (id: string) =>
  id.startsWith('\0') || (!id.startsWith('.') && !isAbsolute(id))

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: entries,
      formats: ['es'],
    },
    outDir: resolve(projectRoot, 'dist'),
    rollupOptions: {
      external,
      output: {
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: '[name].js',
      },
    },
    sourcemap: true,
  },
  publicDir: false,
  root: projectRoot,
})
