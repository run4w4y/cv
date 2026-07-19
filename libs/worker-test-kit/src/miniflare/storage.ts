import type { D1Database } from '@cloudflare/workers-types'

export interface ResettableKVNamespace {
  readonly delete: (key: string) => Promise<void>
  readonly list: (options?: { readonly cursor?: string }) => Promise<{
    readonly cursor?: string
    readonly keys: readonly { readonly name: string }[]
    readonly list_complete: boolean
  }>
}

export interface ResettableR2Bucket {
  readonly delete: (keys: string | string[]) => Promise<void>
  readonly list: (options?: { readonly cursor?: string }) => Promise<{
    readonly cursor?: string
    readonly objects: readonly { readonly key: string }[]
    readonly truncated: boolean
  }>
}

const quotedIdentifier = (identifier: string) =>
  `"${identifier.replaceAll('"', '""')}"`

export const resetD1Database = async (database: D1Database) => {
  const tableResult = await database
    .prepare(
      `select name from sqlite_master
       where type = 'table'
         and name not like 'sqlite_%'
         and substr(name, 1, 4) != '_cf_'
       order by name`
    )
    .all<{ readonly name: string }>()
  let remaining = tableResult.results.map(({ name }) => name)
  while (remaining.length > 0) {
    const blocked: string[] = []
    for (const tableName of remaining) {
      try {
        await database
          .prepare(`delete from ${quotedIdentifier(tableName)}`)
          .run()
      } catch (error) {
        if (
          error instanceof Error &&
          /FOREIGN KEY constraint failed/u.test(error.message)
        ) {
          blocked.push(tableName)
          continue
        }
        throw error
      }
    }
    if (blocked.length === remaining.length) {
      throw new Error(
        `D1 reset could not resolve foreign-key order for: ${blocked.join(', ')}.`
      )
    }
    remaining = blocked
  }
}

export const resetKVNamespace = async (namespace: ResettableKVNamespace) => {
  let cursor: string | undefined
  do {
    const page = await namespace.list({ cursor })
    await Promise.all(page.keys.map(({ name }) => namespace.delete(name)))
    cursor = page.list_complete ? undefined : page.cursor
  } while (cursor !== undefined)
}

export const resetR2Bucket = async (bucket: ResettableR2Bucket) => {
  let cursor: string | undefined
  do {
    const page = await bucket.list({ cursor })
    if (page.objects.length > 0) {
      await bucket.delete(page.objects.map(({ key }) => key))
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor !== undefined)
}
