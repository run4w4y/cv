import { describe, expect, test } from 'bun:test'
import { Schema } from 'effect'
import { workflowKey } from '../workflow/graph'
import {
  type CampaignAnalysisPromptContribution,
  defineCampaignAnalysisContribution,
} from './types'

const promptKey = workflowKey<CampaignAnalysisPromptContribution<string>>(
  'typed-contribution.prompt'
)
const stringResultKey = workflowKey<string>('typed-contribution.result')

describe('campaign analysis contribution registration', () => {
  test('keeps the prompt schema and result key on one value type', () => {
    const registration = defineCampaignAnalysisContribution({
      key: promptKey,
      name: 'typed-contribution',
      resultKey: stringResultKey,
      stepId: 'typed-contribution.prepare',
    })

    expect(registration.resultKey).toBe(stringResultKey)
  })
})

const assertContributionTypes = () => {
  const numberResultKey = workflowKey<number>('typed-contribution.number')

  defineCampaignAnalysisContribution({
    key: promptKey,
    name: 'invalid-contribution',
    // @ts-expect-error A string schema contribution cannot publish a number.
    resultKey: numberResultKey,
    stepId: 'invalid-contribution.prepare',
  })

  const invalidPrompt: CampaignAnalysisPromptContribution<string> = {
    instructions: 'Return text.',
    // @ts-expect-error The schema must decode the contribution value type.
    schema: Schema.Number,
  }
  void invalidPrompt
}

void assertContributionTypes
