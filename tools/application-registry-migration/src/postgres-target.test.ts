import { describe, expect, test } from 'bun:test'
import { Effect, Exit } from 'effect'

import {
  expectedTargetBaselineFingerprint,
  targetCatalogFingerprint,
  validateTargetBaselineFingerprint,
} from './postgres-target'

describe('PostgreSQL target contract', () => {
  test('catalog fingerprints are deterministic and order-independent', () => {
    expect(targetCatalogFingerprint(['table:b', 'table:a'])).toBe(
      targetCatalogFingerprint(['table:a', 'table:b'])
    )
    expect(targetCatalogFingerprint(['table:a'])).not.toBe(
      targetCatalogFingerprint(['table:b'])
    )
  })

  test('accepts only the pinned fresh-baseline fingerprint', async () => {
    expect(expectedTargetBaselineFingerprint).toMatch(/^[a-f0-9]{64}$/u)
    const accepted = await Effect.runPromiseExit(
      validateTargetBaselineFingerprint(expectedTargetBaselineFingerprint)
    )
    expect(Exit.isSuccess(accepted)).toBe(true)

    const rejected = await Effect.runPromiseExit(
      validateTargetBaselineFingerprint('0'.repeat(64))
    )
    expect(Exit.isFailure(rejected)).toBe(true)
  })
})
