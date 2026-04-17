type ToastTone = 'success' | 'error' | 'info'

interface ToastPayload {
  title?: string
  message: string
  tone?: ToastTone
  durationMs?: number
}

export interface ToastItem {
  id: string
  title?: string
  message: string
  tone: ToastTone
  durationMs: number
}

let toastCounter = 0

export function useToastState() {
  return useState<ToastItem[]>('app-toasts', () => [])
}

export function useToast() {
  const toasts = useToastState()

  function removeToast(id: string) {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function showToast(payload: ToastPayload) {
    const id = `${Date.now()}-${toastCounter += 1}`
    const durationMs = payload.durationMs ?? 3600
    const toast: ToastItem = {
      id,
      title: payload.title,
      message: payload.message,
      tone: payload.tone ?? 'info',
      durationMs,
    }

    toasts.value = [...toasts.value, toast]

    if (import.meta.client) {
      const timeout = window.setTimeout(() => {
        removeToast(id)
      }, durationMs)

      return {
        id,
        timeout,
      }
    }

    return { id }
  }

  function showSuccess(message: string, title = 'Success') {
    return showToast({ message, title, tone: 'success', durationMs: 3200 })
  }

  function showError(message: string, title = 'Error') {
    return showToast({ message, title, tone: 'error', durationMs: 5200 })
  }

  function showInfo(message: string, title = 'Info') {
    return showToast({ message, title, tone: 'info', durationMs: 3600 })
  }

  return {
    toasts,
    removeToast,
    showToast,
    showSuccess,
    showError,
    showInfo,
  }
}
