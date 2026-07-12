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
    expect(applicationRegistryOpenApi.paths['/v1/captures']).toBeDefined()
  })
})
