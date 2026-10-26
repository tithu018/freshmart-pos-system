import { catalogRequest } from './catalogApi.js'

export const salesService = {
  list: (params) =>
    catalogRequest('/sales', {
      params: Object.fromEntries(
        Object.entries(params || {}).filter(([, value]) => value !== ''),
      ),
    }),
  details: (id) => catalogRequest(`/sales/${encodeURIComponent(id)}`),
  cashiers: () => catalogRequest('/sales/cashiers'),
}
