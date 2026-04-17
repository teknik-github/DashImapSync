<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { MigrationRunDetail, MigrationRunSummary } from '../../shared/imapsync'
import { formatDateTime, formatDuration } from '../composables/useFormatters'
import { getRequestErrorMessage } from '../composables/useRequestError'
import { useToast } from '../composables/useToast'

const props = defineProps<{
  runId: string | null
  title?: string
  description?: string
  panelClass?: string
  consoleClass?: string
}>()

const run = ref<MigrationRunDetail | null>(null)
const loading = ref(false)
const errorMessage = ref<string | null>(null)
const streamState = ref<'idle' | 'connecting' | 'live'>('idle')
const consoleElement = ref<HTMLElement | null>(null)
const lastRunErrorKey = ref('')
const { showError } = useToast()

let eventSource: EventSource | null = null
let requestId = 0

const streamBadgeClass = computed(() => {
  switch (streamState.value) {
    case 'live':
      return 'inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200'
    case 'connecting':
      return 'inline-flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200'
    default:
      return 'inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300'
  }
})

function getStreamLabel() {
  if (streamState.value === 'live') {
    return 'Live'
  }

  if (streamState.value === 'connecting') {
    return 'Reconnecting'
  }

  return 'Stopped'
}

const batchProgressLabel = computed(() => {
  if (!run.value || run.value.batchTotalItems <= 1) {
    return null
  }

  return `${run.value.batchCompletedItems}/${run.value.batchTotalItems} completed`
})

const summaryGridClass = computed(() => {
  return batchProgressLabel.value
    ? 'mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-5'
    : 'mt-4 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4'
})

function getLogLineClass(stream: MigrationRunDetail['logs'][number]['stream']) {
  switch (stream) {
    case 'stderr':
      return 'grid gap-2 rounded-2xl border border-rose-400/15 bg-rose-500/5 px-4 py-3 text-xs sm:grid-cols-[150px_70px_minmax(0,1fr)] sm:items-start sm:gap-4'
    case 'system':
      return 'grid gap-2 rounded-2xl border border-violet-400/15 bg-violet-500/5 px-4 py-3 text-xs sm:grid-cols-[150px_70px_minmax(0,1fr)] sm:items-start sm:gap-4'
    default:
      return 'grid gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-xs sm:grid-cols-[150px_70px_minmax(0,1fr)] sm:items-start sm:gap-4'
  }
}

function getLogMessageClass(stream: MigrationRunDetail['logs'][number]['stream']) {
  switch (stream) {
    case 'stderr':
      return 'whitespace-pre-wrap break-words font-mono text-rose-100'
    case 'system':
      return 'whitespace-pre-wrap break-words font-mono text-violet-100'
    default:
      return 'whitespace-pre-wrap break-words font-mono text-slate-100'
  }
}

function closeStream() {
  eventSource?.close()
  eventSource = null
  streamState.value = 'idle'
}

function syncRunSummary(summary: MigrationRunSummary) {
  if (!run.value) {
    return
  }

  run.value = {
    ...run.value,
    ...summary,
  }
}

function scrollToBottom() {
  nextTick(() => {
    consoleElement.value?.scrollTo({
      top: consoleElement.value.scrollHeight,
      behavior: 'smooth',
    })
  })
}

function openStream(runId: string) {
  if (!import.meta.client) {
    return
  }

  closeStream()
  streamState.value = 'connecting'

  const source = new EventSource(`/api/runs/${runId}/stream`)
  eventSource = source

  source.addEventListener('snapshot', (event) => {
    const payload = JSON.parse((event as MessageEvent).data) as { run: MigrationRunDetail }
    run.value = payload.run
    errorMessage.value = null
    streamState.value = ['queued', 'running'].includes(payload.run.status) ? 'live' : 'idle'
    scrollToBottom()
  })

  source.addEventListener('log', (event) => {
    const payload = JSON.parse((event as MessageEvent).data) as MigrationRunDetail['logs'][number]

    if (!run.value) {
      return
    }

    run.value.logs = [...run.value.logs, payload].slice(-500)
    scrollToBottom()
  })

  source.addEventListener('status', (event) => {
    const payload = JSON.parse((event as MessageEvent).data) as MigrationRunSummary
    syncRunSummary(payload)

    if (!['queued', 'running'].includes(payload.status)) {
      closeStream()
    }
  })

  source.onerror = () => {
    if (run.value && ['queued', 'running'].includes(run.value.status)) {
      streamState.value = 'connecting'
      return
    }

    closeStream()
  }
}

async function loadRun(runId: string) {
  loading.value = true
  errorMessage.value = null
  const currentRequestId = ++requestId

  try {
    const response = await $fetch<{ run: MigrationRunDetail }>(`/api/runs/${runId}`)

    if (currentRequestId !== requestId) {
      return
    }

    run.value = response.run

    if (['queued', 'running'].includes(response.run.status)) {
      openStream(runId)
    }
    else {
      closeStream()
    }

    scrollToBottom()
  }
  catch (error) {
    if (currentRequestId !== requestId) {
      return
    }

    run.value = null
    errorMessage.value = getRequestErrorMessage(error)
    showError(errorMessage.value, 'Log panel')
    closeStream()
  }
  finally {
    if (currentRequestId === requestId) {
      loading.value = false
    }
  }
}

watch(
  () => props.runId,
  (runId) => {
    closeStream()
    lastRunErrorKey.value = ''

    if (!import.meta.client) {
      return
    }

    if (!runId) {
      run.value = null
      errorMessage.value = null
      loading.value = false
      return
    }

    void loadRun(runId)
  },
  { immediate: true },
)

watch(
  () => {
    if (!run.value?.id || !run.value.errorMessage) {
      return ''
    }

    return `${run.value.id}:${run.value.errorMessage}`
  },
  (value) => {
    if (!value || value === lastRunErrorKey.value || !run.value?.errorMessage) {
      return
    }

    lastRunErrorKey.value = value
    showError(run.value.errorMessage, 'Run error')
  },
)

onBeforeUnmount(() => {
  closeStream()
})
</script>

<template>
  <section :class="['rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.7),rgba(11,18,34,0.84))] px-5 pb-6 pt-5 shadow-[0_24px_70px_rgba(2,6,23,0.42)] ring-1 ring-white/5 backdrop-blur-2xl', props.panelClass || '']">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div class="flex items-start gap-3">
        <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/15">
          <AppIcon class="h-5 w-5" name="terminal" />
        </span>
        <div class="space-y-1">
          <h2 class="text-lg font-semibold text-white">
            {{ props.title || 'Run detail' }}
          </h2>
          <p class="text-sm text-slate-400">
            {{ props.description || 'Live log, status, dan metadata eksekusi untuk run terpilih.' }}
          </p>
        </div>
      </div>

      <span :class="streamBadgeClass">
        <span class="h-1.5 w-1.5 rounded-full bg-current" />
        {{ getStreamLabel() }}
      </span>
    </div>

    <div
      v-if="!runId"
      class="mt-5 rounded-3xl border border-dashed border-white/10 bg-slate-950/50 px-6 py-10 text-center text-sm text-slate-400"
    >
      Pilih salah satu run untuk melihat log eksekusi.
    </div>

    <div
      v-else-if="loading"
      class="mt-5 rounded-3xl border border-dashed border-white/10 bg-slate-950/50 px-6 py-10 text-center text-sm text-slate-400"
    >
      Memuat detail run...
    </div>

    <div
      v-else-if="errorMessage"
      class="mt-5 rounded-3xl border border-dashed border-white/10 bg-slate-950/50 px-6 py-10 text-center text-sm text-slate-400"
    >
      Detail run tidak tersedia. Lihat notifikasi di pojok kanan atas untuk pesan error.
    </div>

    <template v-else-if="run">
      <div :class="summaryGridClass">
        <div class="rounded-[1.15rem] border border-white/10 bg-slate-950/60 px-3.5 py-3">
          <span class="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3 w-3" name="alert" />Status</span>
          <p class="mt-1.5 text-[14px] font-semibold text-white">
            {{ run.status }}
          </p>
        </div>
        <div v-if="batchProgressLabel" class="rounded-[1.15rem] border border-white/10 bg-slate-950/60 px-3.5 py-3">
          <span class="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3 w-3" name="folder" />Batch progress</span>
          <p class="mt-1.5 text-[14px] font-semibold text-white">
            {{ batchProgressLabel }}
          </p>
          <p v-if="run.batchFailedItems" class="mt-0.5 text-[11px] text-rose-200">
            {{ run.batchFailedItems }} failed
          </p>
        </div>
        <div class="rounded-[1.15rem] border border-white/10 bg-slate-950/60 px-3.5 py-3">
          <span class="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3 w-3" name="clock" />Started</span>
          <p class="mt-1.5 text-[14px] font-semibold text-white">
            {{ formatDateTime(run.startedAt || run.createdAt) }}
          </p>
        </div>
        <div class="rounded-[1.15rem] border border-white/10 bg-slate-950/60 px-3.5 py-3">
          <span class="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3 w-3" name="history" />Finished</span>
          <p class="mt-1.5 text-[14px] font-semibold text-white">
            {{ formatDateTime(run.finishedAt) }}
          </p>
        </div>
        <div class="rounded-[1.15rem] border border-white/10 bg-slate-950/60 px-3.5 py-3">
          <span class="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3 w-3" name="clock" />Duration</span>
          <p class="mt-1.5 text-[14px] font-semibold text-white">
            {{ formatDuration(run.startedAt || run.createdAt, run.finishedAt) }}
          </p>
        </div>
      </div>

      <div class="mt-4 rounded-[1.2rem] border border-white/10 bg-slate-950/60 px-3.5 py-3">
        <span class="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3 w-3" name="terminal" />Command preview</span>
        <code class="mt-2 block whitespace-pre-wrap break-words font-mono text-[12px] leading-6 text-slate-300">
          {{ run.commandPreview || 'Command preview belum tersedia.' }}
        </code>
      </div>

      <div :class="['mt-5 max-h-[520px] space-y-3 overflow-auto rounded-[28px] border border-white/10 bg-slate-950/80 p-4', props.consoleClass || '']" ref="consoleElement">
        <div
          v-if="!run.logs.length"
          class="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-10 text-center text-sm text-slate-400"
        >
          Belum ada log untuk run ini.
        </div>

        <div v-for="log in run.logs" :key="log.id" :class="getLogLineClass(log.stream)">
          <span class="text-slate-400">
            {{ formatDateTime(log.createdAt) }}
          </span>
          <span class="font-semibold uppercase tracking-[0.16em] text-slate-500">
            {{ log.stream }}
          </span>
          <code :class="getLogMessageClass(log.stream)">{{ log.message }}</code>
        </div>
      </div>
    </template>
  </section>
</template>
