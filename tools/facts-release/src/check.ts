import { resolve } from 'node:path'
import { Effect } from 'effect'

import { compileFactsCheckout } from './source'

const argument = (name: string) => {
  const index = process.argv.lastIndexOf(name)
  return index === -1 ? undefined : process.argv[index + 1]
}

const contentRoot = resolve(
  argument('--content-root') ?? process.env.CONTENT_ROOT ?? '../cv-content'
)
const release = await Effect.runPromise(
  compileFactsCheckout(contentRoot, {
    compilerCommit: '0'.repeat(40),
    compilerRepository: 'run4w4y/cv',
    sourceCommit: '0'.repeat(40),
    sourceRepository: 'run4w4y/cv-content',
  })
)

process.stdout.write(
  `Validated ${release.catalogues.map(({ locale }) => locale).join(', ')} facts (${release.catalogues[0]?.sections.length ?? 0} sections).\n`
)
