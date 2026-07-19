import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Miniflare, type MiniflareOptions } from 'miniflare'

export const workerTestCompatibilityDate = '2026-06-22'

type PersistedStorage = 'd1' | 'kv' | 'r2'

export interface MiniflareTestEnvironmentOptions {
  readonly persist?: readonly PersistedStorage[]
  readonly temporaryDirectoryPrefix?: string
}

const withPersistence = (
  options: MiniflareOptions,
  persistPath: string | undefined,
  persistedStorage: readonly PersistedStorage[]
): MiniflareOptions => {
  if (persistPath === undefined) return options

  return {
    ...options,
    ...(persistedStorage.includes('d1') ? { d1Persist: persistPath } : {}),
    ...(persistedStorage.includes('kv') ? { kvPersist: persistPath } : {}),
    ...(persistedStorage.includes('r2') ? { r2Persist: persistPath } : {}),
  }
}

/** Owns one Miniflare process and any temporary persisted storage it uses. */
export class MiniflareTestEnvironment {
  readonly persistPath: string | undefined

  #miniflare: Miniflare | undefined
  readonly #options: MiniflareOptions
  readonly #persistedStorage: readonly PersistedStorage[]

  private constructor(
    options: MiniflareOptions,
    persistedStorage: readonly PersistedStorage[],
    persistPath: string | undefined
  ) {
    this.#options = options
    this.#persistedStorage = persistedStorage
    this.persistPath = persistPath
  }

  static async make(
    options: MiniflareOptions,
    environmentOptions: MiniflareTestEnvironmentOptions = {}
  ) {
    const persistedStorage = environmentOptions.persist ?? []
    const persistPath =
      persistedStorage.length === 0
        ? undefined
        : await mkdtemp(
            join(
              tmpdir(),
              environmentOptions.temporaryDirectoryPrefix ??
                'cv-miniflare-test-'
            )
          )
    const environment = new MiniflareTestEnvironment(
      options,
      persistedStorage,
      persistPath
    )

    try {
      await environment.#start()
      return environment
    } catch (error) {
      await environment.dispose()
      throw error
    }
  }

  get miniflare() {
    if (this.#miniflare === undefined) {
      throw new Error('The Miniflare test environment is not running.')
    }
    return this.#miniflare
  }

  async restart() {
    await this.#miniflare?.dispose()
    this.#miniflare = undefined
    await this.#start()
  }

  async dispose() {
    await this.#miniflare?.dispose()
    this.#miniflare = undefined
    if (this.persistPath !== undefined) {
      await rm(this.persistPath, { force: true, recursive: true })
    }
  }

  async #start() {
    const miniflare = new Miniflare(
      withPersistence(this.#options, this.persistPath, this.#persistedStorage)
    )
    this.#miniflare = miniflare
    await miniflare.ready
  }
}
