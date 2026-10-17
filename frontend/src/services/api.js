const API_BASE_URL = (
  import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8081/api'
).replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status = 0, code = 'NETWORK_ERROR') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function send(path, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
      cache: 'no-store',
    })
    const body =
      response.status === 204 ? null : await response.json().catch(() => null)
    if (!response.ok) {
      throw new ApiError(
        body?.message ||
          (response.status === 401
            ? 'Please sign in to continue.'
            : 'The request could not be completed.'),
        response.status,
        body?.code || 'REQUEST_FAILED',
      )
    }
    return body
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(
      error.name === 'AbortError'
        ? 'The server took too long to respond. Please try again.'
        : 'Unable to reach FreshMart. Check that the backend is running and try again.',
    )
  } finally {
    clearTimeout(timeout)
  }
}

export async function apiRequest(
  path,
  { method = 'GET', body } = {},
  retryCsrf = true,
) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = await send('/auth/csrf')
    if (!csrf?.token)
      throw new ApiError(
        'The server returned an invalid response. Please check the API address.',
      )
    headers['X-CSRF-TOKEN'] = csrf.token
  }
  try {
    return await send(path, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (retryCsrf && error.code === 'CSRF_INVALID')
      return apiRequest(path, { method, body }, false)
    throw error
  }
}
