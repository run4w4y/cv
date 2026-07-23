import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem'
import * as NodePath from '@effect/platform-node/NodePath'
import { Effect, Layer, Redacted } from 'effect'

import {
  DesktopSettings,
  desktopSettingsLayer,
  ElectronSafeStorage,
} from './settings'

const directories: Array<string> = []

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  )
})

const makeLayer = async (
  encryptionAvailable = true,
  onDecrypt: () => void = () => undefined
) => {
  const directory = await mkdtemp(join(tmpdir(), 'cv-desktop-settings-'))
  directories.push(directory)
  const encryption = Layer.succeed(
    ElectronSafeStorage,
    ElectronSafeStorage.of({
      decrypt: (bytes) =>
        Effect.sync(() => {
          onDecrypt()
          return Buffer.from(bytes)
            .toString('utf8')
            .replace(/^encrypted:/u, '')
        }),
      encrypt: (value) => Effect.succeed(Buffer.from(`encrypted:${value}`)),
      isAvailable: Effect.succeed(encryptionAvailable),
    })
  )
  return {
    directory,
    layer: desktopSettingsLayer({
      environment: {},
      userDataPath: directory,
    }).pipe(
      Layer.provide(
        Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, encryption)
      )
    ),
  }
}

describe('desktop registry settings', () => {
  test('atomically stores and decrypts the registry token', async () => {
    const { layer } = await makeLayer()
    const result = await Effect.gen(function* () {
      const settings = yield* DesktopSettings
      const credentials = yield* settings.resolveUpdate({
        origin: 'https://registry.example.test/path?ignored=true',
        token: 'machine-token',
      })
      yield* settings.write(credentials)
      return yield* settings.status
    }).pipe(Effect.provide(layer), Effect.runPromise)

    expect(result).toEqual({
      configured: true,
      editable: true,
      origin: 'https://registry.example.test',
      source: 'stored',
    })
  })

  test('refuses to save plaintext when OS encryption is unavailable', async () => {
    const { layer } = await makeLayer(false)
    const error = await Effect.gen(function* () {
      const settings = yield* DesktopSettings
      const credentials = yield* settings.resolveUpdate({
        origin: 'https://registry.example.test',
        token: 'machine-token',
      })
      return yield* settings.write(credentials)
    }).pipe(Effect.provide(layer), Effect.flip, Effect.runPromise)

    expect(error).toMatchObject({ code: 'encryption_unavailable' })
  })

  test('reports corrupt settings instead of pretending setup is empty', async () => {
    const { directory, layer } = await makeLayer()
    await writeFile(
      join(directory, 'registry-settings.json'),
      '{broken',
      'utf8'
    )
    const error = await Effect.gen(function* () {
      const settings = yield* DesktopSettings
      return yield* settings.read
    }).pipe(Effect.provide(layer), Effect.flip, Effect.runPromise)

    expect(error).toMatchObject({ code: 'settings_corrupt' })
  })

  test('repairs corrupt settings when replacement credentials are supplied', async () => {
    const { directory, layer } = await makeLayer()
    await writeFile(
      join(directory, 'registry-settings.json'),
      '{broken',
      'utf8'
    )

    const result = await Effect.gen(function* () {
      const settings = yield* DesktopSettings
      yield* settings.read.pipe(Effect.flip)
      const replacement = yield* settings.resolveUpdate({
        origin: 'https://replacement.example.test/path',
        token: 'replacement-token',
      })
      yield* settings.write(replacement)
      return yield* settings.read
    }).pipe(Effect.provide(layer), Effect.runPromise)

    expect(result?.origin).toBe('https://replacement.example.test')
    expect(result === null ? null : Redacted.value(result.token)).toBe(
      'replacement-token'
    )
  })

  test('caches decrypted credentials until a successful write invalidates them', async () => {
    let decryptions = 0
    const { directory, layer } = await makeLayer(true, () => {
      decryptions += 1
    })
    await writeFile(
      join(directory, 'registry-settings.json'),
      JSON.stringify({
        encrypted: true,
        origin: 'https://registry.example.test',
        token: Buffer.from('encrypted:initial-token').toString('base64'),
      }),
      'utf8'
    )

    const result = await Effect.gen(function* () {
      const settings = yield* DesktopSettings
      yield* settings.read
      yield* settings.status
      yield* settings.read
      const replacement = yield* settings.resolveUpdate({
        origin: 'https://replacement.example.test',
        token: 'replacement-token',
      })
      yield* settings.write(replacement)
      return yield* settings.read
    }).pipe(Effect.provide(layer), Effect.runPromise)

    expect(decryptions).toBe(2)
    expect(result?.origin).toBe('https://replacement.example.test')
    expect(result === null ? null : Redacted.value(result.token)).toBe(
      'replacement-token'
    )
  })

  test('migrates a legacy plaintext token to OS-encrypted storage', async () => {
    const { directory, layer } = await makeLayer()
    const settingsPath = join(directory, 'registry-settings.json')
    await writeFile(
      settingsPath,
      JSON.stringify({
        encrypted: false,
        origin: 'https://registry.example.test',
        token: Buffer.from('legacy-token').toString('base64'),
      }),
      'utf8'
    )

    const credentials = await Effect.gen(function* () {
      const settings = yield* DesktopSettings
      return yield* settings.read
    }).pipe(Effect.provide(layer), Effect.runPromise)
    const stored = JSON.parse(await readFile(settingsPath, 'utf8')) as {
      readonly encrypted: boolean
      readonly token: string
    }

    expect(
      credentials === null ? null : Redacted.value(credentials.token)
    ).toBe('legacy-token')
    expect(stored.encrypted).toBe(true)
    expect(Buffer.from(stored.token, 'base64').toString('utf8')).toBe(
      'encrypted:legacy-token'
    )
  })

  test('keeps the encrypted token when only the origin changes', async () => {
    const { layer } = await makeLayer()
    const result = await Effect.gen(function* () {
      const settings = yield* DesktopSettings
      const initial = yield* settings.resolveUpdate({
        origin: 'https://registry-one.example.test',
        token: 'machine-token',
      })
      yield* settings.write(initial)

      const update = yield* settings.resolveUpdate({
        origin: 'https://registry-two.example.test',
      })
      yield* settings.write(update)
      return yield* settings.read
    }).pipe(Effect.provide(layer), Effect.runPromise)

    expect(result).not.toBeNull()
    expect(result?.origin).toBe('https://registry-two.example.test')
    expect(result?.source).toBe('stored')
    expect(result === null ? null : Redacted.value(result.token)).toBe(
      'machine-token'
    )
  })

  test('reports environment-managed settings as non-editable', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cv-desktop-settings-'))
    directories.push(directory)
    const encryption = Layer.succeed(
      ElectronSafeStorage,
      ElectronSafeStorage.of({
        decrypt: (bytes) => Effect.succeed(Buffer.from(bytes).toString('utf8')),
        encrypt: (value) => Effect.succeed(Buffer.from(value)),
        isAvailable: Effect.succeed(true),
      })
    )
    const layer = desktopSettingsLayer({
      environment: {
        REGISTRY_API_TOKEN: 'environment-token',
        REGISTRY_API_URL: 'https://registry.example.test',
      },
      userDataPath: directory,
    }).pipe(
      Layer.provide(
        Layer.mergeAll(NodeFileSystem.layer, NodePath.layer, encryption)
      )
    )

    const result = await Effect.gen(function* () {
      const settings = yield* DesktopSettings
      const status = yield* settings.status
      const error = yield* settings
        .resolveUpdate({
          origin: 'https://replacement.example.test',
          token: 'replacement-token',
        })
        .pipe(Effect.flip)
      return { error, status }
    }).pipe(Effect.provide(layer), Effect.runPromise)

    expect(result.status).toEqual({
      configured: true,
      editable: false,
      origin: 'https://registry.example.test',
      source: 'environment',
    })
    expect(result.error).toMatchObject({ code: 'configuration_invalid' })
  })
})
