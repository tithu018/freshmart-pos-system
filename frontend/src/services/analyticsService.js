import { catalogRequest } from './catalogApi.js'

export const analyticsService = {
  dashboard: ({ role, period }) =>
    catalogRequest(`/${role}/dashboard`, { params: { period } }),
  report: (params) => catalogRequest('/admin/reports', { params }),
  csv: (params) => catalogRequest('/admin/reports/csv', { params }),
}
