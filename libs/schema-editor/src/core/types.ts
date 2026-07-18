export type JsonPrimitive = string | number | boolean | null

export type JsonValue =
  | JsonPrimitive
  | ReadonlyArray<JsonValue>
  | { readonly [key: string]: JsonValue }

export interface DescriptorMetadata {
  readonly title?: string
  readonly description?: string
  readonly documentation?: string
  readonly defaultValue?: JsonValue
  readonly examples?: ReadonlyArray<JsonValue>
  readonly expected?: string
  readonly format?: string
  /** True when Effect checks refine the represented primitive or container. */
  readonly checked: boolean
  /** True when the schema's decoded representation differs from its wire form. */
  readonly encoded: boolean
}

export interface StringDescriptor extends DescriptorMetadata {
  readonly kind: 'string'
}

export interface NumberDescriptor extends DescriptorMetadata {
  readonly kind: 'number'
}

export interface BooleanDescriptor extends DescriptorMetadata {
  readonly kind: 'boolean'
}

export interface LiteralDescriptor extends DescriptorMetadata {
  readonly kind: 'literal'
  readonly value: JsonPrimitive
}

export interface ChoiceDescriptor extends DescriptorMetadata {
  readonly kind: 'choice'
  readonly values: ReadonlyArray<JsonPrimitive>
}

export interface NullableDescriptor extends DescriptorMetadata {
  readonly kind: 'nullable'
  readonly value: EditorDescriptor
}

export interface ArrayDescriptor extends DescriptorMetadata {
  readonly kind: 'array'
  readonly item: EditorDescriptor
}

export interface ObjectFieldDescriptor {
  readonly key: string
  readonly pointer: string
  readonly optional: boolean
  readonly descriptor: EditorDescriptor
}

export interface ObjectDescriptor extends DescriptorMetadata {
  readonly kind: 'object'
  readonly fields: ReadonlyArray<ObjectFieldDescriptor>
}

export interface UnionOptionDescriptor {
  readonly id: string
  readonly label: string
  readonly descriptor: EditorDescriptor
}

export interface UnionDescriptor extends DescriptorMetadata {
  readonly kind: 'union'
  readonly mode: 'anyOf' | 'oneOf'
  readonly options: ReadonlyArray<UnionOptionDescriptor>
}

/** Contract consumed by a raw-JSON editor when structural editing is unsafe. */
export interface RawDescriptor extends DescriptorMetadata {
  readonly kind: 'raw'
  readonly astTag: string
  readonly reason: string
  readonly expected?: string
}

export type EditorDescriptor =
  | StringDescriptor
  | NumberDescriptor
  | BooleanDescriptor
  | LiteralDescriptor
  | ChoiceDescriptor
  | NullableDescriptor
  | ArrayDescriptor
  | ObjectDescriptor
  | UnionDescriptor
  | RawDescriptor

export interface UnsupportedNode {
  readonly pointer: string
  readonly astTag: string
  readonly reason: string
}

export interface SchemaInspection {
  readonly descriptor: EditorDescriptor
  readonly unsupported: ReadonlyArray<UnsupportedNode>
  readonly structurallyEditable: boolean
}

export interface ValidationIssue {
  readonly pointer: string
  readonly path: ReadonlyArray<string | number>
  readonly message: string
}

export type ValidationResult<A = unknown> =
  | {
      readonly valid: true
      readonly value: A
      readonly issues: readonly []
    }
  | {
      readonly valid: false
      readonly issues: ReadonlyArray<ValidationIssue>
    }

export type RawJsonResult =
  | { readonly valid: true; readonly value: unknown }
  | { readonly valid: false; readonly message: string }
