export const maybeString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined
