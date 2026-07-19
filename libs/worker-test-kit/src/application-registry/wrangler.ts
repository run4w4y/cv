import { readFile } from 'node:fs/promises'
import { parse } from 'jsonc-parser'

import { workerTestCompatibilityDate } from '../miniflare'
import {
  applicationRegistryBindings,
  applicationRegistryVariables,
} from './bindings'

type UnknownRecord = Readonly<Record<string, unknown>>

const asRecord = (value: unknown, label: string): UnknownRecord => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
  return value as UnknownRecord
}

const bindingNames = (value: unknown, label: string) => {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`)
  return value.map((entry) => {
    const binding = asRecord(entry, `${label} entry`).binding
    if (typeof binding !== 'string') {
      throw new Error(`${label} entry binding must be a string.`)
    }
    return binding
  })
}

const assertIncludes = (
  actual: readonly string[],
  expected: string,
  label: string
) => {
  if (!actual.includes(expected)) {
    throw new Error(`${label} is missing ${expected}.`)
  }
}

/** Fails when the registry test profile drifts from its Wrangler bindings. */
export const assertApplicationRegistryWranglerParity = async (
  configPath: string
) => {
  const config = asRecord(
    parse(await readFile(configPath, 'utf8')),
    'Wrangler configuration'
  )
  if (config.compatibility_date !== workerTestCompatibilityDate) {
    throw new Error(
      `Wrangler compatibility date ${String(config.compatibility_date)} does not match ${workerTestCompatibilityDate}.`
    )
  }

  assertIncludes(
    bindingNames(config.d1_databases, 'D1 bindings'),
    applicationRegistryBindings.database,
    'D1 bindings'
  )
  assertIncludes(
    bindingNames(config.kv_namespaces, 'KV bindings'),
    applicationRegistryBindings.sessions,
    'KV bindings'
  )
  assertIncludes(
    bindingNames(config.r2_buckets, 'R2 bindings'),
    applicationRegistryBindings.objects,
    'R2 bindings'
  )

  const variables = asRecord(config.vars, 'Wrangler variables')
  for (const variable of Object.values(applicationRegistryVariables)) {
    if (!(variable in variables)) {
      throw new Error(`Wrangler variables are missing ${variable}.`)
    }
  }
}
