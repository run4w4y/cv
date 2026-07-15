import type { SQLWrapper } from 'drizzle-orm'

/** Scalar values that can participate in a cursor ordering. */
export type CursorScalar = null | string | number | boolean | bigint | Date

/** Runtime type tags supported by the cursor scalar serializer. */
export type CursorValueType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'bigint'
  | 'date'

/** Describes the scalar type and optional nullability of one cursor value. */
export type CursorValueDescriptor =
  | CursorValueType
  | {
      readonly type: CursorValueType
      readonly nullable: boolean
    }

export type SerializedCursorScalar =
  | { readonly type: 'null' }
  | { readonly type: 'string'; readonly value: string }
  | { readonly type: 'number'; readonly value: number }
  | { readonly type: 'boolean'; readonly value: boolean }
  | { readonly type: 'bigint'; readonly value: string }
  | { readonly type: 'date'; readonly value: string }

/**
 * The structured value passed to a cursor codec. Applications should treat its
 * shape as an implementation detail unless they are implementing a signing or
 * encryption codec.
 */
export interface CursorPayload {
  readonly version: number
  readonly query: string
  readonly values: readonly SerializedCursorScalar[]
  /** Optional consumer state carried across every page in one cursor chain. */
  readonly state?: unknown
}

/**
 * A synchronous outer token codec. It can be used to sign or encrypt cursors;
 * scalar serialization and payload validation remain owned by this package.
 */
export interface CursorCodec {
  /** Encodes a validated structured payload into an opaque transport token. */
  readonly encode: (payload: CursorPayload) => string
  /** Decodes an opaque token; the package validates the returned payload. */
  readonly decode: (token: string) => unknown
}

/** Encodes and validates typed consumer state embedded in a cursor payload. */
export interface CursorStateCodec<State> {
  /** Converts typed state into a cursor-payload representation. */
  readonly encode: (state: State) => unknown
  /** Validates and decodes state read from an untrusted cursor token. */
  readonly decode: (encoded: unknown) => State
}

/** Cursor values and consumer state decoded from one continuation token. */
export interface DecodedCursor<State = never> {
  readonly values: readonly CursorScalar[]
  readonly state: State | undefined
}

export interface CursorEncodeOptions<State = never> {
  readonly query: string
  readonly codec?: CursorCodec
  /** Already encoded state used internally by a resolved query. */
  readonly encodedState?: unknown
  readonly state?: State
  readonly stateCodec?: CursorStateCodec<State>
  readonly path?: string
}

export interface CursorDecodeOptions<State = never>
  extends CursorEncodeOptions<State> {
  readonly valueTypes: readonly CursorValueDescriptor[]
}

/** Options for decoding state before validating the state-dependent query id. */
export interface CursorContinuationDecodeOptions<State = never> {
  readonly query: (state: State | undefined) => string
  readonly valueTypes: readonly CursorValueDescriptor[]
  readonly codec?: CursorCodec
  readonly stateCodec?: CursorStateCodec<State>
  readonly path?: string
}

export interface CursorSeekTerm {
  readonly expression: SQLWrapper
  readonly direction: 'asc' | 'desc'
  readonly nulls: 'first' | 'last'
  /** Whether the expression can evaluate to SQL `null`. */
  readonly nullable: boolean
  readonly value: CursorScalar
  /**
   * Maps a logical cursor value to its driver representation. Drizzle columns
   * already apply their own encoder, so this is primarily for computed SQL
   * expressions (for example, a Date expression stored as ISO text).
   */
  readonly encode?: (value: Exclude<CursorScalar, null>) => unknown
}
