import type { ContentContract } from '@cv/content-composer'
import type {
  ContentVariablesSource,
  Locale,
  ProfileSlug,
  VariableUseDescriptor,
  VariableValue,
} from '@cv/content-core'
import { isString } from 'es-toolkit/predicate'

export type VariableDescriptor = VariableUseDescriptor

export type CollectedVariable = {
  descriptions: Set<string>
  id: string
  locales: Set<Locale>
}

const addCollectedVariable = (
  variables: Map<string, CollectedVariable>,
  descriptor: VariableDescriptor,
  locale: Locale
) => {
  const existing =
    variables.get(descriptor.variable) ??
    ({
      descriptions: new Set<string>(),
      id: descriptor.variable,
      locales: new Set<Locale>(),
    } satisfies CollectedVariable)

  existing.locales.add(locale)

  if ('label' in descriptor && descriptor.label) {
    existing.descriptions.add(descriptor.label)
  }

  if ('title' in descriptor && descriptor.title) {
    existing.descriptions.add(descriptor.title)
  }

  existing.descriptions.add(descriptor.fallback)
  variables.set(descriptor.variable, existing)
}

export const mergeCollectedVariableMaps = (
  ...variableMaps: readonly Map<string, CollectedVariable>[]
) => {
  const variables = new Map<string, CollectedVariable>()

  for (const variableMap of variableMaps) {
    for (const variable of variableMap.values()) {
      const existing = variables.get(variable.id)

      if (existing) {
        for (const locale of variable.locales) {
          existing.locales.add(locale)
        }

        for (const description of variable.descriptions) {
          existing.descriptions.add(description)
        }
      } else {
        variables.set(variable.id, {
          descriptions: new Set(variable.descriptions),
          id: variable.id,
          locales: new Set(variable.locales),
        })
      }
    }
  }

  return variables
}

export const collectVariablesFromDescriptors = (
  descriptors: readonly VariableUseDescriptor[],
  locale: Locale
) => {
  const variables = new Map<string, CollectedVariable>()

  for (const descriptor of descriptors) {
    addCollectedVariable(variables, descriptor, locale)
  }

  return variables
}

export const collectContentVariables = <Content>(
  content: Content,
  locale: Locale,
  profile: ProfileSlug,
  contract: ContentContract<Content>
) => {
  const variables = new Map<string, CollectedVariable>()

  for (const descriptor of contract.privacy?.collectVariables?.({
    content,
    locale,
    profile,
  }) ?? []) {
    addCollectedVariable(variables, descriptor, locale)
  }

  return variables
}

export const isVariableValue = (value: unknown): value is VariableValue =>
  isString(value) ||
  (Array.isArray(value) && value.length > 0 && value.every(isString))

export const variableSourceIds = (
  variableSource: ContentVariablesSource | null
) => new Set(Object.keys(variableSource?.variables ?? {}))
