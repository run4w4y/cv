export const requireField = <T>(value: T | undefined, path: string): T => {
  if (value === undefined) {
    throw new Error(`Missing required content field: ${path}`)
  }

  return value
}
