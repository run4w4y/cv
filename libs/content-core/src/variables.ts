import type { VariableUseDescriptor } from './schema'

const isPlainRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

const variableUseDescriptorFromRecord = (
  value: Record<PropertyKey, unknown>
): VariableUseDescriptor | null => {
  const { fallback, kind, label, title, variable } = value

  if (
    (kind !== 'VariableLookup' && kind !== 'RedactedSection') ||
    typeof fallback !== 'string' ||
    typeof variable !== 'string'
  ) {
    return null
  }

  return kind === 'VariableLookup'
    ? ({
        fallback,
        kind,
        label: typeof label === 'string' ? label : undefined,
        variable,
      } satisfies VariableUseDescriptor)
    : ({
        fallback,
        kind,
        title: typeof title === 'string' ? title : undefined,
        variable,
      } satisfies VariableUseDescriptor)
}

const variableUseDescriptorKey = (descriptor: VariableUseDescriptor) =>
  `${descriptor.kind}:${descriptor.variable}`

export const collectVariableUseDescriptors = (
  value: unknown
): readonly VariableUseDescriptor[] => {
  const descriptors = new Map<string, VariableUseDescriptor>()

  const visit = (current: unknown) => {
    if (isPlainRecord(current)) {
      const descriptor = variableUseDescriptorFromRecord(current)

      if (descriptor) {
        descriptors.set(variableUseDescriptorKey(descriptor), descriptor)
        return
      }

      Object.values(current).forEach(visit)
      return
    }

    if (Array.isArray(current)) {
      current.forEach(visit)
    }
  }

  visit(value)

  return [...descriptors.values()]
}
