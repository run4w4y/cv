import { describe, expect, test } from 'bun:test'
import { Option, Schema } from 'effect'
import { RegistryApi } from './api'
import { CvAnalyticsQuerySchema, CvAnalyticsResponseSchema } from './analytics'
import {
  AddApplicationNoteCommandSchema,
  AppendApplicationEventCommandSchema,
  DeleteApplicationQuerySchema as CommandDeleteApplicationQuerySchema,
  ListApplicationsQuerySchema as CommandListApplicationsQuerySchema,
  ListEventsQuerySchema as CommandListEventsQuerySchema,
  decodeListApplicationsSearchParams,
  decodeListEventsSearchParams,
  encodeListApplicationsSearchParams,
  encodeListEventsSearchParams,
  PatchApplicationCommandSchema,
  RegistryApplicationInputSchema,
  UpdateManagedApplicationCommandSchema,
} from './commands'
import { assertUniqueHttpApiEndpoints } from './endpoint-integrity'
import { applicationRegistryOpenApi } from './openapi'
import {
  AddApplicationNoteRequestSchema,
  AppendApplicationEventRequestSchema,
  CreateApplicationRequestSchema,
  DeleteApplicationQuerySchema,
  ListApplicationsQuerySchema,
  ListApplicationsResponseSchema,
  ListEventsQuerySchema,
  ListEventsResponseSchema,
  PatchApplicationRequestSchema,
  ReplaceAnnualCompensationRequestSchema,
  UpdateManagedApplicationRequestSchema,
  UpsertApplicationRequestSchema,
} from './schemas'

describe('application registry HTTP contract', () => {
  test('reuses the canonical request schemas by identity', () => {
    expect(UpsertApplicationRequestSchema).toBe(RegistryApplicationInputSchema)
    expect(CreateApplicationRequestSchema).toBe(RegistryApplicationInputSchema)
    expect(PatchApplicationRequestSchema).toBe(PatchApplicationCommandSchema)
    expect(UpdateManagedApplicationRequestSchema).toBe(
      UpdateManagedApplicationCommandSchema
    )
    expect(AddApplicationNoteRequestSchema).toBe(
      AddApplicationNoteCommandSchema
    )
    expect(AppendApplicationEventRequestSchema).toBe(
      AppendApplicationEventCommandSchema
    )
    expect(ListApplicationsQuerySchema).toBe(CommandListApplicationsQuerySchema)
    expect(ListEventsQuerySchema).toBe(CommandListEventsQuerySchema)
    expect(DeleteApplicationQuerySchema).toBe(
      CommandDeleteApplicationQuerySchema
    )
  })

  test('uses standard query pages for list responses', () => {
    const input = {
      items: [],
      pageInfo: {
        kind: 'cursor',
        size: 50,
        hasNextPage: false,
        hasPreviousPage: false,
        nextCursor: null,
      },
    } as const

    const applications = Schema.decodeUnknownSync(
      ListApplicationsResponseSchema
    )(input)
    const events = Schema.decodeUnknownSync(ListEventsResponseSchema)(input)

    expect(applications).toEqual(input)
    expect(events).toEqual(input)
  })

  test('accepts zero as an optimistic expected version', () => {
    const patch = Schema.decodeUnknownSync(PatchApplicationRequestSchema)({
      expectedVersion: 0,
    })
    const deletion = Schema.decodeUnknownSync(DeleteApplicationQuerySchema)({
      expectedVersion: '0',
    })

    expect(patch.expectedVersion).toBe(0)
    expect(deletion.expectedVersion).toBe(0)
  })

  test('requires managed update concurrency and operation identities', () => {
    expect(
      Option.isNone(
        Schema.decodeUnknownOption(UpdateManagedApplicationRequestSchema)({
          company: 'Example',
        })
      )
    ).toBe(true)
    expect(
      Schema.decodeUnknownSync(UpdateManagedApplicationRequestSchema)({
        company: 'Example',
        expectedVersion: 2,
        operationId: 'managed-update-1',
      })
    ).toEqual({
      company: 'Example',
      expectedVersion: 2,
      operationId: 'managed-update-1',
    })
    expect(
      Option.isNone(
        Schema.decodeUnknownOption(UpdateManagedApplicationRequestSchema)({
          annualCompensation: {
            currencyCode: 'USD',
            maximumMinor: 1,
            minimumMinor: 2,
          },
          expectedVersion: 2,
          operationId: 'managed-update-2',
        })
      )
    ).toBe(true)
    expect(
      Option.isNone(
        Schema.decodeUnknownOption(ReplaceAnnualCompensationRequestSchema)({
          annualCompensation: {
            currencyCode: 'USD',
            maximumMinor: 1,
            minimumMinor: 2,
          },
          expectedVersion: 2,
        })
      )
    ).toBe(true)
  })

  test('derives typed filters, ordering, and pagination from query definitions', () => {
    const applicationFilters = [
      {
        type: 'condition',
        field: 'applicationStatus',
        operator: 'in',
        value: ['applied', 'technical_screen'],
      },
      {
        type: 'group',
        combinator: 'or',
        children: [
          {
            type: 'condition',
            field: 'company',
            operator: 'contains',
            value: 'Acme',
          },
          {
            type: 'condition',
            field: 'q',
            operator: 'matches',
            value: 'effect engineer',
          },
        ],
      },
    ] as const
    const applications = Schema.decodeUnknownSync(ListApplicationsQuerySchema)({
      filters: JSON.stringify(applicationFilters),
      orderBy: JSON.stringify([
        { field: 'updatedRevision', direction: 'desc' },
      ]),
      currency: 'USD',
      q: 'platform systems',
      size: '100',
    })
    const events = Schema.decodeUnknownSync(ListEventsQuerySchema)({
      filters: JSON.stringify([
        {
          type: 'condition',
          field: 'occurredAt',
          operator: 'gte',
          value: '2026-07-01T00:00:00.000Z',
        },
        {
          type: 'condition',
          field: 'kind',
          operator: 'in',
          value: ['stage_changed', 'research_updated'],
        },
      ]),
    })

    expect(applications.filters).toEqual(applicationFilters)
    expect(applications.orderBy).toEqual([
      { field: 'updatedRevision', direction: 'desc' },
    ])
    expect(applications.pagination).toEqual({ size: 100 })
    expect(applications.currency).toBe('USD')
    expect(applications.q).toBe('platform systems')
    expect(events.filters).toHaveLength(2)

    expect(
      Option.isNone(
        Schema.decodeUnknownOption(ListApplicationsQuerySchema)({
          size: '101',
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
          size: 'all',
        })
      )
    ).toBe(true)
    expect(
      Option.isNone(
        Schema.decodeUnknownOption(ListApplicationsQuerySchema)({ q: '  ' })
      )
    ).toBe(true)
    for (const filters of [
      [{ type: 'condition', field: 'missing', operator: 'eq', value: 'x' }],
      [{ type: 'condition', field: 'fitScore', operator: 'gte', value: '90' }],
      [{ type: 'condition', field: 'q', operator: 'eq', value: 'x' }],
    ]) {
      expect(
        Option.isNone(
          Schema.decodeUnknownOption(ListApplicationsQuerySchema)({
            filters: JSON.stringify(filters),
          })
        )
      ).toBe(true)
    }
  })

  test('owns the exact application filter encoding used by browsers and transports', () => {
    const filters = [
      {
        type: 'group',
        combinator: 'and',
        children: [
          {
            type: 'condition',
            field: 'company',
            operator: 'contains',
            value: 'R&D / 東京',
          },
          {
            type: 'condition',
            field: 'applicationStatus',
            operator: 'in',
            value: ['applied', 'technical_screen'],
          },
          {
            type: 'group',
            combinator: 'or',
            children: [
              {
                type: 'condition',
                field: 'followUpAt',
                operator: 'isNull',
              },
              {
                type: 'condition',
                field: 'labels',
                operator: 'hasAny',
                value: ['C++', 'удалённая работа'],
              },
            ],
          },
        ],
      },
    ] as const
    const expectedFilters =
      '[{"type":"group","combinator":"and","children":[{"type":"condition","field":"company","operator":"contains","value":"R&D / 東京"},{"type":"condition","field":"applicationStatus","operator":"in","value":["applied","technical_screen"]},{"type":"group","combinator":"or","children":[{"type":"condition","field":"followUpAt","operator":"isNull"},{"type":"condition","field":"labels","operator":"hasAny","value":["C++","удалённая работа"]}]}]}]'
    const request = {
      filters,
      currency: 'original',
      q: 'platform systems',
    } as const

    const params = encodeListApplicationsSearchParams(request)

    expect(params.get('filters')).toBe(expectedFilters)
    expect(params.get('q')).toBe('platform systems')
    expect(expectedFilters).not.toContain('"field":"q"')
    expect(decodeListApplicationsSearchParams(params)).toEqual(request)
    expect(
      encodeListApplicationsSearchParams({ filters: [], orderBy: [] }).size
    ).toBe(0)
  })

  test('uses the same contract-owned codec for event filters', () => {
    const request = {
      filters: [
        {
          type: 'condition',
          field: 'kind',
          operator: 'in',
          value: ['stage_changed', 'research_updated'],
        },
      ],
    } as const

    const params = encodeListEventsSearchParams(request)

    expect(params.get('filters')).toBe(
      '[{"type":"condition","field":"kind","operator":"in","value":["stage_changed","research_updated"]}]'
    )
    expect(decodeListEventsSearchParams(params)).toEqual(request)
  })

  test('rejects malformed and duplicate canonical filter parameters', () => {
    const invalidInputs = [
      'filters=%7Bnot-json',
      `filters=${encodeURIComponent(JSON.stringify({ combinator: 'and' }))}`,
      `filters=${encodeURIComponent(
        JSON.stringify([
          {
            type: 'condition',
            field: 'applicationStatus',
            operator: 'in',
            value: ['not-a-status'],
          },
        ])
      )}`,
      new URLSearchParams([
        ['filters', '[]'],
        ['filters', '[]'],
      ]),
    ]

    for (const input of invalidInputs) {
      expect(() => decodeListApplicationsSearchParams(input)).toThrow()
    }
  })

  test('expresses revision scans through ordinary filters and ordering', () => {
    for (const [schema, orderingField] of [
      [ListApplicationsQuerySchema, 'updatedRevision'],
      [ListEventsQuerySchema, 'revision'],
    ] as const) {
      const decoded = Schema.decodeUnknownOption(schema)({
        filters: JSON.stringify([
          {
            type: 'condition',
            field: orderingField,
            operator: 'gt',
            value: 42,
          },
        ]),
        orderBy: JSON.stringify([{ field: orderingField, direction: 'asc' }]),
      })

      expect(Option.isSome(decoded)).toBe(true)
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

  test('limits CV analytics to the supported lookback windows', () => {
    expect(
      Schema.decodeUnknownSync(CvAnalyticsQuerySchema)({ days: '7' })
    ).toEqual({
      days: 7,
    })
    expect(
      Option.isNone(
        Schema.decodeUnknownOption(CvAnalyticsQuerySchema)({ days: '30' })
      )
    ).toBe(true)
    expect(
      Schema.decodeUnknownSync(CvAnalyticsResponseSchema)({
        countries: [],
        generatedAt: '2026-07-19T12:00:00.000Z',
        items: [],
        range: {
          from: '2026-07-12T12:00:00.000Z',
          granularity: 'day',
          to: '2026-07-19T12:00:00.000Z',
        },
        series: [],
        summary: {
          enabledLinks: 0,
          pageViews: 0,
          publishedLinks: 0,
          unviewedLinks: 0,
          viewedLinks: 0,
          visits: 0,
        },
      }).summary
    ).toEqual(expect.objectContaining({ publishedLinks: 0 }))
  })

  test('exports OpenAPI from the same HttpApi declaration', () => {
    expect(applicationRegistryOpenApi.openapi).toBe('3.1.0')
    expect(applicationRegistryOpenApi.paths['/v1/applications']).toBeDefined()
    expect(
      applicationRegistryOpenApi.paths['/v1/applications/facets']
    ).toBeDefined()
    expect(
      applicationRegistryOpenApi.paths['/v1/applications/{id}/management']
    ).toBeDefined()
    expect(
      applicationRegistryOpenApi.paths[
        '/v1/applications/{id}/job-snapshots/capture'
      ]
    ).toBeDefined()
    expect(
      applicationRegistryOpenApi.paths['/v1/analytics/cv-links']
    ).toBeDefined()
    expect(applicationRegistryOpenApi.paths['/v1/captures']).toBeUndefined()
  })

  test('fails fast on duplicate endpoint identifiers and operations', () => {
    expect(() =>
      assertUniqueHttpApiEndpoints('registry', [
        { identifier: 'duplicate', method: 'GET', path: '/first' },
        { identifier: 'duplicate', method: 'POST', path: '/second' },
      ])
    ).toThrow('Duplicate HttpApiEndpoint identifier "duplicate"')

    expect(() =>
      assertUniqueHttpApiEndpoints('registry', [
        { identifier: 'first', method: 'GET', path: '/same' },
        { identifier: 'second', method: 'GET', path: '/same' },
      ])
    ).toThrow('Duplicate HttpApi operation "GET /same"')
  })

  test('keeps OpenAPI operation IDs unique and registry operations authenticated', () => {
    const sharedErrorResponses = {
      400: 'BadRequestError',
      401: 'UnauthorizedError',
      404: 'NotFoundError',
      409: 'ConflictError',
      500: 'InternalServerError',
    } as const
    const documentedOperations = Object.entries(
      applicationRegistryOpenApi.paths
    ).flatMap(([path, pathItem]) =>
      Object.values(pathItem).flatMap((operation) =>
        typeof operation === 'object' &&
        operation !== null &&
        'operationId' in operation &&
        typeof operation.operationId === 'string'
          ? [{ operation, path }]
          : []
      )
    )
    const operationIds = documentedOperations.map(
      ({ operation }) => operation.operationId
    )

    expect(documentedOperations).toHaveLength(
      Object.keys(RegistryApi.endpoints).length + 1
    )
    expect(new Set(operationIds).size).toBe(operationIds.length)

    for (const { operation, path } of documentedOperations) {
      if (path.startsWith('/v1/')) {
        expect(operation).toHaveProperty('security', [{ bearer: [] }])
        for (const [status, schema] of Object.entries(sharedErrorResponses)) {
          expect(operation).toHaveProperty(
            `responses.${status}.content.application/json.schema.$ref`,
            `#/components/schemas/${schema}`
          )
        }
      }
    }

    expect(
      applicationRegistryOpenApi.paths['/v1/analytics/cv-links']?.get
    ).toHaveProperty(
      'responses.503.content.application/json.schema.$ref',
      '#/components/schemas/ServiceUnavailableError'
    )
  })
})
