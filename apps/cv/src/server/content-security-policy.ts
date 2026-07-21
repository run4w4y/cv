export interface ContentSecurityPolicyOptions {
  readonly development: boolean
  readonly nonce: string
  readonly preview: boolean
}

export const contentSecurityPolicy = ({
  development,
  nonce,
  preview,
}: ContentSecurityPolicyOptions) =>
  [
    "default-src 'none'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      development ? " 'unsafe-eval'" : ''
    }`,
    `style-src 'self'${development ? " 'unsafe-inline'" : ''}`,
    `connect-src ${development ? "'self' ws: wss:" : "'none'"}`,
    'img-src data:',
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    `frame-ancestors ${preview ? '*' : "'none'"}`,
  ].join('; ')
