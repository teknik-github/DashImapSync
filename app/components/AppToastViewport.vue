<script setup lang="ts">
import { computed } from 'vue'
import type { ToastItem } from '../composables/useToast'
import { useToast } from '../composables/useToast'

const { toasts, removeToast } = useToast()

function getToastCardClass(toast: ToastItem) {
  switch (toast.tone) {
    case 'success':
      return 'border-emerald-400/20 bg-[linear-gradient(180deg,rgba(7,48,44,0.94),rgba(5,28,30,0.96))] text-emerald-50 ring-emerald-400/10'
    case 'error':
      return 'border-rose-400/20 bg-[linear-gradient(180deg,rgba(65,19,35,0.94),rgba(30,12,22,0.96))] text-rose-50 ring-rose-400/10'
    default:
      return 'border-sky-400/20 bg-[linear-gradient(180deg,rgba(18,28,49,0.94),rgba(11,18,34,0.96))] text-slate-50 ring-white/10'
  }
}

function getToastIconWrapClass(toast: ToastItem) {
  switch (toast.tone) {
    case 'success':
      return 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/15'
    case 'error':
      return 'bg-rose-400/10 text-rose-200 ring-rose-400/15'
    default:
      return 'bg-sky-400/10 text-sky-200 ring-sky-400/15'
  }
}

const orderedToasts = computed(() => [...toasts.value].reverse())
</script>

<template>
  <div class="pointer-events-none fixed right-4 top-20 z-50 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3 sm:right-6 xl:right-10 2xl:right-14">
    <TransitionGroup
      enter-active-class="transition duration-300 ease-[cubic-bezier(0.18,0.89,0.32,1.15)]"
      enter-from-class="translate-x-4 -translate-y-1 scale-[0.96] opacity-0"
      enter-to-class="translate-x-0 translate-y-0 scale-100 opacity-100"
      leave-active-class="transition duration-250 ease-in"
      leave-from-class="translate-x-0 translate-y-0 scale-100 opacity-100"
      leave-to-class="translate-x-3 -translate-y-1 scale-[0.97] opacity-0"
      move-class="transition duration-250 ease-out"
      tag="div"
      class="flex flex-col gap-3"
    >
      <button
        v-for="toast in orderedToasts"
        :key="toast.id"
        :class="['pointer-events-auto relative overflow-hidden flex items-start gap-3 rounded-[1.35rem] border px-3.5 py-3 text-left shadow-[0_22px_50px_rgba(2,6,23,0.36)] ring-1 backdrop-blur-2xl transition hover:-translate-y-0.5', getToastCardClass(toast)]"
        type="button"
        @click="removeToast(toast.id)"
      >
        <span :class="['mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.95rem] ring-1', getToastIconWrapClass(toast)]">
          <AppIcon :class="toast.tone === 'success' ? 'h-4 w-4' : 'h-4 w-4'" :name="toast.tone === 'success' ? 'check' : toast.tone === 'error' ? 'alert' : 'terminal'" />
        </span>

        <span class="min-w-0">
          <span v-if="toast.title" class="block text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
            {{ toast.title }}
          </span>
          <span class="mt-1 block text-sm font-medium leading-5 text-white">
            {{ toast.message }}
          </span>
        </span>

        <span class="absolute inset-x-0 bottom-0 h-px bg-white/6">
          <span class="toast-progress absolute inset-y-0 right-0 bg-current/70" :style="{ animationDuration: `${toast.durationMs}ms` }" />
        </span>
      </button>
    </TransitionGroup>
  </div>
</template>

<style scoped>
@keyframes toast-progress {
  from {
    width: 100%;
  }

  to {
    width: 0%;
  }
}

.toast-progress {
  animation-name: toast-progress;
  animation-timing-function: linear;
  animation-fill-mode: forwards;
}
</style>
