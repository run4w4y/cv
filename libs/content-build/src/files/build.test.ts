import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  bytesToUtf8,
  createContentEncryptionKey,
  decryptPrivateFilePayload,
  runPrivateCryptoPromise,
  WebCryptoApiLayer,
} from '@cv/private-content-crypto'
import { runtimeProfileFileAad } from '@cv/private-content-protocol'
import { BunServices } from '@effect/platform-bun'
import { Effect, Layer } from 'effect'
import { mangleProfileId } from '../ids'
import { planContentFiles, writeContentFiles } from './build'
import { discoverContentFileProfiles } from './discovery'

const testLayer = Layer.merge(BunServices.layer, WebCryptoApiLayer)
const privateFileKey = Effect.runSync(
  createContentEncryptionKey(
    Uint8Array.from({ length: 32 }, (_, index) => index)
  )
)

describe('content file artifact build', () => {
  test('plans public, shared private, and profile-local private files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cv-content-files-'))
    const publicPath = join(root, 'files/public/portfolio.pdf')
    const sharedResumePath = join(root, 'files/private/resume.pdf')
    const sharedThesisPath = join(root, 'files/private/thesis.pdf')
    const frontendResumePath = join(root, 'profiles/frontend/_files/resume.pdf')
    const goExtraPath = join(root, 'profiles/go-backend/_files/extra/only.pdf')

    await mkdir(join(root, 'files/public'), { recursive: true })
    await mkdir(join(root, 'files/private'), { recursive: true })
    await mkdir(join(root, 'profiles/frontend/_files'), { recursive: true })
    await mkdir(join(root, 'profiles/go-backend/_files/extra'), {
      recursive: true,
    })
    await writeFile(publicPath, 'public')
    await writeFile(sharedResumePath, 'shared resume')
    await writeFile(sharedThesisPath, 'shared thesis')
    await writeFile(frontendResumePath, 'frontend resume')
    await writeFile(goExtraPath, 'go extra')

    const plan = await Effect.runPromise(
      planContentFiles({
        contentIdSalt: 'salt',
        contentRoot: root,
        privateRuntimeInput: null,
        profiles: ['default', 'frontend', 'go-backend'],
      }).pipe(Effect.provide(testLayer))
    )

    expect(
      plan.files.map(({ profile, relativePath, scope, sourcePath }) => ({
        profile,
        relativePath,
        scope,
        sourcePath,
      }))
    ).toEqual([
      {
        profile: 'default',
        relativePath: 'resume.pdf',
        scope: 'private',
        sourcePath: sharedResumePath,
      },
      {
        profile: 'default',
        relativePath: 'thesis.pdf',
        scope: 'private',
        sourcePath: sharedThesisPath,
      },
      {
        profile: 'frontend',
        relativePath: 'resume.pdf',
        scope: 'private',
        sourcePath: frontendResumePath,
      },
      {
        profile: 'frontend',
        relativePath: 'thesis.pdf',
        scope: 'private',
        sourcePath: sharedThesisPath,
      },
      {
        profile: 'go-backend',
        relativePath: 'extra/only.pdf',
        scope: 'private',
        sourcePath: goExtraPath,
      },
      {
        profile: 'go-backend',
        relativePath: 'resume.pdf',
        scope: 'private',
        sourcePath: sharedResumePath,
      },
      {
        profile: 'go-backend',
        relativePath: 'thesis.pdf',
        scope: 'private',
        sourcePath: sharedThesisPath,
      },
      {
        profile: undefined,
        relativePath: 'portfolio.pdf',
        scope: 'public',
        sourcePath: publicPath,
      },
    ])
  })

  test('infers private file profiles from shared and profile-local files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cv-content-files-'))

    await mkdir(join(root, 'files/private'), { recursive: true })
    await mkdir(join(root, 'profiles/frontend/_files'), { recursive: true })
    await writeFile(join(root, 'files/private/thesis.pdf'), 'shared thesis')
    await writeFile(join(root, 'profiles/frontend/_files/resume.pdf'), 'resume')

    const profiles = await Effect.runPromise(
      discoverContentFileProfiles(root, [
        'default',
        'frontend',
        'rust-backend',
      ]).pipe(Effect.provide(testLayer))
    )

    expect(profiles).toEqual(['default', 'frontend', 'rust-backend'])
  })

  test('infers private file profiles from profile-local files alone', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cv-content-files-'))

    await mkdir(join(root, 'profiles/frontend/_files'), { recursive: true })
    await writeFile(join(root, 'profiles/frontend/_files/resume.pdf'), 'resume')

    const profiles = await Effect.runPromise(
      discoverContentFileProfiles(root, [
        'default',
        'frontend',
        'rust-backend',
      ]).pipe(Effect.provide(testLayer))
    )

    expect(profiles).toEqual(['frontend'])
  })

  test('rejects generated output directories outside the allowed root', async () => {
    const result = await Effect.runPromiseExit(
      writeContentFiles({
        contentIdSalt: 'salt',
        files: [],
        outputRootDir: '/app/public',
        privateFilesDir: '/app/public/_content/files',
        privateRuntimeInput: null,
        publicFilesDir: '/tmp/public-files',
      }).pipe(Effect.provide(testLayer))
    )

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain('publicFilesDir must be inside')
  })

  test('rejects overlapping generated output directories', async () => {
    const result = await Effect.runPromiseExit(
      writeContentFiles({
        contentIdSalt: 'salt',
        files: [],
        outputRootDir: '/app/dist',
        privateFilesDir: '/app/dist/files/private',
        privateRuntimeInput: null,
        publicFilesDir: '/app/dist/files',
      }).pipe(Effect.provide(testLayer))
    )

    expect(result._tag).toBe('Failure')
    expect(result.toString()).toContain(
      'privateFilesDir and publicFilesDir must not overlap'
    )
  })

  test('writes private files as AES-GCM PCF2 payloads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cv-content-files-'))
    const sourceDir = join(root, 'source')
    const outputRootDir = join(root, 'dist')
    const relativePath = 'resume/private.pdf'
    const profile = 'hiring'
    const profileId = mangleProfileId(profile, 'salt')
    const sourcePath = join(sourceDir, relativePath)

    await mkdir(join(sourceDir, 'resume'), { recursive: true })
    await writeFile(sourcePath, 'private file')

    await Effect.runPromise(
      writeContentFiles({
        contentIdSalt: 'salt',
        files: [
          {
            profile,
            relativePath,
            scope: 'private',
            sourcePath,
          },
        ],
        outputRootDir,
        privateFilesDir: join(outputRootDir, '_content/files'),
        privateRuntimeInput: {
          profiles: [
            {
              content: {},
              contentKey: privateFileKey,
              id: profileId,
              locale: 'en',
              profile,
              variables: [],
            },
          ],
        },
        publicFilesDir: join(outputRootDir, 'files'),
      }).pipe(Effect.provide(testLayer))
    )

    const encrypted = new Uint8Array(
      await readFile(
        join(outputRootDir, '_content/files', profileId, relativePath)
      )
    )
    const decrypted = await runPrivateCryptoPromise(
      decryptPrivateFilePayload(
        privateFileKey,
        encrypted,
        runtimeProfileFileAad(profileId, relativePath)
      )
    )

    expect(bytesToUtf8(encrypted.slice(0, 4))).toBe('PCF2')
    expect(bytesToUtf8(decrypted)).toBe('private file')
  })
})
