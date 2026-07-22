import type {
  DesktopRegistryConfiguration,
  DesktopRegistryConfigureInput,
} from '@cv/application-registry-desktop-contract'
import { Context, Effect, Layer, Redacted, Schema } from 'effect'
import { FileSystem } from 'effect/FileSystem'
import { Path } from 'effect/Path'

export type RegistryCredentials = {
  readonly origin: string
  readonly token: Redacted.Redacted<string>
}

export type ActiveRegistryCredentials = RegistryCredentials & {
  readonly source: 'environment' | 'stored'
}

export class DesktopSettingsError extends Schema.TaggedErrorClass<DesktopSettingsError>()(
  'DesktopSettingsError',
  {
    cause: Schema.Defect(),
    code: Schema.Literals([
      'configuration_invalid',
      'encryption_unavailable',
      'settings_corrupt',
      'settings_io_failed',
    ]),
    message: Schema.String,
  }
) {}

export class ElectronSafeStorageError extends Schema.TaggedErrorClass<ElectronSafeStorageError>()(
  'ElectronSafeStorageError',
  {
    cause: Schema.Defect(),
    operation: Schema.Literals(['decrypt', 'encrypt', 'is-available']),
  }
) {}

export interface ElectronSafeStorageShape {
  readonly decrypt: (
    encrypted: Uint8Array
  ) => Effect.Effect<string, ElectronSafeStorageError>
  readonly encrypt: (
    plainText: string
  ) => Effect.Effect<Uint8Array, ElectronSafeStorageError>
  readonly isAvailable: Effect.Effect<boolean, ElectronSafeStorageError>
}

export class ElectronSafeStorage extends Context.Service<
  ElectronSafeStorage,
  ElectronSafeStorageShape
>()('cv-desktop/ElectronSafeStorage') {}

const StoredSettingsSchema = Schema.Struct({
  encrypted: Schema.Boolean,
  origin: Schema.String,
  token: Schema.String,
})

const normalizeOrigin = (raw: string) => {
  const url = new URL(raw.trim())
  if (
    url.protocol !== 'https:' &&
    !(
      url.protocol === 'http:' &&
      ['127.0.0.1', 'localhost'].includes(url.hostname)
    )
  ) {
    throw new Error(
      'Use an HTTPS Registry API URL (or localhost for development).'
    )
  }
  if (url.username || url.password) {
    throw new Error('The Registry API URL cannot contain credentials.')
  }
  url.pathname = '/'
  url.search = ''
  url.hash = ''
  return url.origin
}

const settingsError = (
  code: DesktopSettingsError['code'],
  message: string,
  cause: unknown
) => new DesktopSettingsError({ cause, code, message })

export interface DesktopSettingsShape {
  readonly read: Effect.Effect<
    ActiveRegistryCredentials | null,
    DesktopSettingsError
  >
  readonly resolveUpdate: (
    input: DesktopRegistryConfigureInput
  ) => Effect.Effect<RegistryCredentials, DesktopSettingsError>
  readonly status: Effect.Effect<
    DesktopRegistryConfiguration,
    DesktopSettingsError
  >
  readonly write: (
    credentials: RegistryCredentials
  ) => Effect.Effect<DesktopRegistryConfiguration, DesktopSettingsError>
}

export class DesktopSettings extends Context.Service<
  DesktopSettings,
  DesktopSettingsShape
>()('cv-desktop/DesktopSettings') {}

export const desktopSettingsLayer = (options: {
  readonly environment?: NodeJS.ProcessEnv
  readonly userDataPath: string
}) =>
  Layer.effect(
    DesktopSettings,
    Effect.gen(function* () {
      const fs = yield* FileSystem
      const path = yield* Path
      const encryption = yield* ElectronSafeStorage
      const settingsPath = path.join(
        options.userDataPath,
        'registry-settings.json'
      )
      const environment = options.environment ?? process.env

      const readEnvironment = Effect.try({
        try: () => {
          const origin = environment.REGISTRY_API_URL?.trim()
          const token = environment.REGISTRY_API_TOKEN?.trim()
          if ((origin && !token) || (!origin && token)) {
            throw new Error(
              'REGISTRY_API_URL and REGISTRY_API_TOKEN must be configured together.'
            )
          }
          return origin && token
            ? {
                origin: normalizeOrigin(origin),
                source: 'environment' as const,
                token: Redacted.make(token),
              }
            : null
        },
        catch: (cause) =>
          settingsError(
            'configuration_invalid',
            'The Registry environment configuration is invalid.',
            cause
          ),
      })

      const persistEncrypted = Effect.fn('DesktopSettings.persistEncrypted')(
        function* (credentials: {
          readonly origin: string
          readonly token: string
        }) {
          const available = yield* encryption.isAvailable.pipe(
            Effect.mapError((cause) =>
              settingsError(
                'encryption_unavailable',
                'Operating-system credential encryption could not be initialized.',
                cause
              )
            )
          )
          if (!available) {
            return yield* Effect.fail(
              settingsError(
                'encryption_unavailable',
                'Operating-system credential encryption is unavailable. The token was not saved.',
                new Error('Safe storage unavailable')
              )
            )
          }
          const encrypted = yield* encryption
            .encrypt(credentials.token)
            .pipe(
              Effect.mapError((cause) =>
                settingsError(
                  'encryption_unavailable',
                  'The Registry token could not be encrypted.',
                  cause
                )
              )
            )
          const temporary = yield* fs
            .makeTempFile({
              directory: options.userDataPath,
              prefix: '.registry-',
            })
            .pipe(
              Effect.mapError((cause) =>
                settingsError(
                  'settings_io_failed',
                  'The desktop Registry settings could not be written.',
                  cause
                )
              )
            )
          const source = `${JSON.stringify(
            {
              encrypted: true,
              origin: credentials.origin,
              token: Buffer.from(encrypted).toString('base64'),
            },
            null,
            2
          )}\n`
          yield* Effect.acquireUseRelease(
            Effect.succeed(temporary),
            (file) =>
              fs
                .writeFileString(file, source, { mode: 0o600 })
                .pipe(
                  Effect.andThen(fs.chmod(file, 0o600)),
                  Effect.andThen(fs.rename(file, settingsPath))
                ),
            (file) => fs.remove(file, { force: true }).pipe(Effect.ignore)
          ).pipe(
            Effect.mapError((cause) =>
              settingsError(
                'settings_io_failed',
                'The desktop Registry settings could not be written.',
                cause
              )
            )
          )
        }
      )

      const readStored = Effect.gen(function* () {
        const exists = yield* fs
          .exists(settingsPath)
          .pipe(
            Effect.mapError((cause) =>
              settingsError(
                'settings_io_failed',
                'The desktop Registry settings could not be inspected.',
                cause
              )
            )
          )
        if (!exists) return null
        const source = yield* fs
          .readFileString(settingsPath)
          .pipe(
            Effect.mapError((cause) =>
              settingsError(
                'settings_io_failed',
                'The desktop Registry settings could not be read.',
                cause
              )
            )
          )
        const json = yield* Effect.try({
          try: () => JSON.parse(source) as unknown,
          catch: (cause) =>
            settingsError(
              'settings_corrupt',
              'The desktop Registry settings file is not valid JSON.',
              cause
            ),
        })
        const stored = yield* Schema.decodeUnknownEffect(StoredSettingsSchema)(
          json
        ).pipe(
          Effect.mapError((cause) =>
            settingsError(
              'settings_corrupt',
              'The desktop Registry settings file is invalid.',
              cause
            )
          )
        )
        const buffer = Buffer.from(stored.token, 'base64')
        const token = yield* (
          stored.encrypted
            ? encryption.decrypt(buffer)
            : Effect.succeed(buffer.toString('utf8'))
        ).pipe(
          Effect.mapError((cause) =>
            settingsError(
              'settings_corrupt',
              'The desktop Registry token could not be decrypted.',
              cause
            )
          )
        )
        if (token.trim().length === 0) {
          return yield* Effect.fail(
            settingsError(
              'settings_corrupt',
              'The desktop Registry token is empty.',
              new Error('Empty token')
            )
          )
        }
        const credentials = yield* Effect.try({
          try: () => ({
            origin: normalizeOrigin(stored.origin),
            source: 'stored' as const,
            token: Redacted.make(token),
          }),
          catch: (cause) =>
            settingsError(
              'settings_corrupt',
              'The stored Registry origin is invalid.',
              cause
            ),
        })
        if (!stored.encrypted) {
          yield* persistEncrypted({ origin: credentials.origin, token })
        }
        return credentials
      })

      const read: Effect.Effect<
        ActiveRegistryCredentials | null,
        DesktopSettingsError
      > = readEnvironment.pipe(
        Effect.flatMap(
          (
            configured
          ): Effect.Effect<
            ActiveRegistryCredentials | null,
            DesktopSettingsError
          > => (configured === null ? readStored : Effect.succeed(configured))
        )
      )

      const status = read.pipe(
        Effect.map(
          (credentials): DesktopRegistryConfiguration =>
            credentials === null
              ? {
                  configured: false,
                  editable: true,
                  origin: null,
                  source: 'unconfigured',
                }
              : {
                  configured: true,
                  editable: credentials.source === 'stored',
                  origin: credentials.origin,
                  source: credentials.source,
                }
        )
      )

      const resolveUpdate = Effect.fn('DesktopSettings.resolveUpdate')(
        function* (input: DesktopRegistryConfigureInput) {
          const environmentCredentials = yield* readEnvironment
          if (environmentCredentials !== null) {
            return yield* Effect.fail(
              settingsError(
                'configuration_invalid',
                'This Registry connection is managed by REGISTRY_API_URL and REGISTRY_API_TOKEN. Update the environment and restart the desktop app.',
                new Error('Environment-managed configuration')
              )
            )
          }

          const origin = yield* Effect.try({
            try: () => normalizeOrigin(input.origin),
            catch: (cause) =>
              settingsError(
                'configuration_invalid',
                'The Registry connection details are invalid.',
                cause
              ),
          })
          const replacementToken = input.token?.trim() ?? ''
          if (replacementToken.length > 0) {
            return { origin, token: Redacted.make(replacementToken) }
          }

          const stored = yield* readStored
          if (stored === null) {
            return yield* Effect.fail(
              settingsError(
                'configuration_invalid',
                'The Registry machine token is required.',
                new Error('Missing token')
              )
            )
          }
          return { origin, token: stored.token }
        }
      )

      const write = Effect.fn('DesktopSettings.write')(function* (
        input: RegistryCredentials
      ) {
        const credentials = yield* Effect.try({
          try: () => ({
            origin: normalizeOrigin(input.origin),
            token: Redacted.value(input.token).trim(),
          }),
          catch: (cause) =>
            settingsError(
              'configuration_invalid',
              'The Registry connection details are invalid.',
              cause
            ),
        })
        if (credentials.token.length === 0) {
          return yield* Effect.fail(
            settingsError(
              'configuration_invalid',
              'The Registry machine token is required.',
              new Error('Empty token')
            )
          )
        }
        yield* persistEncrypted(credentials)
        return {
          configured: true,
          editable: true,
          origin: credentials.origin,
          source: 'stored' as const,
        }
      })

      return DesktopSettings.of({ read, resolveUpdate, status, write })
    })
  )
