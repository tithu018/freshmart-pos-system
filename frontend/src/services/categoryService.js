import { catalogRequest } from './catalogApi.js'

export const categoryService = {
  list: (params) => catalogRequest('/categories', { params }),
  get: (id) => catalogRequest(`/categories/${encodeURIComponent(id)}`),
  save: ({ id, name, description, status, icon, color }) =>
    catalogRequest(
      id ? `/categories/${encodeURIComponent(id)}` : '/categories',
      {
        method: id ? 'PUT' : 'POST',
        data: { name, description, status, icon, color },
      },
    ),
  delete: (id) =>
    catalogRequest(`/categories/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
}
