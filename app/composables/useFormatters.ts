export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '-'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function formatDuration(start: string | null | undefined, end?: string | null) {
  if (!start) {
    return '-'
  }

  const startAt = new Date(start).getTime()
  const endAt = end ? new Date(end).getTime() : Date.now()

  if (Number.isNaN(startAt) || Number.isNaN(endAt)) {
    return '-'
  }

  const totalSeconds = Math.max(0, Math.floor((endAt - startAt) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts = [hours ? `${hours}j` : null, minutes ? `${minutes}m` : null, `${seconds}d`].filter(Boolean)

  return parts.join(' ')
}
