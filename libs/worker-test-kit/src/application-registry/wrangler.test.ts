import { test } from 'bun:test'
import { fileURLToPath } from 'node:url'

import { assertApplicationRegistryWranglerParity } from './wrangler'

test('keeps the registry test profile aligned with Wrangler', async () => {
  await assertApplicationRegistryWranglerParity(
    fileURLToPath(
      new URL(
        '../../../../apps/application-registry-api/wrangler.jsonc',
        import.meta.url
      )
    )
  )
})
