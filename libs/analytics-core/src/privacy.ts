export const tokenPattern = /[?&#]p=[A-Za-z0-9_-]+/u
export const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu
export const ipv4Pattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/u

export const unsafePersonalIdentifierPattern = new RegExp(
  `${emailPattern.source}|${ipv4Pattern.source}`,
  'iu'
)

export const assertSafeString = (value: string, label: string) => {
  if (
    tokenPattern.test(value) ||
    emailPattern.test(value) ||
    ipv4Pattern.test(value)
  ) {
    throw new Error(`Analytics data contains unsafe ${label}`)
  }
}

export const hasPrivateContentToken = (value: string) =>
  tokenPattern.test(value) || /[?&#]p=/u.test(value)

export const hasRawPersonalIdentifier = (value: string) =>
  unsafePersonalIdentifierPattern.test(value)

export const isUnsafeDimensionValue = (value: string) =>
  tokenPattern.test(value) || emailPattern.test(value)
