import type {
  CvSession,
  CvSessionStatus,
} from '@/lib/private-content-session/session'

type VariableMap = Partial<CvSession['private']['variables']>

export type VariableValue = NonNullable<VariableMap[string]>

export type VariableState =
  | {
      status: 'public'
      value: null
    }
  | {
      status: 'pending'
      value: null
    }
  | {
      status: 'resolved'
      value: VariableValue
    }
  | {
      status: 'rejected'
      value: null
    }

type UnresolvedVariableStatus = Exclude<VariableState['status'], 'resolved'>

const unresolvedVariableStatus = (
  status: CvSessionStatus
): UnresolvedVariableStatus =>
  status === 'loading'
    ? 'pending'
    : status === 'invalid' || status === 'unavailable'
      ? 'rejected'
      : 'public'

export const contentVariableState = (
  session: CvSession,
  variable: string
): VariableState => {
  const variables: VariableMap = session.private.variables
  const value = variables[variable]

  if (value !== undefined) {
    return {
      status: 'resolved',
      value,
    }
  }

  return {
    status: unresolvedVariableStatus(session.status),
    value: null,
  }
}
