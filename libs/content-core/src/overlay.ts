export type ContentOverlay = Record<string, unknown>

const isPlainRecord = (value: unknown): value is Record<PropertyKey, unknown> =>
  Object.prototype.toString.call(value) === '[object Object]'

const cloneContentValue = <Value>(value: Value): Value =>
  structuredClone(value) as Value

const mergeOverlayValue = (targetValue: unknown, sourceValue: unknown) => {
  if (sourceValue === undefined) {
    return cloneContentValue(targetValue)
  }

  if (Array.isArray(sourceValue)) {
    return cloneContentValue(sourceValue)
  }

  if (!isPlainRecord(targetValue) || !isPlainRecord(sourceValue)) {
    return cloneContentValue(sourceValue)
  }

  const merged: Record<PropertyKey, unknown> = {
    ...cloneContentValue(targetValue),
  }

  for (const [key, value] of Object.entries(sourceValue)) {
    merged[key] = mergeOverlayValue(merged[key], value)
  }

  return merged
}

export const applyContentOverlay = <Content>(
  content: Content,
  overlay: ContentOverlay | undefined
): Content => {
  if (!overlay) {
    return content
  }

  return mergeOverlayValue(content, overlay) as Content
}
