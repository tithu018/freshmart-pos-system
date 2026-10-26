import { catalogRequest } from './catalogApi.js'
import { ApiError } from './api.js'

const storageKey = (userId) => `freshmart.checkout.${userId}`
export const checkoutService = {
  products: () => catalogRequest('/pos/products'),
  config: () => catalogRequest('/pos/config'),
  checkout: (request) =>
    catalogRequest('/checkout', { method: 'POST', data: request }),
}

// Preserve only the in-flight order, never credentials or card details.
// Retries after refresh use the original key and payload.
export function savePendingCheckout(userId, snapshot) {
  try {
    globalThis.sessionStorage.setItem(
      storageKey(userId),
      JSON.stringify(snapshot),
    )
  } catch {
    throw new ApiError(
      'Allow session storage in this browser before completing checkout.',
      400,
      'STORAGE_UNAVAILABLE',
    )
  }
}
export function readPendingCheckout(userId) {
  try {
    const saved = JSON.parse(
      globalThis.sessionStorage.getItem(storageKey(userId)),
    )
    return saved?.request?.idempotencyKey && Array.isArray(saved.items)
      ? saved
      : null
  } catch {
    return null
  }
}
export function clearPendingCheckout(userId) {
  try {
    globalThis.sessionStorage.removeItem(storageKey(userId))
  } catch {
    /* A replay remains safe. */
  }
}
