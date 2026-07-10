import { describe, expect, test } from 'bun:test'
import { getPrivateAudienceCvUrlFromBase } from './web-cv'

describe('web CV URLs', () => {
  test('builds private audience URLs from a deployed base with a path prefix', () => {
    expect(
      getPrivateAudienceCvUrlFromBase(
        'https://run4w4y.github.io/cv/',
        'en',
        'rec2KX3dr4r2CoGiFgsPtNLpBRwX4U0hBcU',
        'token-value'
      )
    ).toBe(
      'https://run4w4y.github.io/cv/en/a/rec2KX3dr4r2CoGiFgsPtNLpBRwX4U0hBcU/?p=token-value'
    )
  })

  test('encodes audience path segments and token query parameters', () => {
    expect(
      getPrivateAudienceCvUrlFromBase(
        'https://cv.example.invalid/',
        'ru',
        'Hiring Team/Backend',
        'token/value?yes'
      )
    ).toBe(
      'https://cv.example.invalid/ru/a/Hiring%20Team%2FBackend/?p=token%2Fvalue%3Fyes'
    )
  })
})
