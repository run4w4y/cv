import {
  type UpsertApplicationRequest,
  UpsertApplicationRequestSchema,
} from '@cv/application-registry-api-contract'
import {
  type applicationEvents,
  applicationStatusValues,
  type applications,
  personalPriorityValues,
  targetStageValues,
} from '@cv/application-registry-entity'
import { en, Faker } from '@faker-js/faker'
import { Schema } from 'effect'

const currencies = ['EUR', 'GBP', 'JPY', 'USD'] as const

export interface RegistryFactoryOptions {
  readonly now?: string
  readonly seed: number
}

export interface RegistryGraphOptions {
  readonly applicationStatus?: (typeof applicationStatusValues)[number]
  readonly applicationCount: number
  readonly eventsPerApplication?: number
}

export type RegistrySeedApplication = typeof applications.$inferInsert

export type RegistrySeedEvent = typeof applicationEvents.$inferInsert

export interface RegistrySeedGraph {
  readonly applications: readonly RegistrySeedApplication[]
  readonly events: readonly RegistrySeedEvent[]
}

/** Deterministic domain factories with per-record Faker instances. */
export class RegistryFactory {
  readonly now: string
  readonly seed: number

  #applicationSequence = 0
  #graphSequence = 0

  constructor(options: RegistryFactoryOptions) {
    this.seed = options.seed
    this.now = options.now ?? '2026-07-18T00:00:00.000Z'
  }

  application(
    overrides: Partial<UpsertApplicationRequest> = {}
  ): UpsertApplicationRequest {
    const sequence = ++this.#applicationSequence
    const faker = this.#fakerFor(1, sequence)
    const company = faker.company.name()
    const canonicalUrl = `https://${faker.internet.domainName()}/jobs/${sequence}`
    const minimumMinor = faker.number.int({
      max: 12_000_000,
      min: 5_000_000,
    })
    const input = {
      applicationStatus: faker.helpers.arrayElement(applicationStatusValues),
      appliedAt: null,
      canonicalUrl,
      company,
      compensations: [
        {
          currencyCode: faker.helpers.arrayElement(currencies),
          kind: 'base_salary' as const,
          maximumMinor: minimumMinor + 3_000_000,
          minimumMinor,
          period: 'year' as const,
          rawText: null,
          source: 'worker-test-kit',
        },
      ],
      followUpAt: null,
      jobKey: `factory:${this.seed}:${sequence}`,
      labels: faker.helpers.arrayElements(
        ['priority', 'remote', 'platform', 'typescript'],
        { max: 3, min: 1 }
      ),
      lastContactAt: null,
      location: faker.location.city(),
      personalPriority: faker.helpers.arrayElement(personalPriorityValues),
      role: faker.person.jobTitle(),
      source: 'worker-test-kit',
      sourceJobId: `factory-source-${this.seed}-${sequence}`,
      targetStage: faker.helpers.arrayElement(targetStageValues),
      ...overrides,
    }
    return Schema.decodeUnknownSync(UpsertApplicationRequestSchema)(input)
  }

  graph(options: RegistryGraphOptions): RegistrySeedGraph {
    if (!Number.isInteger(options.applicationCount)) {
      throw new Error('Registry graph applicationCount must be an integer.')
    }
    if (options.applicationCount < 0) {
      throw new Error('Registry graph applicationCount cannot be negative.')
    }
    const eventsPerApplication = options.eventsPerApplication ?? 1
    if (!Number.isInteger(eventsPerApplication) || eventsPerApplication < 0) {
      throw new Error(
        'Registry graph eventsPerApplication must be a non-negative integer.'
      )
    }

    const graphSequence = ++this.#graphSequence
    const applications: RegistrySeedApplication[] = []
    const events: RegistrySeedEvent[] = []
    let eventRevision = 0

    for (
      let applicationIndex = 0;
      applicationIndex < options.applicationCount;
      applicationIndex += 1
    ) {
      const sequence = applicationIndex + 1
      const faker = this.#fakerFor(10 + graphSequence, sequence)
      const id = faker.string.uuid()
      const company = faker.company.name()
      const timestamp = this.#timestamp(sequence)
      applications.push({
        applicationStatus:
          options.applicationStatus ??
          faker.helpers.arrayElement(applicationStatusValues),
        canonicalUrl: `https://${faker.internet.domainName()}/jobs/${id}`,
        company,
        companyNormalized: company.trim().toLocaleLowerCase('en-US'),
        createdAt: timestamp,
        id,
        jobKey: `seed:${this.seed}:${graphSequence}:${sequence}`,
        location: faker.datatype.boolean() ? faker.location.city() : null,
        personalPriority: faker.datatype.boolean()
          ? faker.helpers.arrayElement(personalPriorityValues)
          : null,
        role: faker.person.jobTitle(),
        source: 'worker-test-kit-seed',
        sourceJobId: null,
        targetStage: faker.helpers.arrayElement(targetStageValues),
        updatedAt: timestamp,
        updatedRevision: sequence,
      })

      for (
        let eventIndex = 0;
        eventIndex < eventsPerApplication;
        eventIndex += 1
      ) {
        eventRevision += 1
        events.push({
          applicationId: id,
          id: faker.string.uuid(),
          kind: 'research_updated',
          occurredAt: timestamp,
          operationId: `seed:event:${this.seed}:${graphSequence}:${eventRevision}`,
          payload: { applicationIndex, eventIndex },
          recordedAt: timestamp,
          revision: eventRevision,
        })
      }
    }

    return { applications, events }
  }

  #fakerFor(scope: number, sequence: number) {
    const faker = new Faker({ locale: en })
    faker.seed([this.seed, scope, sequence])
    return faker
  }

  #timestamp(offsetSeconds: number) {
    return new Date(Date.parse(this.now) + offsetSeconds * 1_000).toISOString()
  }
}

export const makeRegistryFactory = (options: RegistryFactoryOptions) =>
  new RegistryFactory(options)
