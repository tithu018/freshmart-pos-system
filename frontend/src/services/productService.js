import { catalogRequest } from './catalogApi.js'

export const productService = {
  list: (params) => catalogRequest('/products', { params }),
  get: (id) => catalogRequest(`/products/${encodeURIComponent(id)}`),
  save: ({
    id,
    name,
    sku,
    barcode,
    categoryId,
    price,
    description,
    status,
    unit,
    icon,
    color,
  }) =>
    catalogRequest(id ? `/products/${encodeURIComponent(id)}` : '/products', {
      method: id ? 'PUT' : 'POST',
      data: {
        name,
        sku,
        barcode,
        categoryId,
        price: Number(price),
        description,
        status,
        unit,
        icon,
        color,
      },
    }),
  delete: (id) =>
    catalogRequest(`/products/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}
