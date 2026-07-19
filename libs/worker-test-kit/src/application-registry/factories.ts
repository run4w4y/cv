import {
  type CreateApplicationRequest,
  CreateApplicationRequestSchema,
} from '@cv/application-registry-api-contract'
import {
  type applicationActivities,
  applicationStatusValues,
  type applications,
  normalizeApplicationPostingUrl,
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
  readonly activitiesPerApplication?: number
}

export type RegistrySeedApplication = typeof applications.$inferInsert

export type RegistrySeedActivity = typeof applicationActivities.$inferInsert

export interface RegistrySeedGraph {
  readonly applications: readonly RegistrySeedApplication[]
  readonly activities: readonly RegistrySeedActivity[]
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
    overrides: Partial<CreateApplicationRequest> = {}
  ): CreateApplicationRequest {
    const sequence = ++this.#applicationSequence
    const faker = this.#fakerFor(1, sequence)
    const company = faker.company.name()
    const postingUrl = `https://${faker.internet.domainName()}/jobs/${sequence}`
    const minimumMinor = faker.number.int({
      max: 12_000_000,
      min: 5_000_000,
    })
    const input = {
      applicationStatus: faker.helpers.arrayElement(applicationStatusValues),
      appliedAt: null,
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
      labels: faker.helpers.arrayElements(
        ['priority', 'remote', 'platform', 'typescript'],
        { max: 3, min: 1 }
      ),
      location: faker.location.city(),
      personalPriority: faker.helpers.arrayElement(personalPriorityValues),
      postingUrl,
      role: faker.person.jobTitle(),
      targetStage: faker.helpers.arrayElement(targetStageValues),
      ...overrides,
    }
    return Schema.decodeUnknownSync(CreateApplicationRequestSchema)(input)
  }

  graph(options: RegistryGraphOptions): RegistrySeedGraph {
    if (!Number.isInteger(options.applicationCount)) {
      throw new Error('Registry graph applicationCount must be an integer.')
    }
    if (options.applicationCount < 0) {
      throw new Error('Registry graph applicationCount cannot be negative.')
    }
    const activitiesPerApplication = options.activitiesPerApplication ?? 1
    if (
      !Number.isInteger(activitiesPerApplication) ||
      activitiesPerApplication < 0
    ) {
      throw new Error(
        'Registry graph activitiesPerApplication must be a non-negative integer.'
      )
    }

    const graphSequence = ++this.#graphSequence
    const applications: RegistrySeedApplication[] = []
    const activities: RegistrySeedActivity[] = []
    let activityRevision = 0

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
      const postingUrl = `https://${faker.internet.domainName()}/jobs/${id}`
      const postingUrlNormalized = normalizeApplicationPostingUrl(postingUrl)
      applications.push({
        applicationStatus:
          options.applicationStatus ??
          faker.helpers.arrayElement(applicationStatusValues),
        company,
        createdAt: timestamp,
        id,
        location: faker.datatype.boolean() ? faker.location.city() : null,
        personalPriority: faker.datatype.boolean()
          ? faker.helpers.arrayElement(personalPriorityValues)
          : null,
        postingFingerprint: postingUrlNormalized,
        postingUrl,
        postingUrlNormalized,
        role: faker.person.jobTitle(),
        targetStage: faker.helpers.arrayElement(targetStageValues),
        updatedAt: timestamp,
        updatedRevision: sequence,
      })

      for (
        let activityIndex = 0;
        activityIndex < activitiesPerApplication;
        activityIndex += 1
      ) {
        activityRevision += 1
        activities.push({
          actor: 'system',
          applicationId: id,
          id: faker.string.uuid(),
          kind: 'details_changed',
          occurredAt: timestamp,
          payload: { activityIndex, applicationIndex },
          revision: activityRevision,
          source: 'migration',
        })
      }
    }

    return { activities, applications }
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
