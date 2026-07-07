declare module 'cssesc' {
  export type CssescOptions = {
    escapeEverything?: boolean
    isIdentifier?: boolean
    lowercaseHex?: boolean
    quotes?: 'single' | 'double'
    wrap?: boolean
  }

  const cssesc: (value: string, options?: CssescOptions) => string

  export default cssesc
}
