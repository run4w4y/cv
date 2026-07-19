import { isPlainObject } from 'es-toolkit/predicate'

import type {
  EditorDescriptor,
  JsonPrimitive,
  UnionOptionDescriptor,
} from '../types'

type ScalarKind = 'string' | 'number' | 'boolean' | 'null'

type MatchProfile =
  | { readonly kind: ScalarKind | 'array' }
  | { readonly kind: 'literal'; readonly values: ReadonlyArray<JsonPrimitive> }
  | {
      readonly kind: 'object'
      readonly discriminants: ReadonlyArray<{
        readonly key: string
        readonly values: ReadonlyArray<JsonPrimitive>
      }>
    }

const scalarKind = (value: JsonPrimitive): ScalarKind => {
  if (value === null) return 'null'
  if (typeof value === 'string') return 'string'
  if (typeof value === 'number') return 'number'
  return 'boolean'
}

const samePrimitive = (left: JsonPrimitive, right: JsonPrimitive): boolean =>
  Object.is(left, right)

const profileFor = (descriptor: EditorDescriptor): MatchProfile | null => {
  switch (descriptor.kind) {
    case 'string':
    case 'boolean':
      return { kind: descriptor.kind }
    case 'number':
      return { kind: 'number' }
    case 'literal':
      return { kind: 'literal', values: [descriptor.value] }
    case 'choice':
      return descriptor.values.length > 0
        ? { kind: 'literal', values: descriptor.values }
        : null
    case 'array':
      return { kind: 'array' }
    case 'object': {
      const discriminants = descriptor.fields.flatMap((field) => {
        if (field.optional) return []
        if (field.descriptor.kind === 'literal') {
          return [{ key: field.key, values: [field.descriptor.value] }]
        }
        if (
          field.descriptor.kind === 'choice' &&
          field.descriptor.values.length > 0
        ) {
          return [{ key: field.key, values: field.descriptor.values }]
        }
        return []
      })
      return { kind: 'object', discriminants }
    }
    case 'nullable':
    case 'union':
    case 'raw':
    case 'unrepresentable':
      return null
  }
}

const literalMatchesProfile = (
  value: JsonPrimitive,
  profile: MatchProfile
): boolean => {
  if (profile.kind === 'literal') {
    return profile.values.some((candidate) => samePrimitive(candidate, value))
  }
  if (profile.kind === 'array' || profile.kind === 'object') return false
  return profile.kind === scalarKind(value)
}

const objectProfilesOverlap = (
  left: Extract<MatchProfile, { readonly kind: 'object' }>,
  right: Extract<MatchProfile, { readonly kind: 'object' }>
): boolean => {
  for (const leftDiscriminant of left.discriminants) {
    const rightDiscriminant = right.discriminants.find(
      (candidate) => candidate.key === leftDiscriminant.key
    )
    if (
      rightDiscriminant &&
      !leftDiscriminant.values.some((leftValue) =>
        rightDiscriminant.values.some((rightValue) =>
          samePrimitive(leftValue, rightValue)
        )
      )
    ) {
      return false
    }
  }
  return true
}

const profilesOverlap = (left: MatchProfile, right: MatchProfile): boolean => {
  if (left.kind === 'literal') {
    return left.values.some((value) => literalMatchesProfile(value, right))
  }
  if (right.kind === 'literal') {
    return right.values.some((value) => literalMatchesProfile(value, left))
  }
  if (left.kind !== right.kind) return false
  return left.kind === 'object' && right.kind === 'object'
    ? objectProfilesOverlap(left, right)
    : true
}

export const areUnionOptionsUnambiguous = (
  descriptors: ReadonlyArray<EditorDescriptor>
): boolean => {
  const profiles = descriptors.map(profileFor)
  if (profiles.some((profile) => profile === null)) return false

  for (let leftIndex = 0; leftIndex < profiles.length; leftIndex += 1) {
    const left = profiles[leftIndex]
    if (!left) return false
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < profiles.length;
      rightIndex += 1
    ) {
      const right = profiles[rightIndex]
      if (!right || profilesOverlap(left, right)) return false
    }
  }
  return true
}

export const matchesDescriptor = (
  descriptor: EditorDescriptor,
  value: unknown
): boolean => {
  switch (descriptor.kind) {
    case 'string':
      return typeof value === 'string'
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'literal':
      return Object.is(value, descriptor.value)
    case 'choice':
      return descriptor.values.some((candidate) => Object.is(candidate, value))
    case 'nullable':
      return value === null || matchesDescriptor(descriptor.value, value)
    case 'array':
      return Array.isArray(value)
    case 'object': {
      if (!isPlainObject(value)) return false
      const profile = profileFor(descriptor)
      return (
        profile?.kind === 'object' &&
        profile.discriminants.every((discriminant) =>
          discriminant.values.some((candidate) =>
            Object.is(candidate, value[discriminant.key])
          )
        )
      )
    }
    case 'union':
      return findMatchingUnionOption(descriptor.options, value) >= 0
    case 'raw':
    case 'unrepresentable':
      return false
  }
}

export const findMatchingUnionOption = (
  options: ReadonlyArray<UnionOptionDescriptor>,
  value: unknown
): number => {
  let match = -1
  for (let index = 0; index < options.length; index += 1) {
    const option = options[index]
    if (!option || !matchesDescriptor(option.descriptor, value)) continue
    if (match >= 0) return -1
    match = index
  }
  return match
}
