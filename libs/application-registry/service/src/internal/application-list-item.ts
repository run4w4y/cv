import type { ApplicationListRecord } from '@cv/application-registry-crud'
import type { ApplicationCompensation } from '@cv/application-registry-entity'

import type { ApplicationListItem } from '../types'

const annualKindPriority = {
  base_salary: 0,
  total_compensation: 1,
} as const

type AnnualCompensationKind = keyof typeof annualKindPriority

const isAnnualCompensationKind = (
  kind: ApplicationCompensation['kind']
): kind is AnnualCompensationKind => kind in annualKindPriority

export const selectAnnualCompensation = (
  compensations: readonly ApplicationCompensation[]
): ApplicationCompensation | undefined =>
  compensations.reduce<ApplicationCompensation | undefined>(
    (current, candidate) => {
      if (
        candidate.period !== 'year' ||
        !isAnnualCompensationKind(candidate.kind)
      ) {
        return current
      }
      if (current === undefined) return candidate

      const priority =
        annualKindPriority[candidate.kind] -
        annualKindPriority[current.kind as AnnualCompensationKind]
      if (priority < 0) return candidate
      if (priority > 0) return current
      return candidate.id.localeCompare(current.id) < 0 ? candidate : current
    },
    undefined
  )

const annualCompensationFrom = (
  compensations: readonly ApplicationCompensation[]
): ApplicationListItem['annualCompensation'] => {
  const selected = selectAnnualCompensation(compensations)

  return selected === undefined
    ? null
    : {
        currencyCode: selected.currencyCode,
        maximumMinor: selected.maximumMinor,
        minimumMinor: selected.minimumMinor,
      }
}

export const toApplicationListItem = (
  record: ApplicationListRecord,
  displayedCompensations?: readonly ApplicationCompensation[]
): ApplicationListItem => {
  const { compensations, ...application } = record
  const visibleCompensations = displayedCompensations ?? compensations
  return {
    ...application,
    annualCompensation: annualCompensationFrom(visibleCompensations),
  }
}
