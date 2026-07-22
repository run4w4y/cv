import type { EditorDescriptor, JsonValue } from './types'

const fromMetadata = (descriptor: EditorDescriptor): JsonValue | undefined =>
  descriptor.defaultValue

export const createInitialValue = (descriptor: EditorDescriptor): JsonValue => {
  const defaultValue = fromMetadata(descriptor)
  if (defaultValue !== undefined) return defaultValue

  switch (descriptor.kind) {
    case 'string':
      return ''
    case 'number':
      return 0
    case 'boolean':
      return false
    case 'literal':
      return descriptor.value
    case 'choice':
      return descriptor.values[0] ?? null
    case 'nullable':
      return null
    case 'array':
      return []
    case 'object': {
      const value: Record<string, JsonValue> = {}
      for (const field of descriptor.fields) {
        if (!field.optional) {
          value[field.key] = createInitialValue(field.descriptor)
        }
      }
      return value
    }
    case 'union':
      return descriptor.options[0]
        ? createInitialValue(descriptor.options[0].descriptor)
        : null
    case 'raw':
    case 'unrepresentable':
      return null
  }
}
