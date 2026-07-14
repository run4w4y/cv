import { Schema } from 'effect'
import { ApplicationVersionSchema } from './constraints'

export const applicationIdentityResolutionStrategies = [
  'merge',
  'replace',
  'keep-both',
] as const

const ExistingApplicationResolutionSchema = Schema.Struct({
  applicationId: Schema.NonEmptyString,
  expectedVersion: ApplicationVersionSchema,
  strategy: Schema.Literals(['merge', 'replace']),
})

const KeepBothResolutionSchema = Schema.Struct({
  reason: Schema.NonEmptyString,
  strategy: Schema.Literal('keep-both'),
})

export const ApplicationIdentityResolutionSchema = Schema.Union([
  ExistingApplicationResolutionSchema,
  KeepBothResolutionSchema,
])

export type ApplicationIdentityResolution = Schema.Schema.Type<
  typeof ApplicationIdentityResolutionSchema
>

export const normalizeApplicationCanonicalUrl = (value: string) => {
  const url = new URL(value)
  url.hash = ''
  for (const name of [...url.searchParams.keys()]) {
    if (
      name.toLowerCase().startsWith('utm_') ||
      ['fbclid', 'gclid'].includes(name.toLowerCase())
    ) {
      url.searchParams.delete(name)
    }
  }
  url.searchParams.sort()
  return url.toString().replace(/[?#]$/u, '')
}
