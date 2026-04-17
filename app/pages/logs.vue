<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AllRunsResponse, MigrationRunDetail, MigrationRunLog, MigrationRunStatus } from '../../shared/imapsync'
import { formatDateTime, formatDuration } from '../composables/useFormatters'
import { getRequestErrorMessage } from '../composables/useRequestError'

useHead({ title: 'Logs — Dash ImapSync' })

type StatusFilter = MigrationRunStatus | 'all'

const STATUS_TABS: { label: string, value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Running', value: 'running' },
  { label: 'Succeeded', value: 'succeeded' },
  { label: 'Failed', value: 'failed' },
  { label: 'Queued', value: 'queued' },
  { label: 'Canceled', value: 'canceled' },
]

type LogTab = 'live' | 'batch'

const activeStatus = ref<StatusFilter>('all')
const page = ref(1)
const selectedRunId = ref<string | null>(null)
const activeLogTab = ref<LogTab>('live')
const runDetail = ref<MigrationRunDetail | null>(null)
const runDetailLoading = ref(false)
const runDetailError = ref<string | null>(null)

let eventSource: EventSource | null = null

const apiUrl = computed(() => {
  const params = new URLSearchParams({ page: String(page.value), limit: '50' })
  if (activeStatus.value !== 'all') params.set('status', activeStatus.value)
  return `/api/logs?${params.toString()}`
})

const { data, pending, error, refresh } = await useFetch<AllRunsResponse>(apiUrl, {
  default: () => ({ runs: [], total: 0, page: 1, limit: 50 }),
})

const runs = computed(() => data.value?.runs ?? [])
const total = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => Math.ceil(total.value / (data.value?.limit ?? 50)))

const liveLogs = computed(() =>
  (runDetail.value?.logs ?? []).filter(l => l.stream === 'stdout' || l.stream === 'stderr'),
)

const batchLogs = computed(() =>
  (runDetail.value?.logs ?? []).filter(l => l.stream === 'system'),
)

watch(activeStatus, () => { page.value = 1 })

watch(selectedRunId, (runId) => {
  closeStream()
  runDetail.value = null
  runDetailError.value = null
  activeLogTab.value = 'live'
  if (runId) loadRunDetail(runId)
})

function closeStream() {
  eventSource?.close()
  eventSource = null
}

function syncRunSummary(summary: Partial<MigrationRunDetail>) {
  if (!runDetail.value) return
  runDetail.value = { ...runDetail.value, ...summary }
}

function openStream(runId: string) {
  if (!import.meta.client) return
  closeStream()
  const source = new EventSource(`/api/runs/${runId}/stream`)
  eventSource = source

  source.addEventListener('snapshot', (e) => {
    const payload = JSON.parse((e as MessageEvent).data) as { run: MigrationRunDetail }
    runDetail.value = payload.run
  })

  source.addEventListener('log', (e) => {
    const log = JSON.parse((e as MessageEvent).data) as MigrationRunLog
    if (!runDetail.value) return
    runDetail.value.logs = [...runDetail.value.logs, log].slice(-500)
  })

  source.addEventListener('status', (e) => {
    const summary = JSON.parse((e as MessageEvent).data)
    syncRunSummary(summary)
    if (!['queued', 'running'].includes(summary.status)) closeStream()
  })

  source.onerror = () => {
    if (runDetail.value && ['queued', 'running'].includes(runDetail.value.status)) return
    closeStream()
  }
}

async function loadRunDetail(runId: string) {
  runDetailLoading.value = true
  runDetailError.value = null
  try {
    const res = await $fetch<{ run: MigrationRunDetail }>(`/api/runs/${runId}`)
    runDetail.value = res.run
    if (['queued', 'running'].includes(res.run.status)) openStream(runId)
  }
  catch (err) {
    runDetailError.value = getRequestErrorMessage(err)
  }
  finally {
    runDetailLoading.value = false
  }
}

function selectRun(runId: string) {
  selectedRunId.value = selectedRunId.value === runId ? null : runId
}

function prevPage() { if (page.value > 1) page.value-- }
function nextPage() { if (page.value < totalPages.value) page.value++ }

function getLogLineClass(stream: MigrationRunLog['stream']) {
  if (stream === 'stderr') return 'flex gap-3 rounded-xl border border-rose-400/15 bg-rose-500/5 px-3 py-2'
  if (stream === 'system') return 'flex gap-3 rounded-xl border border-violet-400/15 bg-violet-500/5 px-3 py-2'
  return 'flex gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2'
}

function getLogMessageClass(stream: MigrationRunLog['stream']) {
  if (stream === 'stderr') return 'whitespace-pre-wrap break-words font-mono text-xs text-rose-100'
  if (stream === 'system') return 'whitespace-pre-wrap break-words font-mono text-xs text-violet-100'
  return 'whitespace-pre-wrap break-words font-mono text-xs text-slate-100'
}

onBeforeUnmount(() => closeStream())
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <section class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-white">
          Logs
        </h1>
        <p class="mt-1 text-sm text-slate-400">
          Semua riwayat eksekusi dari seluruh migration job.
        </p>
      </div>
      <button
        class="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/[0.07]"
        type="button"
        @click="refresh()"
      >
        <AppIcon class="h-4 w-4" name="refresh" />
        Refresh
      </button>
    </section>

    <!-- Status filter tabs -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="tab in STATUS_TABS"
        :key="tab.value"
        :class="[
          'rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition',
          activeStatus === tab.value
            ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-200'
            : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-slate-200',
        ]"
        type="button"
        @click="activeStatus = tab.value"
      >
        {{ tab.label }}
      </button>
    </div>

    <!-- Run list -->
    <section class="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.7),rgba(11,18,34,0.84))] shadow-[0_24px_70px_rgba(2,6,23,0.42)] ring-1 ring-white/5 backdrop-blur-2xl">
      <div v-if="pending" class="px-6 py-10 text-center text-sm text-slate-400">
        Memuat logs...
      </div>

      <div v-else-if="error" class="m-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
        {{ error.statusMessage || 'Gagal memuat logs.' }}
      </div>

      <template v-else>
        <div v-if="!runs.length" class="px-6 py-14 text-center">
          <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.04] text-slate-500">
            <AppIcon class="h-6 w-6" name="history" />
          </span>
          <p class="mt-4 text-sm text-slate-400">Belum ada log untuk ditampilkan.</p>
        </div>

        <template v-else>
          <!-- Count -->
          <div class="flex items-center justify-between border-b border-white/8 px-6 py-4">
            <p class="text-sm text-slate-400">
              Menampilkan <span class="font-semibold text-white">{{ runs.length }}</span> dari
              <span class="font-semibold text-white">{{ total }}</span> run
            </p>
            <p v-if="totalPages > 1" class="text-sm text-slate-400">
              Halaman {{ page }} / {{ totalPages }}
            </p>
          </div>

          <!-- Rows -->
          <ul class="divide-y divide-white/[0.05]">
            <li v-for="run in runs" :key="run.id">
              <button
                type="button"
                :class="[
                  'flex w-full flex-col gap-3 px-6 py-4 text-left transition sm:flex-row sm:items-center sm:justify-between',
                  selectedRunId === run.id
                    ? 'bg-indigo-500/[0.07]'
                    : 'hover:bg-white/[0.03]',
                ]"
                @click="selectRun(run.id)"
              >
                <!-- Left -->
                <div class="flex min-w-0 items-start gap-3">
                  <span
                    :class="[
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 transition',
                      selectedRunId === run.id
                        ? 'bg-indigo-500/15 text-indigo-300 ring-indigo-400/20'
                        : 'bg-slate-800/60 text-slate-400 ring-white/[0.06]',
                    ]"
                  >
                    <AppIcon class="h-4 w-4" name="terminal" />
                  </span>
                  <div class="min-w-0 space-y-1">
                    <p class="truncate text-sm font-semibold text-white">
                      {{ run.jobName }}
                    </p>
                    <div class="flex flex-wrap items-center gap-2">
                      <StatusBadge :status="run.status" />
                      <span class="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        {{ run.triggerType }}
                      </span>
                    </div>
                    <p v-if="run.lastLogLine" class="truncate text-xs text-slate-500">
                      {{ run.lastLogLine }}
                    </p>
                    <p v-if="run.errorMessage && run.status === 'failed'" class="truncate text-xs text-rose-400">
                      {{ run.errorMessage }}
                    </p>
                  </div>
                </div>

                <!-- Right -->
                <div class="flex shrink-0 flex-wrap items-center gap-4 text-right sm:flex-col sm:items-end sm:gap-1">
                  <p class="text-xs text-slate-400">{{ formatDateTime(run.createdAt) }}</p>
                  <p v-if="run.startedAt" class="text-xs text-slate-500">
                    Durasi: {{ formatDuration(run.startedAt, run.finishedAt ?? undefined) }}
                  </p>
                  <p v-if="run.exitCode !== null" class="text-xs" :class="run.exitCode === 0 ? 'text-emerald-400' : 'text-rose-400'">
                    Exit {{ run.exitCode }}
                  </p>
                  <AppIcon
                    class="h-4 w-4 shrink-0 transition-transform text-slate-500"
                    :class="selectedRunId === run.id ? 'rotate-90' : ''"
                    name="chevron-right"
                  />
                </div>
              </button>

              <!-- Inline detail panel -->
              <Transition
                enter-active-class="transition-all duration-300 ease-out"
                enter-from-class="opacity-0 -translate-y-2"
                enter-to-class="opacity-100 translate-y-0"
                leave-active-class="transition-all duration-200 ease-in"
                leave-from-class="opacity-100 translate-y-0"
                leave-to-class="opacity-0 -translate-y-2"
              >
                <div v-if="selectedRunId === run.id" class="border-t border-indigo-400/10 bg-slate-950/40 px-6 py-5">
                  <!-- Loading -->
                  <div v-if="runDetailLoading" class="py-8 text-center text-sm text-slate-400">
                    Memuat logs...
                  </div>

                  <!-- Error -->
                  <div v-else-if="runDetailError" class="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {{ runDetailError }}
                  </div>

                  <template v-else-if="runDetail">
                    <!-- Log Tabs -->
                    <div class="mb-4 flex items-center gap-2">
                      <button
                        v-for="tab in [{ key: 'live', label: 'Live logs', count: liveLogs.length }, { key: 'batch', label: 'Batch logs', count: batchLogs.length }]"
                        :key="tab.key"
                        type="button"
                        :class="[
                          'inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold transition',
                          activeLogTab === tab.key
                            ? 'border-indigo-400/40 bg-indigo-500/15 text-indigo-200'
                            : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200',
                        ]"
                        @click="activeLogTab = tab.key as LogTab"
                      >
                        {{ tab.label }}
                        <span class="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold">{{ tab.count }}</span>
                      </button>
                    </div>

                    <!-- Log content -->
                    <div class="max-h-96 space-y-2 overflow-y-auto rounded-2xl border border-white/8 bg-slate-950/70 p-3">
                      <template v-if="activeLogTab === 'live'">
                        <div v-if="!liveLogs.length" class="py-6 text-center text-xs text-slate-500">
                          Tidak ada live log.
                        </div>
                        <div v-for="log in liveLogs" :key="log.id" :class="getLogLineClass(log.stream)">
                          <span class="shrink-0 text-[10px] text-slate-500">{{ formatDateTime(log.createdAt) }}</span>
                          <code :class="getLogMessageClass(log.stream)">{{ log.message }}</code>
                        </div>
                      </template>

                      <template v-else>
                        <div v-if="!batchLogs.length" class="py-6 text-center text-xs text-slate-500">
                          Tidak ada batch log.
                        </div>
                        <div v-for="log in batchLogs" :key="log.id" :class="getLogLineClass(log.stream)">
                          <span class="shrink-0 text-[10px] text-slate-500">{{ formatDateTime(log.createdAt) }}</span>
                          <code :class="getLogMessageClass(log.stream)">{{ log.message }}</code>
                        </div>
                      </template>
                    </div>
                  </template>
                </div>
              </Transition>
            </li>
          </ul>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="flex items-center justify-between border-t border-white/8 px-6 py-4">
            <button
              :disabled="page <= 1"
              class="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
              @click="prevPage"
            >
              <AppIcon class="h-4 w-4" name="arrow-left" />
              Sebelumnya
            </button>
            <span class="text-sm text-slate-400">{{ page }} / {{ totalPages }}</span>
            <button
              :disabled="page >= totalPages"
              class="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-40"
              type="button"
              @click="nextPage"
            >
              Selanjutnya
              <AppIcon class="h-4 w-4 rotate-180" name="arrow-left" />
            </button>
          </div>
        </template>
      </template>
    </section>
  </div>
</template>
