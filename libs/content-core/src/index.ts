export type { ContentOverlay } from './overlay'
export { applyContentOverlay } from './overlay'
export type {
  ContentFileIndex,
  ContentManifest,
  ContentVariablesSource,
  JsonObject,
  JsonPrimitive,
  JsonValue,
  Locale,
  LocalizedVariableValue,
  ProfileSlug,
  RedactableText,
  RedactedSectionDescriptor,
  VariableLookupDescriptor,
  VariableName,
  VariableUseDescriptor,
  VariableValue,
} from './schema'
export {
  contentFileIndexSchema,
  contentManifestSchema,
  contentManifestSchemaVersion,
  contentVariablesSourceSchema,
  decodeContentManifest,
  decodeContentVariablesSource,
  localeSchema,
  localizedVariableValueSchema,
  profileSlugSchema,
  redactableTextSchema,
  redactedSectionDescriptorSchema,
  variableLookupDescriptorSchema,
  variableNameSchema,
  variableUseDescriptorSchema,
  variableValueSchema,
} from './schema'
export { collectVariableUseDescriptors } from './variables'
