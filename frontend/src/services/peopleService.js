import { catalogRequest } from './catalogApi.js'

const params = (values) =>
  Object.fromEntries(
    Object.entries(values || {}).filter(
      ([, value]) => value !== '' && value !== undefined,
    ),
  )
export const peopleService = {
  employees: (filters) =>
    catalogRequest('/admin/employees', { params: params(filters) }),
  customers: (filters) =>
    catalogRequest('/admin/customers', { params: params(filters) }),
  lookup: (q) => catalogRequest('/pos/customers', { params: { q } }),
  history: ({ id, ...filters }) =>
    catalogRequest(`/admin/customers/${encodeURIComponent(id)}/sales`, {
      params: filters,
    }),
  save: ({ type, person }) => {
    const data = {
      name: person.name.trim(),
      phone: person.phone.trim(),
      email: person.email?.trim() || '',
      enabled: person.enabled,
    }
    if (type === 'employees') {
      data.role = person.role
      if (person.password) data.password = person.password
    }
    return catalogRequest(
      `/admin/${type}${person.id ? `/${encodeURIComponent(person.id)}` : ''}`,
      { method: person.id ? 'PUT' : 'POST', data },
    )
  },
  profile: ({ name, phone }) =>
    catalogRequest('/profile', {
      method: 'PUT',
      data: { name: name.trim(), phone: phone.trim() },
    }),
}
