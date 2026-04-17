export function getRequestErrorMessage(error: unknown) {
  if (typeof error === 'object' && error && 'data' in error) {
    const errorData = (error as { data?: { statusMessage?: string, message?: string } }).data
    return errorData?.statusMessage || errorData?.message || 'Request failed.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Request failed.'
}
