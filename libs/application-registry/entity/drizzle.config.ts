import { fileURLToPath } from 'node:url'
import { defineConfig } from 'drizzle-kit'

const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url))

export default defineConfig({
  dialect: 'sqlite',
  out: `${workspaceRoot}/libs/application-registry/entity/drizzle`,
  schema: `${workspaceRoot}/libs/application-registry/entity/src/tables/index.ts`,
})
