import { describe, expect, test } from 'bun:test'
import { Option, Schema } from 'effect'
import {
  AddApplicationNoteCommandSchema,
  AppendApplicationEventCommandSchema,
  ListApplicationsQuerySchema as CommandListApplicationsQuerySchema,
  ListEventsQuerySchema as CommandListEventsQuerySchema,
  CreateCampaignCaptureCommandSchema,
  PatchApplicationCommandSchema,
  RegistryApplicationInputSchema,
} from './commands'
import { applicationRegistryOpenApi } from './openapi'
import {
  AddApplicationNoteRequestSchema,
  AppendApplicationEventRequestSchema,
  CreateCampaignCaptureRequestSchema,
  ListApplicationsQuerySchema,
  ListApplicationsResponseSchema,
  ListEventsQuerySchema,
  PatchApplicationRequestSchema,
  UpsertApplicationRequestSchema,
} from './schemas'

describe('application registry HTTP contract', () => {
  test('reuses the canonical request schemas by identity', () => {
    expect(UpsertApplicationRequestSchema).toBe(RegistryApplicationInputSchema)
    expect(PatchApplicationRequestSchema).toBe(PatchApplicationCommandSchema)
    expect(AddApplicationNoteRequestSchema).toBe(
      AddApplicationNoteCommandSchema
    )
    expect(AppendApplicationEventRequestSchema).toBe(
      AppendApplicationEventCommandSchema
    )
    expect(CreateCampaignCaptureRequestSchema).toBe(
      CreateCampaignCaptureCommandSchema
    )
    expect(ListApplicationsQuerySchema).toBe(CommandListApplicationsQuerySchema)
    expect(ListEventsQuerySchema).toBe(CommandListEventsQuerySchema)
  })

  test('distinguishes page continuation from the synchronization checkpoint', () => {
    const page = Schema.decodeUnknownSync(ListApplicationsResponseSchema)({
      checkpoint: 'revision:42',
      items: [],
      nextCursor: null,
    })

    expect(page.checkpoint).toBe('revision:42')
    expect(page.nextCursor).toBeNull()
  })

  test('accepts single and repeated dashboard query filters', () => {
    const single = Schema.decodeUnknownSync(ListApplicationsQuerySchema)({
      applicationStatus: 'applied',
      currency: 'USD',
      followUpState: 'overdue',
      limit: '100',
    })
    const repeated = Schema.decodeUnknownSync(ListApplicationsQuerySchema)({
      applicationStatus: ['applied', 'technical_screen'],
      fitScoreMax: '100',
      fitScoreMin: '80',
      personalPriority: ['high', 'medium'],
      targetStage: ['apply_next', 'verify_first'],
    })
    const blankFitRange = Schema.decodeUnknownSync(ListApplicationsQuerySchema)(
      {
        fitScoreMax: '',
        fitScoreMin: '',
      }
    )
    const events = Schema.decodeUnknownSync(ListEventsQuerySchema)({
      from: '2026-07-01T00:00:00.000Z',
      kind: ['stage_changed', 'research_updated'],
      to: '2026-07-31T23:59:59.999Z',
    })
    expect(single.applicationStatus).toBe('applied')
    expect(single.currency).toBe('USD')
    expect(single.limit).toBe(100)
    expect(repeated.applicationStatus).toEqual(['applied', 'technical_screen'])
    expect(repeated.fitScoreMax).toBe(100)
    expect(repeated.fitScoreMin).toBe(80)
    expect(blankFitRange.fitScoreMax).toBeUndefined()
    expect(blankFitRange.fitScoreMin).toBeUndefined()
    expect(events.kind).toEqual(['stage_changed', 'research_updated'])
    expect(
      Option.isNone(
        Schema.decodeUnknownOption(ListApplicationsQuerySchema)({
          limit: '101',
        })
      )
    ).toBe(true)
    expect(
      Option.isNone(
        Schema.decodeUnknownOption(ListApplicationsQuerySchema)({
          currency: 'usd',
        })
      )
    ).toBe(true)
    expect(
      Option.isNone(
        Schema.decodeUnknownOption(ListApplicationsQuerySchema)({
          limit: 'all',
        })
      )
    ).toBe(true)
    for (const invalidFitRange of [
      { fitScoreMin: '-1' },
      { fitScoreMax: '101' },
      { fitScoreMin: '91.5' },
      { fitScoreMax: '80', fitScoreMin: '90' },
    ]) {
      expect(
        Option.isNone(
          Schema.decodeUnknownOption(ListApplicationsQuerySchema)(
            invalidFitRange
          )
        )
      ).toBe(true)
    }
  })

  test('requires lifecycle status changes to be explicit', () => {
    const base = {
      deviceId: null,
      expectedVersion: null,
      kind: 'stage_changed',
      occurredAt: '2026-07-12T00:00:00.000Z',
      operationId: 'operation-1',
      payload: {},
    } as const

    expect(
      Option.isNone(
        Schema.decodeUnknownOption(AppendApplicationEventCommandSchema)(base)
      )
    ).toBe(true)
    expect(
      Option.isSome(
        Schema.decodeUnknownOption(AppendApplicationEventCommandSchema)({
          ...base,
          nextApplicationStatus: 'technical_screen',
        })
      )
    ).toBe(true)
  })

  test('exports OpenAPI from the same HttpApi declaration', () => {
    expect(applicationRegistryOpenApi.openapi).toBe('3.1.0')
    expect(applicationRegistryOpenApi.paths['/v1/applications']).toBeDefined()
    expect(
      applicationRegistryOpenApi.paths['/v1/applications/facets']
    ).toBeDefined()
    expect(applicationRegistryOpenApi.paths['/v1/captures']).toBeDefined()
  })
})
