import { isPlainObject } from 'es-toolkit/predicate'
import { QueryError } from '../error'

import { defaultCursorCodec } from './codec'
import { CURSOR_VERSION } from './constants'
import { cursorError } from './errors'
import {
  deserializeCursorScalar,
  isSerializedCursorScalar,
  matchesDescriptor,
  serializeCursorScalar,
} from './scalars'
import type {
  CursorContinuationDecodeOptions,
  CursorDecodeOptions,
  CursorEncodeOptions,
  CursorPayload,
  CursorScalar,
  CursorStateCodec,
  CursorValueDescriptor,
  DecodedCursor,
} from './types'

/** Validates known ordering values before using them as a cursor start. */
export const resolveCursorValues = (
  values: readonly unknown[],
  descriptors: readonly CursorValueDescriptor[],
  path = 'cursor'
): readonly CursorScalar[] => {
  if (values.length !== descriptors.length) {
    throw cursorError(
      'cursor-mismatch',
      'The cursor values do not match the active ordering.',
      path
    )
  }

  return values.map((value, index) => {
    const serialized = serializeCursorScalar(value, `${path}.values[${index}]`)
    const descriptor = descriptors[index]
    if (
      descriptor === undefined ||
      !matchesDescriptor(serialized, descriptor)
    ) {
      throw cursorError(
        'cursor-mismatch',
        'The cursor values do not match the active ordering.',
        `${path}.values[${index}]`
      )
    }
    return deserializeCursorScalar(serialized)
  })
}

const parsePayload = (decoded: unknown, path?: string): CursorPayload => {
  if (
    !isPlainObject(decoded) ||
    typeof decoded.version !== 'number' ||
    !Number.isSafeInteger(decoded.version) ||
    typeof decoded.query !== 'string' ||
    !Array.isArray(decoded.values)
  ) {
    throw cursorError(
      'invalid-cursor',
      'The cursor payload has an invalid shape.',
      path
    )
  }

  if (!decoded.values.every(isSerializedCursorScalar)) {
    throw cursorError(
      'invalid-cursor',
      'The cursor payload contains an invalid value.',
      path
    )
  }

  return {
    version: decoded.version,
    query: decoded.query,
    values: decoded.values,
    ...('state' in decoded ? { state: decoded.state } : {}),
  }
}

const decodeState = <State>(
  payload: CursorPayload,
  codec: CursorStateCodec<State> | undefined,
  path?: string
): State | undefined => {
  if (codec === undefined) {
    if ('state' in payload) {
      throw cursorError(
        'cursor-mismatch',
        'The cursor carries state that this query does not accept.',
        path
      )
    }
    return undefined
  }

  if (!('state' in payload)) {
    throw cursorError(
      'cursor-mismatch',
      'The cursor is missing the state required by this query.',
      path
    )
  }

  try {
    return codec.decode(payload.state)
  } catch (cause) {
    if (cause instanceof QueryError) throw cause
    throw cursorError(
      'invalid-cursor',
      'The cursor state is malformed.',
      path,
      cause
    )
  }
}

const validatePayload = <State>(
  payload: CursorPayload,
  state: State | undefined,
  options: CursorContinuationDecodeOptions<State>
): CursorPayload => {
  if (
    payload.version !== CURSOR_VERSION ||
    payload.query !== options.query(state)
  ) {
    throw cursorError(
      'cursor-mismatch',
      'The cursor belongs to a different query version or query.',
      options.path
    )
  }

  if (
    payload.values.length !== options.valueTypes.length ||
    payload.values.some((value, index) => {
      const descriptor = options.valueTypes[index]
      return descriptor === undefined || !matchesDescriptor(value, descriptor)
    })
  ) {
    throw cursorError(
      'cursor-mismatch',
      'The cursor values do not match the active ordering.',
      options.path
    )
  }

  return {
    version: payload.version,
    query: payload.query,
    values: payload.values,
    ...('state' in payload ? { state: payload.state } : {}),
  }
}

export const encodeCursor = <State = never>(
  values: readonly unknown[],
  options: CursorEncodeOptions<State>
): string => {
  let encodedState: unknown
  const hasEncodedState = 'encodedState' in options
  if (hasEncodedState) {
    encodedState = options.encodedState
  } else if (options.stateCodec !== undefined) {
    if (options.state === undefined) {
      throw cursorError(
        'invalid-cursor',
        'Cursor state is required by this query.',
        options.path
      )
    }
    try {
      encodedState = options.stateCodec.encode(options.state)
    } catch (cause) {
      if (cause instanceof QueryError) throw cause
      throw cursorError(
        'invalid-cursor',
        'Could not encode the cursor state.',
        options.path,
        cause
      )
    }
  }

  const payload: CursorPayload = {
    version: CURSOR_VERSION,
    query: options.query,
    values: values.map((value, index) =>
      serializeCursorScalar(
        value,
        `${options.path ?? 'cursor'}.values[${index}]`
      )
    ),
    ...(!hasEncodedState && options.stateCodec === undefined
      ? {}
      : { state: encodedState }),
  }

  let token: string
  try {
    token = (options.codec ?? defaultCursorCodec).encode(payload)
  } catch (cause) {
    if (cause instanceof QueryError) {
      throw cause
    }
    throw cursorError(
      'invalid-cursor',
      'Could not encode the cursor.',
      options.path,
      cause
    )
  }

  if (token.length === 0) {
    throw cursorError(
      'invalid-cursor',
      'The encoded cursor is empty.',
      options.path
    )
  }

  return token
}

export const decodeCursorContinuation = <State = never>(
  token: string,
  options: CursorContinuationDecodeOptions<State>
): DecodedCursor<State> => {
  if (token.length === 0) {
    throw cursorError('invalid-cursor', 'The cursor is empty.', options.path)
  }

  let decoded: unknown
  try {
    decoded = (options.codec ?? defaultCursorCodec).decode(token)
  } catch (cause) {
    if (cause instanceof QueryError) {
      throw cause
    }
    throw cursorError(
      'invalid-cursor',
      'The cursor is malformed.',
      options.path,
      cause
    )
  }

  const parsed = parsePayload(decoded, options.path)
  const state = decodeState(parsed, options.stateCodec, options.path)
  const payload = validatePayload(parsed, state, options)
  return {
    values: payload.values.map(deserializeCursorScalar),
    state,
  }
}

export const decodeCursor = <State = never>(
  token: string,
  options: CursorDecodeOptions<State>
): readonly CursorScalar[] =>
  decodeCursorContinuation(token, {
    query: () => options.query,
    valueTypes: options.valueTypes,
    ...(options.codec === undefined ? {} : { codec: options.codec }),
    ...(options.stateCodec === undefined
      ? {}
      : { stateCodec: options.stateCodec }),
    ...(options.path === undefined ? {} : { path: options.path }),
  }).values
