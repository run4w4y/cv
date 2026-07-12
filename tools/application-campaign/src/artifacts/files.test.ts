import { describe, expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Deferred, Effect, Fiber } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'
import { systemError } from 'effect/PlatformError'
import { line, replaceManagedFilesAtomically } from './files'

describe('atomic managed campaign artifacts', () => {
  test('removes stale owned files and preserves unrelated files', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem
        const path = yield* Path
        const root = yield* fileSystem.makeTempDirectory()
        const outDir = path.join(root, 'application')

        yield* fileSystem.makeDirectory(outDir)
        yield* fileSystem.writeFileString(
          path.join(outDir, 'cover-letter.md'),
          'stale'
        )
        yield* fileSystem.writeFileString(
          path.join(outDir, 'notes.md'),
          'keep me'
        )
        yield* fileSystem.writeFileString(
          path.join(outDir, 'artifact-manifest.json'),
          line(
            JSON.stringify({
              files: ['application.json', 'cover-letter.md'],
              version: 1,
            })
          )
        )

        const manifest = {
          files: ['application.json'],
          version: 1,
        }
        yield* replaceManagedFilesAtomically({
          files: [
            { content: '{"status":"succeeded"}\n', path: 'application.json' },
            {
              content: line(JSON.stringify(manifest)),
              path: 'artifact-manifest.json',
            },
          ],
          knownManagedFiles: [
            'application.json',
            'cover-letter.md',
            'artifact-manifest.json',
          ],
          manifestFileName: 'artifact-manifest.json',
          outDir,
        })

        return {
          application: yield* fileSystem.readFileString(
            path.join(outDir, 'application.json')
          ),
          entries: yield* fileSystem.readDirectory(outDir),
          notes: yield* fileSystem.readFileString(
            path.join(outDir, 'notes.md')
          ),
          rootEntries: yield* fileSystem.readDirectory(root),
        }
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(result.application).toContain('succeeded')
    expect(result.entries).not.toContain('cover-letter.md')
    expect(result.entries).toContain('artifact-manifest.json')
    expect(result.notes).toBe('keep me')
    expect(result.rootEntries).toEqual(['application'])
  })

  test('restores the previous output when promotion is interrupted', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem
        const path = yield* Path
        const root = yield* fileSystem.makeTempDirectory()
        const outDir = path.join(root, 'application')
        const manifestFileName = 'artifact-manifest.json'

        yield* fileSystem.makeDirectory(outDir)
        yield* fileSystem.writeFileString(
          path.join(outDir, 'application.json'),
          'old application'
        )
        yield* fileSystem.writeFileString(
          path.join(outDir, manifestFileName),
          line(JSON.stringify({ files: ['application.json'], version: 1 }))
        )

        const promotionStarted = yield* Deferred.make<void>()
        const interruptibleFileSystem = {
          ...fileSystem,
          rename: (oldPath: string, newPath: string) =>
            newPath === outDir && !oldPath.endsWith('.previous')
              ? Deferred.succeed(promotionStarted, undefined).pipe(
                  Effect.andThen(Effect.never)
                )
              : fileSystem.rename(oldPath, newPath),
        } satisfies FileSystem
        const replacement = replaceManagedFilesAtomically({
          files: [
            { content: 'new application', path: 'application.json' },
            {
              content: line(
                JSON.stringify({ files: ['application.json'], version: 1 })
              ),
              path: manifestFileName,
            },
          ],
          knownManagedFiles: ['application.json', manifestFileName],
          manifestFileName,
          outDir,
        }).pipe(Effect.provideService(FileSystem, interruptibleFileSystem))
        const fiber = yield* Effect.forkChild(replacement)

        yield* Deferred.await(promotionStarted)
        const missingDuringPromotion = !(yield* fileSystem.exists(outDir))
        yield* Fiber.interrupt(fiber)

        return {
          application: yield* fileSystem.readFileString(
            path.join(outDir, 'application.json')
          ),
          missingDuringPromotion,
          outputExists: yield* fileSystem.exists(outDir),
          rootEntries: yield* fileSystem.readDirectory(root),
        }
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(result.missingDuringPromotion).toBe(true)
    expect(result.outputExists).toBe(true)
    expect(result.application).toBe('old application')
    expect(result.rootEntries).toEqual(['application'])
  })

  test('leaves the previous output intact when its manifest is malformed', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem
        const path = yield* Path
        const root = yield* fileSystem.makeTempDirectory()
        const outDir = path.join(root, 'application')
        const manifestFileName = 'artifact-manifest.json'

        yield* fileSystem.makeDirectory(outDir)
        yield* fileSystem.writeFileString(
          path.join(outDir, 'obsolete-plugin.md'),
          'stale but still owned'
        )
        yield* fileSystem.writeFileString(
          path.join(outDir, manifestFileName),
          '{not valid json'
        )

        const failure = yield* replaceManagedFilesAtomically({
          files: [
            { content: 'new application', path: 'application.json' },
            {
              content: line(
                JSON.stringify({ files: ['application.json'], version: 1 })
              ),
              path: manifestFileName,
            },
          ],
          knownManagedFiles: ['application.json', manifestFileName],
          manifestFileName,
          outDir,
        }).pipe(
          Effect.as(undefined),
          Effect.catch((error) => Effect.succeed(error))
        )

        return {
          failure,
          manifest: yield* fileSystem.readFileString(
            path.join(outDir, manifestFileName)
          ),
          newApplicationExists: yield* fileSystem.exists(
            path.join(outDir, 'application.json')
          ),
          stale: yield* fileSystem.readFileString(
            path.join(outDir, 'obsolete-plugin.md')
          ),
          rootEntries: yield* fileSystem.readDirectory(root),
        }
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(result.failure).toMatchObject({
      _tag: 'ApplicationCampaignFileSystemError',
      operation: 'parse artifact manifest',
    })
    expect(result.manifest).toBe('{not valid json')
    expect(result.newApplicationExists).toBe(false)
    expect(result.stale).toBe('stale but still owned')
    expect(result.rootEntries).toEqual(['application'])
  })

  test('leaves the previous output intact when its manifest cannot be read', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const fileSystem = yield* FileSystem
        const path = yield* Path
        const root = yield* fileSystem.makeTempDirectory()
        const outDir = path.join(root, 'application')
        const manifestFileName = 'artifact-manifest.json'

        yield* fileSystem.makeDirectory(outDir)
        yield* fileSystem.writeFileString(
          path.join(outDir, 'application.json'),
          'old application'
        )
        yield* fileSystem.writeFileString(
          path.join(outDir, manifestFileName),
          line(JSON.stringify({ files: ['application.json'], version: 1 }))
        )

        const unreadableManifestFileSystem = {
          ...fileSystem,
          readFileString: (filePath: string, encoding?: string) =>
            path.basename(filePath) === manifestFileName
              ? Effect.fail(
                  systemError({
                    _tag: 'PermissionDenied',
                    method: 'readFileString',
                    module: 'FileSystem',
                    pathOrDescriptor: filePath,
                  })
                )
              : fileSystem.readFileString(filePath, encoding),
        } satisfies FileSystem
        const failure = yield* replaceManagedFilesAtomically({
          files: [
            { content: 'new application', path: 'application.json' },
            {
              content: line(
                JSON.stringify({ files: ['application.json'], version: 1 })
              ),
              path: manifestFileName,
            },
          ],
          knownManagedFiles: ['application.json', manifestFileName],
          manifestFileName,
          outDir,
        }).pipe(
          Effect.provideService(FileSystem, unreadableManifestFileSystem),
          Effect.as(undefined),
          Effect.catch((error) => Effect.succeed(error))
        )

        return {
          application: yield* fileSystem.readFileString(
            path.join(outDir, 'application.json')
          ),
          failure,
          rootEntries: yield* fileSystem.readDirectory(root),
        }
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(result.failure).toMatchObject({
      _tag: 'ApplicationCampaignFileSystemError',
      operation: 'read artifact manifest',
    })
    expect(result.application).toBe('old application')
    expect(result.rootEntries).toEqual(['application'])
  })
})
