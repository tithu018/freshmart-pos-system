export const money = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    value,
  )
export const initials = (name) =>
  name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
export const stockStatus = (product) =>
  product.stock === 0
    ? 'Out of Stock'
    : product.stock < product.minStock
      ? 'Low Stock'
      : 'In Stock'
export const saleDate = (date) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
export function downloadCsv(filename, rows) {
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          let text = String(value ?? '')
          if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
          return `"${text.replaceAll('"', '""')}"`
        })
        .join(','),
    )
    .join('\r\n')
  const url = URL.createObjectURL(
    new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8;' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
