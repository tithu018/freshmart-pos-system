import { catalogRequest } from './catalogApi.js'

export const inventoryService = {
  list: (params) => catalogRequest('/inventory', { params }),
  summary: () => catalogRequest('/inventory/summary'),
  history: (productId) =>
    catalogRequest('/inventory/movements', {
      params: productId ? { productId } : {},
    }),
  adjust: ({ id, type, quantity, reason }) =>
    catalogRequest(`/inventory/${encodeURIComponent(id)}/movements`, {
      method: 'POST',
      data: { type, quantity: Number(quantity), reason },
    }),
  threshold: ({ id, minStock }) =>
    catalogRequest(`/inventory/${encodeURIComponent(id)}/threshold`, {
      method: 'PUT',
      data: { minStock: Number(minStock) },
    }),
}
