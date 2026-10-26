export function reportParams(period, from, to) {
  return period === 'custom' ? { period, from, to } : { period }
}
export function rangeError(from, to) {
  if (!from || !to) return 'Choose both a start and end date.'
  if (from > to) return 'Start date must be on or before end date.'
  if (
    (new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000 >
    365
  )
    return 'Choose a range covering at most 366 days.'
  return ''
}
export function saveReportCsv(csv, from, to) {
  const url = URL.createObjectURL(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = `freshmart-report-${from}-${to}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
