export const paymentLabel = (method) =>
  method === 'CARD' ? 'Card (simulated)' : 'Cash'
export function salesDate(date, timeZone = 'Asia/Colombo') {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date))
}
export function salesPeriod(
  period,
  timeZone = 'Asia/Colombo',
  now = new Date(),
) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  )
  const to = `${parts.year}-${parts.month}-${parts.day}`
  const start = new Date(`${to}T00:00:00Z`)
  if (period === 'week')
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7))
  return { from: start.toISOString().slice(0, 10), to }
}
