import type {
  ListingCheckTarget,
  ListingObservation,
} from '@cv/application-registry-entity'

import type { ListingDocument } from './document'
import type { ListingFetchResult } from './http'
import { baseObservation } from './observation'

const normalizeText = (value: string) =>
  value
    .normalize('NFKD')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

const meaningfulTokens = (value: string) =>
  new Set(
    normalizeText(value)
      .split(' ')
      .filter((token) => token.length > 2)
  )

const titleMatches = (candidate: string, expected: string) => {
  const candidateTokens = meaningfulTokens(candidate)
  const expectedTokens = meaningfulTokens(expected)
  if (expectedTokens.size === 0) return false

  const matches = [...expectedTokens].filter((token) =>
    candidateTokens.has(token)
  ).length
  return (
    matches / expectedTokens.size >= 0.6 &&
    matches / Math.max(candidateTokens.size, 1) >= 0.5
  )
}

const titleRecall = (candidate: string, expected: string) => {
  const candidateTokens = meaningfulTokens(candidate)
  const expectedTokens = meaningfulTokens(expected)
  if (expectedTokens.size === 0) return 0

  return (
    [...expectedTokens].filter((token) => candidateTokens.has(token)).length /
    expectedTokens.size
  )
}

const companyMatches = (candidate: string, expected: string) => {
  const normalizedCandidate = normalizeText(candidate)
  const normalizedExpected = normalizeText(expected)
  return (
    normalizedCandidate.includes(normalizedExpected) ||
    normalizedExpected.includes(normalizedCandidate)
  )
}

const expirationTime = (value: string) => {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/u.test(value)
  const parsed = Date.parse(dateOnly ? `${value}T23:59:59.999Z` : value)
  return Number.isNaN(parsed) ? null : parsed
}

const isWorkableNotFoundRedirect = (
  target: ListingCheckTarget,
  result: ListingFetchResult
) => {
  if (!URL.canParse(target.url) || !URL.canParse(result.finalUrl)) return false

  const requested = new URL(target.url)
  const final = new URL(result.finalUrl)
  return (
    requested.hostname === 'apply.workable.com' &&
    requested.pathname.includes('/j/') &&
    final.hostname === requested.hostname &&
    final.searchParams.get('not_found') === 'true'
  )
}

export const classifyHttpStatus = (
  target: ListingCheckTarget,
  result: ListingFetchResult,
  provider: string,
  checkedAt: string
): ListingObservation | null => {
  const base = baseObservation(target, result, provider, checkedAt)
  if (result.status === 410) {
    return {
      ...base,
      confidence: 'confirmed',
      evidence: [
        {
          code: 'http_status',
          detail: 'HTTP 410 Gone',
          sourceUrl: result.finalUrl,
        },
      ],
      outcome: 'closed',
      reasonCode: 'http_410',
    }
  }
  if (result.status === 404) {
    return {
      ...base,
      confidence: 'high',
      evidence: [
        {
          code: 'http_status',
          detail: 'HTTP 404 Not Found',
          sourceUrl: result.finalUrl,
        },
      ],
      outcome: 'closed',
      reasonCode: 'http_404',
    }
  }
  if (isWorkableNotFoundRedirect(target, result)) {
    return {
      ...base,
      confidence: 'confirmed',
      evidence: [
        {
          code: 'provider_redirect',
          detail: 'Workable reports that the requested posting was not found.',
          sourceUrl: result.finalUrl,
        },
      ],
      outcome: 'closed',
      reasonCode: 'provider_closed',
    }
  }

  const reasonCode =
    result.status === 401 || result.status === 403
      ? 'access_forbidden'
      : result.status === 429
        ? 'rate_limited'
        : result.status >= 500
          ? 'server_error'
          : null
  return reasonCode
    ? {
        ...base,
        confidence: 'low',
        evidence: [
          {
            code: 'http_status',
            detail: `HTTP ${result.status}`,
            sourceUrl: result.finalUrl,
          },
        ],
        outcome: 'unknown',
        reasonCode,
      }
    : null
}

export const classifyDocument = (
  target: ListingCheckTarget,
  result: ListingFetchResult,
  document: ListingDocument,
  contentHash: string,
  provider: string,
  checkedAt: string,
  now: number
): ListingObservation => {
  const base = {
    ...baseObservation(target, result, provider, checkedAt),
    contentHash,
  }
  const roleMatchingNode = document.jobPostings.find((node) =>
    titleMatches(node.title, target.role)
  )
  const matchingNode = document.jobPostings.find(
    (node) =>
      titleMatches(node.title, target.role) &&
      companyMatches(node.organization, target.company)
  )

  if (matchingNode?.validThrough) {
    const expiresAt = expirationTime(matchingNode.validThrough)
    if (expiresAt !== null) {
      const expired = now >= expiresAt
      return {
        ...base,
        confidence: 'high',
        evidence: [
          {
            code: 'jsonld_valid_through',
            detail: expired
              ? `JobPosting expired at ${matchingNode.validThrough}.`
              : `JobPosting is valid through ${matchingNode.validThrough}.`,
            sourceUrl: result.finalUrl,
          },
        ],
        outcome: expired ? 'closed' : 'open',
        reasonCode: expired ? 'valid_through_expired' : 'provider_open',
      }
    }
  }

  const identityMatches =
    (roleMatchingNode !== undefined ||
      document.headings.some((heading) => titleMatches(heading, target.role)) ||
      titleMatches(document.title, target.role)) &&
    normalizeText(document.text).includes(normalizeText(target.company))
  const closedText =
    /no longer (accepting|available)|position (has been )?closed|job (has )?expired|applications? (are )?closed|募集.{0,12}終了|掲載終了/iu.test(
      document.text
    )
  if (identityMatches && closedText) {
    return {
      ...base,
      confidence: 'high',
      evidence: [
        {
          code: 'closed_text',
          detail: 'The matching posting says applications are closed.',
          sourceUrl: result.finalUrl,
        },
      ],
      outcome: 'closed',
      reasonCode: 'explicit_closed_text',
    }
  }

  const hasApplicationAction =
    /apply now|apply for this job|submit application|応募する/iu.test(
      document.text
    )
  if (identityMatches && hasApplicationAction) {
    return {
      ...base,
      confidence: matchingNode ? 'high' : 'medium',
      evidence: [
        {
          code: 'application_action',
          detail: 'The matching posting exposes an application action.',
          sourceUrl: result.finalUrl,
        },
      ],
      outcome: 'open',
      reasonCode: 'working_application_path',
    }
  }

  const likelyReplacement =
    hasApplicationAction &&
    [
      ...document.jobPostings.map(({ title }) => title),
      ...document.headings,
    ].some(
      (candidate) =>
        !titleMatches(candidate, target.role) &&
        titleRecall(candidate, target.role) >= 0.6
    )
  if (likelyReplacement) {
    return {
      ...base,
      confidence: 'medium',
      evidence: [
        {
          code: 'identity_mismatch',
          detail:
            'The URL exposes an active application for a materially different role.',
          sourceUrl: result.finalUrl,
        },
      ],
      outcome: 'closed',
      reasonCode: 'identity_mismatch',
    }
  }

  const redirected = result.finalUrl !== target.url
  return {
    ...base,
    confidence: 'low',
    evidence: [
      {
        code: redirected ? 'redirect' : 'unclassified',
        detail: redirected
          ? `Posting redirected to ${result.finalUrl}.`
          : 'The page did not expose a decisive availability signal.',
        sourceUrl: result.finalUrl,
      },
    ],
    outcome: 'unknown',
    reasonCode: redirected
      ? 'redirected_to_listing_page'
      : document.jobPostings.length > 0 || document.title.length > 0
        ? 'identity_mismatch'
        : 'unclassified_page',
  }
}
