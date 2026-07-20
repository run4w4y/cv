import { parseArgs } from 'node:util'
import { BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import { Path } from 'effect/Path'

import { compileFactsCheckout } from './source'

const { values } = parseArgs({
  args: process.argv.slice(2),
  options: { 'content-root': { type: 'string' } },
  strict: true,
})

const program = Effect.gen(function* () {
  const path = yield* Path
  const contentRoot = path.resolve(
    values['content-root'] ?? process.env.CONTENT_ROOT ?? '../cv-content'
  )
  return yield* compileFactsCheckout(contentRoot, {
    compilerCommit: '0'.repeat(40),
    compilerRepository: 'run4w4y/cv',
    sourceCommit: '0'.repeat(40),
    sourceRepository: 'run4w4y/cv-content',
  })
})

const release = await Effect.runPromise(
  program.pipe(Effect.provide(BunServices.layer))
)

process.stdout.write(
  `Validated ${release.catalogues.map(({ locale }) => locale).join(', ')} facts (${release.catalogues[0]?.sections.length ?? 0} sections).\n`
)
