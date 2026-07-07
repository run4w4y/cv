export const bytes = (value: string) => new TextEncoder().encode(value)

export const text = (value: Uint8Array) => new TextDecoder().decode(value)
