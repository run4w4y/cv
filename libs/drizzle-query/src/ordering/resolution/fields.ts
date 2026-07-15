import type { FieldRuntime } from '../../fields/index'
import { invalidOrdering } from '../errors'
import type { OrderingFieldSource } from '../types'

/** @internal Normalizes a field tuple or registry to one name-keyed map. */
export const makeFieldMap = (
  fields: OrderingFieldSource
): ReadonlyMap<string, FieldRuntime> => {
  if (!Array.isArray(fields)) {
    return fields as ReadonlyMap<string, FieldRuntime>
  }

  const result = new Map<string, FieldRuntime>()
  for (const field of fields as readonly FieldRuntime[]) {
    if (field.name === undefined) continue
    if (result.has(field.name)) {
      throw invalidOrdering(
        `The query defines more than one field named "${field.name}".`,
        `fields.${field.name}`,
        'definition'
      )
    }
    result.set(field.name, field)
  }
  return result
}

/** Validates and resolves configured deterministic field tuples. */
export const resolveUniqueBy = <FieldName extends string>(
  fields: ReadonlyMap<string, FieldRuntime>,
  input: readonly (readonly FieldName[])[] | undefined
): readonly (readonly FieldName[])[] => {
  if (input === undefined) return []

  return input.map((candidate, candidateIndex) => {
    const candidatePath = `uniqueBy[${candidateIndex}]`
    if (candidate.length === 0) {
      throw invalidOrdering(
        'A unique ordering candidate must contain at least one field.',
        candidatePath,
        'definition'
      )
    }

    const seen = new Set<string>()
    return candidate.map((fieldName, fieldIndex) => {
      const path = `${candidatePath}[${fieldIndex}]`
      if (seen.has(fieldName)) {
        throw invalidOrdering(
          `Unique ordering candidate field "${fieldName}" is used more than once.`,
          path,
          'definition'
        )
      }
      seen.add(fieldName)

      const field = fields.get(fieldName)
      if (field?.sort === undefined || !field.sort.enabled) {
        throw invalidOrdering(
          `Unknown or non-sortable unique field "${fieldName}".`,
          path,
          'definition'
        )
      }
      if (field.sort.nullable) {
        throw invalidOrdering(
          `Unique ordering field "${fieldName}" must be non-null.`,
          path,
          'definition'
        )
      }

      return fieldName
    })
  })
}

/** @internal Returns every configured or inferred deterministic field tuple. */
export const orderingCandidates = <FieldName extends string>(
  fields: ReadonlyMap<string, FieldRuntime>,
  uniqueBy: readonly (readonly FieldName[])[]
): readonly (readonly FieldName[])[] => {
  const candidates: (readonly FieldName[])[] = [...uniqueBy]

  for (const [name, field] of fields) {
    if (
      field.sort?.enabled === true &&
      field.sort.unique &&
      !field.sort.nullable &&
      !candidates.some(
        (candidate) => candidate.length === 1 && candidate[0] === name
      )
    ) {
      candidates.push([name as FieldName])
    }
  }

  return candidates
}
