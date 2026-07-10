import { describe, expect, test } from 'bun:test'
import { Effect } from 'effect'
import {
  parseCampaignProfileShortlistEffect,
  parseCampaignRecommendationEffect,
} from './recommendation'

const allowedProfiles = ['go-backend']

const validRecommendation = {
  coverLetter: {
    body: 'Cover letter',
    subject: 'Application',
  },
  email: {
    body: 'Email body',
    subject: 'Application',
  },
  followUpQuestions: [],
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
    routineSignals: ['API documentation'],
    requiredSignals: ['Build APIs'],
    role: 'Backend Engineer',
    seniority: 'Senior',
    summary: 'Backend role',
    technologies: ['Go'],
    workMode: 'Remote',
  },
  matchedEvidence: [
    {
      evidence: ['Built Go APIs'],
      signal: 'Go',
    },
  ],
  recommendation: {
    alternatives: [],
    audienceSlug: 'acme',
    confidence: 0.9,
    profile: 'go-backend',
    rationale: 'Strong Go fit',
  },
}

const validShortlist = {
  job: validRecommendation.job,
  profileShortlist: [
    {
      evidenceNeeded: ['Go APIs'],
      profile: 'go-backend',
      rationale: 'Backend fit',
    },
  ],
}

const parse = (value: unknown, fixedProfile?: string) =>
  Effect.runPromise(
    parseCampaignRecommendationEffect(JSON.stringify(value), {
      allowedProfiles,
      fixedProfile,
    })
  )

const parseShortlist = (value: unknown, fixedProfile?: string) =>
  Effect.runPromise(
    parseCampaignProfileShortlistEffect(JSON.stringify(value), {
      allowedProfiles,
      fixedProfile,
    })
  )

describe('recommendation parsing', () => {
  test('rejects malformed JSON through the recommendation schema', async () => {
    await expect(
      Effect.runPromise(
        parseCampaignRecommendationEffect('{', { allowedProfiles })
      )
    ).rejects.toThrow('Could not decode campaign recommendation')
  })

  test('rejects malformed JSON through the shortlist schema', async () => {
    await expect(
      Effect.runPromise(
        parseCampaignProfileShortlistEffect('{', { allowedProfiles })
      )
    ).rejects.toThrow('Could not decode campaign profile shortlist')
  })

  test('accepts a valid profile shortlist', async () => {
    const shortlist = await parseShortlist(validShortlist)

    expect(shortlist.profileShortlist[0]?.profile).toBe('go-backend')
  })

  test('rejects a shortlist with unknown profiles', async () => {
    await expect(
      parseShortlist({
        ...validShortlist,
        profileShortlist: [
          {
            evidenceNeeded: ['React'],
            profile: 'frontend',
            rationale: 'Frontend fit',
          },
        ],
      })
    ).rejects.toThrow('unknown profile')
  })

  test('rejects a shortlist that ignores a fixed profile', async () => {
    await expect(
      Effect.runPromise(
        parseCampaignProfileShortlistEffect(
          JSON.stringify({
            ...validShortlist,
            profileShortlist: [
              {
                evidenceNeeded: ['React'],
                profile: 'frontend',
                rationale: 'Frontend fit',
              },
            ],
          }),
          {
            allowedProfiles: ['go-backend', 'frontend'],
            fixedProfile: 'go-backend',
          }
        )
      )
    ).rejects.toThrow('did not request fixed profile')
  })

  test('accepts a valid recommendation', async () => {
    const recommendation = await parse(validRecommendation)

    expect(recommendation.recommendation.profile).toBe('go-backend')
    expect(recommendation.job.niceToHaveSignals).toEqual(['PostgreSQL'])
  })

  test('rejects unknown profiles', async () => {
    await expect(
      parse({
        ...validRecommendation,
        recommendation: {
          ...validRecommendation.recommendation,
          profile: 'frontend',
        },
      })
    ).rejects.toThrow('unknown profile')
  })

  test('rejects a recommendation that ignores a fixed profile', async () => {
    await expect(parse(validRecommendation, 'frontend')).rejects.toThrow(
      '--profile fixed'
    )
  })
})
