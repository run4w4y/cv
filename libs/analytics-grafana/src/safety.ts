const privateTokenQueryPattern = /[?&#]p=/u
const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu
const ipv4Pattern = /\b(?:\d{1,3}\.){3}\d{1,3}\b/u

export const assertGrafanaRowsSafe = <Rows>(rows: Rows): Rows => {
  const serialized = JSON.stringify(rows)

  if (privateTokenQueryPattern.test(serialized)) {
    throw new Error('Grafana analytics rows contain a private content token')
  }

  if (emailPattern.test(serialized) || ipv4Pattern.test(serialized)) {
    throw new Error('Grafana analytics rows contain raw personal identifiers')
  }

  return rows
}
