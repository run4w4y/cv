import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { writePrivateContentLink } from './write-link'

const link = {
  audience: 'Acme',
  audienceId: 'audience-id',
  locale: 'en',
  profile: 'frontend',
  profileId: 'profile-id',
  token: 'token',
  url: 'https://cv.example.test/en/a/audience-id/?p=token',
}

describe('private content link writer', () => {
  test('writes a minted URL relative to the requested root', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem
        const rootDir = yield* fileSystem.makeTempDirectory()
        const outputPath = yield* writePrivateContentLink({
          link,
          path: 'links/acme.txt',
          rootDir,
        })
        const contents = yield* fileSystem.readFileString(outputPath)

        yield* fileSystem.remove(rootDir, { recursive: true, force: true })

        return { contents, outputPath, rootDir }
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(result.outputPath).toBe(join(result.rootDir, 'links/acme.txt'))
    expect(result.contents).toBe(`${link.url}\n`)
  })
})
