import { resolveContentVariableValue } from '@cv/content-build'
import { cvContentContract } from '@cv/cv/content-contract'
import { Effect } from 'effect'
import { ApplicationCampaignContentError } from '../errors'
import type { ProfileCatalog } from './catalog'

export type ResolvedProfileCatalog = ProfileCatalog & {
  readonly resolvedVariables: ReadonlyMap<string, string>
}

const inlineValue = (value: string | readonly string[]) =>
  typeof value === 'string' ? value : value.join('; ')

const variableIds = ({
  catalog,
  locale,
  profiles,
}: {
  readonly catalog: ProfileCatalog
  readonly locale: string
  readonly profiles: readonly string[]
}) =>
  new Set(
    profiles.flatMap((profile) => {
      const content = catalog.content[locale]?.[profile]

      return content
        ? (
            cvContentContract.privacy?.collectVariables?.({
              content,
              locale,
              profile,
            }) ?? []
          ).map((descriptor) => descriptor.variable)
        : []
    })
  )

export const resolveProfileVariables = ({
  catalog,
  locale,
  profiles,
}: {
  readonly catalog: ProfileCatalog
  readonly locale: string
  readonly profiles: readonly string[]
}) =>
  Effect.forEach(variableIds({ catalog, locale, profiles }), (variable) =>
    resolveContentVariableValue(catalog.variableSource, variable, locale).pipe(
      Effect.map((value) => [variable, inlineValue(value)] as const),
      Effect.mapError(
        (cause) =>
          new ApplicationCampaignContentError({
            cause,
            message: `Could not resolve private content variable "${variable}" for ${locale}.`,
          })
      )
    )
  ).pipe(
    Effect.map(
      (entries): ResolvedProfileCatalog => ({
        ...catalog,
        resolvedVariables: new Map(entries),
      })
    )
  )
