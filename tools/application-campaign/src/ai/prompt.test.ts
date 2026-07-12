import { describe, expect, test } from 'bun:test'
import { BunServices } from '@effect/platform-bun'
import { Effect } from 'effect'
import { renderProfilesMarkdown } from '../profiles/render-full'
import { renderProfileSummariesMarkdown } from '../profiles/render-summary'
import {
  renderProfileShortlistPrompt,
  renderRecommendationPrompt,
} from './prompt'

const profileContent = {
  defaultProfile: 'base',
  layers: [
    {
      profile: 'base',
      sources: [
        {
          kind: 'module',
          modulePath: 'knowledge/profiles/base/en/foundation.ts',
          path: ['foundation'],
          source:
            'export const candidate = "Senior engineer with systems ownership"',
        },
      ],
    },
    {
      profile: 'go-backend',
      sources: [
        {
          kind: 'mdx',
          modulePath:
            'knowledge/profiles/go-backend/en/evidence/constellation.mdx',
          path: ['evidence', 'constellation'],
          source:
            '# Backend evidence\n\nBackend-focused profile. Owned Go APIs, PostgreSQL, and distributed systems.',
        },
      ],
    },
  ],
  locale: 'en',
  profile: 'go-backend',
  sharedSources: [
    {
      modulePath: 'knowledge/shared/taxonomy.ts',
      source: 'export const seniority = "Senior systems ownership"',
    },
  ],
} as const

const profileCatalog = {
  availableProfiles: {
    en: ['go-backend'],
  },
  content: {
    en: {
      'go-backend': profileContent,
    },
  },
  defaultLocale: 'en',
  defaultProfile: 'default',
  locales: ['en'],
  profiles: ['go-backend'],
}

describe('application campaign prompt rendering', () => {
  test('passes the full fetched job body into prompts', async () => {
    const lateJobDetails = [
      'Required Qualifications',
      'Own technical strategy for a product line.',
      'Lead architecture standards across many engineers.',
    ].join('\n')
    const prompt = await Effect.runPromise(
      renderProfileShortlistPrompt({
        fixedProfile: 'go-backend',
        job: {
          body: `${'x'.repeat(27_000)}\n${lateJobDetails}`,
          fetchedAt: '2026-07-08T00:00:00.000Z',
          url: 'https://jobs.example.com/backend',
        },
        locale: 'en',
        profileSummaries: '## go-backend\nBackend-focused profile.',
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(prompt).toContain(lateJobDetails)
    expect(prompt).not.toContain('[truncated]')
  })

  test('renders a first-pass shortlist prompt with compact profile context', async () => {
    const prompt = await Effect.runPromise(
      Effect.gen(function* () {
        const profileSummaries = renderProfileSummariesMarkdown({
          catalog: profileCatalog,
          locale: 'en',
          profiles: ['go-backend'],
        })

        return yield* renderProfileShortlistPrompt({
          fixedProfile: 'go-backend',
          job: {
            body: '<html><body>Build backend APIs with Go and PostgreSQL.</body></html>',
            fetchedAt: '2026-07-08T00:00:00.000Z',
            url: 'https://jobs.example.com/backend',
          },
          locale: 'en',
          profileSummaries,
        })
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(prompt).toContain('Preferred campaign locale: en')
    expect(prompt).toContain('Available compact profile source contexts:')
    expect(prompt).toContain('not a complete rendered CV')
    expect(prompt).toContain('Request only the fixed profile "go-backend"')
    expect(prompt).toContain('## go-backend')
    expect(prompt).toContain('Backend-focused profile.')
    expect(prompt).toContain('Owned Go APIs, PostgreSQL')
    expect(prompt).not.toContain('Senior systems ownership')
    expect(prompt).not.toContain('Senior engineer with systems ownership')
    expect(prompt).toContain('Build backend APIs with Go and PostgreSQL.')
  })

  test('renders a final recommendation prompt with requested profile context', async () => {
    const prompt = await Effect.runPromise(
      Effect.gen(function* () {
        const profileMarkdown = renderProfilesMarkdown({
          catalog: profileCatalog,
          locale: 'en',
          profiles: ['go-backend'],
        })

        return yield* renderRecommendationPrompt({
          fixedAudience: 'acme',
          fixedProfile: 'go-backend',
          job: {
            body: '<html><body>Build backend APIs with Go and PostgreSQL.</body></html>',
            fetchedAt: '2026-07-08T00:00:00.000Z',
            url: 'https://jobs.example.com/backend',
          },
          locale: 'en',
          materialsMode: 'all',
          profileMarkdown,
          profileShortlist: {
            job: {
              applicationQuestions: [],
              company: 'Acme',
              concerns: [],
              coverLetterInstructions: [],
              coverLetterRequired: false,
              differentiators: ['Distributed systems ownership'],
              hiringSignals: ['Go'],
              location: 'Remote',
              niceToHaveSignals: ['PostgreSQL'],
              requiredSignals: ['Build APIs'],
              role: 'Backend Engineer',
              routineSignals: ['API documentation'],
              seniority: 'Senior',
              summary: 'Backend role',
              technologies: ['Go', 'PostgreSQL'],
              workMode: 'Remote',
            },
            profileShortlist: [
              {
                evidenceNeeded: ['Go APIs', 'PostgreSQL'],
                profile: 'go-backend',
                rationale: 'Backend-focused profile.',
              },
            ],
          },
        })
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(prompt).toContain('Preferred locale: en')
    expect(prompt).toContain('Full authored CV source context:')
    expect(prompt).toContain('application order')
    expect(prompt).toContain('Use the fixed profile "go-backend"')
    expect(prompt).toContain('Use the fixed audience slug "acme"')
    expect(prompt).toContain('Draft the applicant-facing cover letter')
    expect(prompt).toContain('# Profile: go-backend')
    expect(prompt).toContain('# Shared authored sources')
    expect(prompt).toContain('Senior systems ownership')
    expect(prompt).toContain('Authored layer: base')
    expect(prompt).toContain('Senior engineer with systems ownership')
    expect(prompt).toContain('Authored layer: go-backend')
    expect(prompt).toContain('Backend-focused profile.')
    expect(prompt).toContain('nice-to-have')
    expect(prompt).toContain('brief cover note')
    expect(prompt).toContain('Do not write a proof-of-fit essay')
    expect(prompt).toContain('short introduction accompanying the CV')
    expect(prompt).toContain('Use at most two evidence themes')
    expect(prompt).toContain('name at most 4 specific technologies')
    expect(prompt).toContain(
      'Do not copy matched evidence into the cover letter'
    )
    expect(prompt).toContain('Avoid abstract fit language')
    expect(prompt).toContain('Keep the closing low-key')
    expect(prompt).toContain('Do not add an enthusiasm sentence')
    expect(prompt).toContain('Do not mention previous employer names')
    expect(prompt).toContain('Do not mention language certificates')
    expect(prompt).toContain('Build backend APIs with Go and PostgreSQL.')
  })

  test('can render final recommendation prompts without applicant materials', async () => {
    const prompt = await Effect.runPromise(
      Effect.gen(function* () {
        const profileMarkdown = renderProfilesMarkdown({
          catalog: profileCatalog,
          locale: 'en',
          profiles: ['go-backend'],
        })

        return yield* renderRecommendationPrompt({
          fixedAudience: 'acme',
          fixedProfile: 'go-backend',
          job: {
            body: 'Build backend APIs with Go and PostgreSQL.',
            fetchedAt: '2026-07-08T00:00:00.000Z',
            url: 'https://jobs.example.com/backend',
          },
          locale: 'en',
          materialsMode: 'none',
          profileMarkdown,
          profileShortlist: {
            job: {
              applicationQuestions: [],
              company: 'Acme',
              concerns: [],
              coverLetterInstructions: [],
              coverLetterRequired: false,
              differentiators: ['Distributed systems ownership'],
              hiringSignals: ['Go'],
              location: 'Remote',
              niceToHaveSignals: ['PostgreSQL'],
              requiredSignals: ['Build APIs'],
              role: 'Backend Engineer',
              routineSignals: ['API documentation'],
              seniority: 'Senior',
              summary: 'Backend role',
              technologies: ['Go', 'PostgreSQL'],
              workMode: 'Remote',
            },
            profileShortlist: [
              {
                evidenceNeeded: ['Go APIs', 'PostgreSQL'],
                profile: 'go-backend',
                rationale: 'Backend-focused profile.',
              },
            ],
          },
        })
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(prompt).toContain('Do not draft applicant-facing cover letter')
    expect(prompt).toContain('Return empty strings for coverLetter.subject')
  })

  test('renders a one-pass recommendation prompt when no shortlist is needed', async () => {
    const prompt = await Effect.runPromise(
      renderRecommendationPrompt({
        fixedProfile: 'go-backend',
        job: {
          body: 'Build backend APIs.',
          fetchedAt: '2026-07-08T00:00:00.000Z',
          url: 'https://jobs.example.com/backend',
        },
        locale: 'en',
        materialsMode: 'all',
        profileMarkdown: '# Profile: go-backend',
      }).pipe(Effect.provide(BunServices.layer))
    )

    expect(prompt).toContain('No separate first-pass analysis was needed')
    expect(prompt).toContain('No shortlist was needed')
  })
})
