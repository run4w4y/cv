import { SchemaAST } from 'effect'

import type { DescriptorMetadata, EditorDescriptor, JsonValue } from '../types'
import { isJsonValue } from './json-value'

type Annotations = Readonly<Record<string, unknown>> | undefined

const stringAnnotation = (
  annotations: Annotations,
  key: string
): string | undefined => {
  const value = annotations?.[key]
  return typeof value === 'string' ? value : undefined
}

const defaultAnnotation = (annotations: Annotations): JsonValue | undefined =>
  isJsonValue(annotations?.default) ? annotations.default : undefined

const exampleAnnotations = (
  annotations: Annotations
): ReadonlyArray<JsonValue> | undefined => {
  if (!Array.isArray(annotations?.examples)) return undefined
  const examples = annotations.examples.filter(isJsonValue)
  return examples.length > 0 ? examples : undefined
}

export const descriptorMetadata = (
  ast: SchemaAST.AST,
  annotationSource: SchemaAST.AST,
  encoded: boolean
): DescriptorMetadata => {
  const encodedAnnotations = SchemaAST.resolve(ast)
  const sourceAnnotations = SchemaAST.resolve(annotationSource)
  const keyAnnotations = annotationSource.context?.annotations
  const presentationAnnotations = {
    ...encodedAnnotations,
    ...sourceAnnotations,
    ...keyAnnotations,
  }
  const valueAnnotations = encoded
    ? encodedAnnotations
    : presentationAnnotations

  return {
    title: stringAnnotation(presentationAnnotations, 'title'),
    description: stringAnnotation(presentationAnnotations, 'description'),
    documentation: stringAnnotation(presentationAnnotations, 'documentation'),
    defaultValue: defaultAnnotation(valueAnnotations),
    examples: exampleAnnotations(valueAnnotations),
    expected:
      stringAnnotation(encodedAnnotations, 'expected') ??
      stringAnnotation(presentationAnnotations, 'expected'),
    format:
      stringAnnotation(encodedAnnotations, 'format') ??
      stringAnnotation(presentationAnnotations, 'format'),
    checked:
      (annotationSource.checks?.length ?? 0) > 0 ||
      (ast.checks?.length ?? 0) > 0,
    encoded,
  }
}

export const withMetadata = (
  descriptor: EditorDescriptor,
  override: DescriptorMetadata
): EditorDescriptor =>
  Object.assign({}, descriptor, {
    title: override.title ?? descriptor.title,
    description: override.description ?? descriptor.description,
    documentation: override.documentation ?? descriptor.documentation,
    defaultValue:
      override.defaultValue !== undefined
        ? override.defaultValue
        : descriptor.defaultValue,
    examples: override.examples ?? descriptor.examples,
    expected: override.expected ?? descriptor.expected,
    format: override.format ?? descriptor.format,
    checked: override.checked || descriptor.checked,
    encoded: override.encoded || descriptor.encoded,
  })

export const descriptorLabel = (
  descriptor: EditorDescriptor,
  index: number
): string =>
  descriptor.title ??
  (descriptor.kind === 'literal'
    ? String(descriptor.value)
    : descriptor.kind === 'object'
      ? `Object ${index + 1}`
      : `${descriptor.kind} ${index + 1}`)
