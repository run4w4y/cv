import { createHash } from 'node:crypto'

const digest = (salt: string, namespace: string, value: string) =>
  createHash('sha256')
    .update(salt)
    .update('\0')
    .update(namespace)
    .update('\0')
    .update(value)
    .digest('base64url')
    .slice(0, 18)

export const mangleContentId = ({
  namespace,
  prefix,
  salt,
  value,
}: {
  namespace: string
  prefix: string
  salt: string
  value: string
}) => `${prefix}_${digest(salt, namespace, value)}`

export const mangleProfileId = (profile: string, salt: string) =>
  mangleContentId({
    namespace: 'profile',
    prefix: 'p',
    salt,
    value: profile,
  })
