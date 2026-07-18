import { describe, expect, test } from 'bun:test'

import {
  decodeBase64Bytes,
  decodeJsonBase64,
  decodeUtf8Base64,
  encodeJsonBase64,
  encodeUtf8Base64,
} from './base64'

describe('opaque browser transport', () => {
  test('round-trips Unicode text without changing bytes', () => {
    const value = 'Résumé · Привет · こんにちは 👋'
    expect(decodeUtf8Base64(encodeUtf8Base64(value))).toBe(value)
  })

  test('decodes opaque binary payloads without UTF-8 conversion', () => {
    expect([...decodeBase64Bytes('AAH+/w==')]).toEqual([0, 1, 254, 255])
  })

  test('round-trips schema-unknown JSON values', () => {
    const value = { arbitrary: [{ nested: true }, 42, null] }
    expect(decodeJsonBase64(encodeJsonBase64(value))).toEqual(value)
  })
})
