import { describe, expect, test } from 'bun:test'
import { Effect, Exit } from 'effect'

import {
  supportedD1MigrationHistory,
  supportedD1TableInventory,
  validateD1ColumnInventory,
  validateD1MigrationHistory,
  validateD1TableInventory,
} from './d1-source'
import { registryTables } from './manifest'

describe('D1 source contract', () => {
  test('accepts only the exact deployed migration history', async () => {
    const accepted = await Effect.runPromiseExit(
      validateD1MigrationHistory(supportedD1MigrationHistory)
    )
    expect(Exit.isSuccess(accepted)).toBe(true)

    const renamed = supportedD1MigrationHistory.map((migration) =>
      migration.id === 15
        ? { ...migration, name: 'unexpected/migration.sql' }
        : migration
    )
    const rejectedRename = await Effect.runPromiseExit(
      validateD1MigrationHistory(renamed)
    )
    expect(Exit.isFailure(rejectedRename)).toBe(true)

    const rejectedSixteenth = await Effect.runPromiseExit(
      validateD1MigrationHistory([
        ...supportedD1MigrationHistory,
        { id: 16, name: 'untracked/migration.sql' },
      ])
    )
    expect(Exit.isFailure(rejectedSixteenth)).toBe(true)
  })

  test('requires retired tables and rejects unknown source tables', async () => {
    const accepted = await Effect.runPromiseExit(
      validateD1TableInventory(supportedD1TableInventory)
    )
    expect(Exit.isSuccess(accepted)).toBe(true)

    const withoutRetiredRates = supportedD1TableInventory.filter(
      (table) => table !== 'fx_rates'
    )
    const rejectedMissingRates = await Effect.runPromiseExit(
      validateD1TableInventory(withoutRetiredRates)
    )
    expect(Exit.isFailure(rejectedMissingRates)).toBe(true)

    const withoutRetiredOutbox = supportedD1TableInventory.filter(
      (table) => table !== 'pdf_generation_outbox'
    )
    const rejectedMissingOutbox = await Effect.runPromiseExit(
      validateD1TableInventory(withoutRetiredOutbox)
    )
    expect(Exit.isFailure(rejectedMissingOutbox)).toBe(true)

    const rejectedUnknown = await Effect.runPromiseExit(
      validateD1TableInventory([
        ...supportedD1TableInventory,
        'unexpected_registry_data',
      ])
    )
    expect(Exit.isFailure(rejectedUnknown)).toBe(true)
  })

  test('requires the exact column inventory for every imported table', async () => {
    const applications = registryTables.find(
      ({ name }) => name === 'applications'
    )
    if (applications === undefined) {
      throw new Error('Expected the applications import manifest.')
    }

    const accepted = await Effect.runPromiseExit(
      validateD1ColumnInventory(applications, applications.columns)
    )
    expect(Exit.isSuccess(accepted)).toBe(true)

    const rejectedMissing = await Effect.runPromiseExit(
      validateD1ColumnInventory(applications, applications.columns.slice(1))
    )
    expect(Exit.isFailure(rejectedMissing)).toBe(true)

    const rejectedUnknown = await Effect.runPromiseExit(
      validateD1ColumnInventory(applications, [
        ...applications.columns,
        'untracked_payload',
      ])
    )
    expect(Exit.isFailure(rejectedUnknown)).toBe(true)
  })

  test('supplies only the new terminal-run columns as PostgreSQL defaults', async () => {
    const runs = registryTables.find(
      ({ name }) => name === 'listing_check_runs'
    )
    if (runs === undefined) {
      throw new Error('Expected the listing-check run import manifest.')
    }
    const defaults = Object.keys(
      'd1Defaults' in runs ? (runs.d1Defaults ?? {}) : {}
    )
    const sourceColumns = runs.columns.filter(
      (column) => !defaults.includes(column)
    )

    const accepted = await Effect.runPromiseExit(
      validateD1ColumnInventory(runs, sourceColumns)
    )
    const rejectedPostgresShape = await Effect.runPromiseExit(
      validateD1ColumnInventory(runs, runs.columns)
    )

    expect(defaults).toEqual(['failed_at', 'failure_code', 'failure_message'])
    expect(Exit.isSuccess(accepted)).toBe(true)
    expect(Exit.isFailure(rejectedPostgresShape)).toBe(true)
  })
})
