import { apiRequest, ApiError } from './api.js'

function sessionFromResponse(response) {
  const role = { ADMIN: 'admin', CASHIER: 'cashier' }[response?.user?.role]
  if (
    !role ||
    !response.user.id ||
    !Number.isFinite(Date.parse(response.expiresAt))
  ) {
    throw new ApiError(
      'Your account has an unsupported role or invalid session. Please contact your administrator.',
      403,
      'INVALID_SESSION',
    )
  }
  // Preserve Task 2's lowercase route names; permissions always come from the server.
  return { user: { ...response.user, role }, expiresAt: response.expiresAt }
}

export const authService = {
  async login({ email, password }) {
    return sessionFromResponse(
      await apiRequest('/auth/login', {
        method: 'POST',
        body: { email: email.trim(), password },
      }),
    )
  },
  async me() {
    return sessionFromResponse(await apiRequest('/auth/me'))
  },
  async logout() {
    await apiRequest('/auth/logout', { method: 'POST' })
  },
}
