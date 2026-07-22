import { isPlainObject } from 'es-toolkit/predicate'

import { readArray, readString } from './guards'

export const extractGraphqlErrors = (payload: unknown) => {
  if (!isPlainObject(payload)) {
    return []
  }

  return readArray(payload, 'errors')
    .map((error) =>
      isPlainObject(error) ? readString(error, 'message') : undefined
    )
    .filter((message): message is string => Boolean(message))
}
