import { describe, expect, test } from 'bun:test'

import { operationRequestSignature } from './operation-request-signature'

describe('operationRequestSignature', () => {
  test('is stable across object key order and ignores undefined fields', () => {
    const left = operationRequestSignature('test', {
      b: 2,
      nested: { z: true, a: 'value' },
      omitted: undefined,
    })
    const right = operationRequestSignature('test', {
      nested: { a: 'value', z: true },
      b: 2,
    })

    expect(left).toBe(right)
  })

  test('distinguishes different operation requests', () => {
    const left = operationRequestSignature('test', { body: 'first' })
    const right = operationRequestSignature('test', { body: 'second' })

    expect(left).not.toBe(right)
  })
})
