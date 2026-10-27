import axios from 'axios'
import { ApiError } from './api.js'

// Use Task 3's HttpOnly cookie and CSRF contract without changing auth requests.
export const catalogClient = axios.create({
  baseURL: (
    import.meta.env?.VITE_API_BASE_URL || 'http://localhost:8081/api'
  ).replace(/\/$/, ''),
  withCredentials: true,
  timeout: 10000,
})

export async function catalogRequest(
  url,
  { method = 'GET', data, params } = {},
  retry = true,
) {
  try {
    const headers = {}
    if (!['GET', 'HEAD'].includes(method)) {
      const csrf = await catalogClient.get('/auth/csrf')
      if (!csrf.data?.token)
        throw new ApiError('Unable to verify this request. Please try again.')
      headers['X-CSRF-TOKEN'] = csrf.data.token
    }
    const response = await catalogClient.request({
      url,
      method,
      data,
      params,
      headers,
    })
    return response.data
  } catch (error) {
    if (retry && error.response?.data?.code === 'CSRF_INVALID')
      return catalogRequest(url, { method, data, params }, false)
    if (error instanceof ApiError) throw error
    const status = error.response?.status || 0
    throw new ApiError(
      error.response?.data?.message ||
        (status === 401
          ? 'Please sign in to continue.'
          : status === 403
            ? 'You do not have permission to perform this action.'
            : status
              ? 'The request could not be completed. Please try again.'
              : 'Unable to reach FreshMart. Please check your connection and try again.'),
      status,
      error.response?.data?.code || 'REQUEST_FAILED',
    )
  }
}
