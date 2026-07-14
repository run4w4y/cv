import { describe, expect, test } from 'bun:test'
import { CurrencyCodeSchema } from '@cv/application-registry-entity'
import { Schema } from 'effect'
import { ApplicationRegistryAnalysisSchema } from '../cli/plugins/application-registry/analysis'
import { makeCampaignJobAnalysisSchema } from './schema'
import { makeCodexStructuredOutput } from './structured'

describe('Codex structured output schema', () => {
  test('adapts the combined registry analysis schema to OpenAI constraints', () => {
    const schema = makeCampaignJobAnalysisSchema({
      'application-registry': ApplicationRegistryAnalysisSchema,
    })
    const { jsonSchema } = makeCodexStructuredOutput(schema)
    const serialized = JSON.stringify(jsonSchema)

    expect(serialized).not.toContain('"allOf"')
    expect(serialized).toContain('"pattern":"^[A-Z]{3}$"')
  })

  test('keeps Effect validation on the adapted response codec', () => {
    const { codec } = makeCodexStructuredOutput(CurrencyCodeSchema)
    const decode = Schema.decodeUnknownSync(Schema.fromJsonString(codec))

    expect(decode('"USD"')).toBe('USD')
    expect(() => decode('"usd"')).toThrow()
  })
})
