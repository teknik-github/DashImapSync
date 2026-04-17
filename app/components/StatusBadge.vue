<script setup lang="ts">
import { computed } from 'vue'
import type { MigrationRunStatus } from '../../shared/imapsync'

const props = defineProps<{
  status?: MigrationRunStatus | 'idle' | null
}>()

const normalizedStatus = computed(() => props.status ?? 'idle')

const label = computed(() => {
  switch (normalizedStatus.value) {
    case 'queued':
      return 'Queued'
    case 'running':
      return 'Running'
    case 'succeeded':
      return 'Success'
    case 'failed':
      return 'Failed'
    case 'canceled':
      return 'Canceled'
    default:
      return 'Idle'
  }
})

const badgeClass = computed(() => {
  switch (normalizedStatus.value) {
    case 'queued':
      return 'inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200'
    case 'running':
      return 'inline-flex items-center gap-2 rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-200'
    case 'succeeded':
      return 'inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200'
    case 'failed':
      return 'inline-flex items-center gap-2 rounded-full border border-rose-400/25 bg-rose-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-200'
    case 'canceled':
      return 'inline-flex items-center gap-2 rounded-full border border-slate-400/20 bg-slate-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200'
    default:
      return 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300'
  }
})

const dotClass = computed(() => {
  switch (normalizedStatus.value) {
    case 'queued':
      return 'h-1.5 w-1.5 rounded-full bg-amber-300'
    case 'running':
      return 'h-1.5 w-1.5 rounded-full bg-sky-300'
    case 'succeeded':
      return 'h-1.5 w-1.5 rounded-full bg-emerald-300'
    case 'failed':
      return 'h-1.5 w-1.5 rounded-full bg-rose-300'
    case 'canceled':
      return 'h-1.5 w-1.5 rounded-full bg-slate-300'
    default:
      return 'h-1.5 w-1.5 rounded-full bg-slate-400'
  }
})
</script>

<template>
  <span :class="badgeClass">
    <span :class="dotClass" />
    {{ label }}
  </span>
</template>
