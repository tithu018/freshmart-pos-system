// Redux thunk metadata contains its original arguments. Hide credentials from
// development action history without changing the request sent to the API.
export function sanitizeAction(action) {
  if (/^(auth\/login|people\/save)\//.test(action.type) && action.meta?.arg) {
    return { ...action, meta: { ...action.meta, arg: '[REDACTED]' } }
  }
  return action
}
