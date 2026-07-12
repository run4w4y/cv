import { Effect } from 'effect'

import { RegistryBadRequestError } from '../errors'

export type RegistryCursor = { readonly revision: number }

export const encodeCursor = ({ revision }: RegistryCursor) =>
  new URLSearchParams({ revision: String(revision) }).toString()

export const decodeCursor = (
  value: string | undefined
): Effect.Effect<RegistryCursor | undefined, RegistryBadRequestError> => {
  if (!value) return Effect.succeed(undefined)

  const encodedRevision = new URLSearchParams(value).get('revision')
  const revision =
    encodedRevision === null ? Number.NaN : Number(encodedRevision)

  return Number.isSafeInteger(revision) && revision >= 0
    ? Effect.succeed({ revision })
    : Effect.fail(
        new RegistryBadRequestError({ message: 'Invalid pagination cursor.' })
      )
}
