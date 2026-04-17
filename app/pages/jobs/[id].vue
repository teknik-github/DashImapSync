<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ConnectionTestResult, JobDraftPayload, MigrationJobDetail } from '../../../shared/imapsync'
import { formatDateTime } from '../../composables/useFormatters'
import { getRequestErrorMessage } from '../../composables/useRequestError'
import { useToast } from '../../composables/useToast'

const route = useRoute()
const jobId = computed(() => String(route.params.id))

useHead(() => ({
  title: `Migration ${jobId.value}`,
}))

const { data, pending, error, refresh } = await useFetch<{ job: MigrationJobDetail }>(() => `/api/jobs/${jobId.value}`)

const saving = ref(false)
const running = ref(false)
const deleting = ref(false)
const busyRunId = ref<string | null>(null)
const selectedRunId = ref<string | null>(null)
const testing = ref(false)
const { showError, showSuccess } = useToast()

const job = computed(() => data.value?.job ?? null)
const selectedRun = computed(() => job.value?.runs.find((run) => run.id === selectedRunId.value) ?? job.value?.runs[0] ?? null)
const batchSourceHosts = computed(() => new Set(job.value?.items.map((item) => item.sourceHost) ?? []))
const batchDestinationHosts = computed(() => new Set(job.value?.items.map((item) => item.destinationHost) ?? []))
const batchSourceHostLabel = computed(() => {
  if (!job.value) {
    return '-'
  }

  return batchSourceHosts.value.size <= 1 ? job.value.sourceHost : 'Multiple source hosts'
})
const batchDestinationHostLabel = computed(() => {
  if (!job.value) {
    return '-'
  }

  return batchDestinationHosts.value.size <= 1 ? job.value.destinationHost : 'Multiple destination hosts'
})

watch(
  job,
  (value) => {
    if (!value) {
      return
    }

    if (!selectedRunId.value || !value.runs.some((run) => run.id === selectedRunId.value)) {
      selectedRunId.value = value.runs[0]?.id ?? null
    }
  },
  { immediate: true },
)

async function handleSave(payload: JobDraftPayload) {
  saving.value = true

  try {
    await $fetch(`/api/jobs/${jobId.value}`, {
      method: 'PUT',
      body: payload,
    })

    await refresh()
    showSuccess('Migration job berhasil diperbarui.')
  }
  catch (error) {
    showError(getRequestErrorMessage(error))
  }
  finally {
    saving.value = false
  }
}

async function handleRun() {
  running.value = true

  try {
    const response = await $fetch<{ run: { id: string } }>(`/api/jobs/${jobId.value}/runs`, {
      method: 'POST',
    })

    selectedRunId.value = response.run.id
    await refresh()
    showSuccess('Run berhasil di-queue.')
  }
  catch (error) {
    showError(getRequestErrorMessage(error))
  }
  finally {
    running.value = false
  }
}

async function handleTestConnection(payload: JobDraftPayload) {
  testing.value = true

  try {
    const response = await $fetch<{ result: ConnectionTestResult }>('/api/jobs/test-connection', {
      method: 'POST',
      body: {
        jobId: jobId.value,
        ...payload,
      },
    })

    if (response.result.ok) {
      showSuccess(response.result.message)
    }
    else {
      showError(response.result.message)
    }
  }
  catch (error) {
    showError(getRequestErrorMessage(error))
  }
  finally {
    testing.value = false
  }
}

async function handleDelete() {
  if (!import.meta.client || !window.confirm('Delete this migration job? Riwayat run juga akan terhapus.')) {
    return
  }

  deleting.value = true

  try {
    await $fetch(`/api/jobs/${jobId.value}`, {
      method: 'DELETE',
    })

    await navigateTo('/')
  }
  catch (error) {
    showError(getRequestErrorMessage(error))
  }
  finally {
    deleting.value = false
  }
}

async function handleCancel(runId: string) {
  busyRunId.value = runId

  try {
    await $fetch(`/api/runs/${runId}/cancel`, {
      method: 'POST',
    })

    await refresh()
    showSuccess('Permintaan cancel sudah dikirim.')
  }
  catch (error) {
    showError(getRequestErrorMessage(error))
  }
  finally {
    busyRunId.value = null
  }
}

async function handleRetry(runId: string) {
  busyRunId.value = runId

  try {
    const response = await $fetch<{ run: { id: string } }>(`/api/runs/${runId}/retry`, {
      method: 'POST',
    })

    selectedRunId.value = response.run.id
    await refresh()
    showSuccess('Retry run berhasil di-queue.')
  }
  catch (error) {
    showError(getRequestErrorMessage(error))
  }
  finally {
    busyRunId.value = null
  }
}
</script>

<template>
  <div class="space-y-6">
    <div
      v-if="pending"
      class="rounded-[28px] border border-dashed border-white/10 bg-slate-950/50 px-6 py-12 text-center text-sm text-slate-400"
    >
      Memuat detail migration...
    </div>

    <div
      v-else-if="error"
      class="rounded-[28px] border border-rose-400/20 bg-rose-500/10 px-6 py-4 text-sm text-rose-100"
    >
      {{ error.statusMessage || 'Gagal memuat detail migration.' }}
    </div>

    <template v-else-if="job">
      <div v-if="job.isBatch" class="grid gap-6 xl:min-h-[calc(100vh-4.5rem)] xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)_minmax(0,390px)] xl:items-stretch 2xl:grid-cols-[minmax(0,390px)_minmax(0,1fr)_minmax(0,410px)]">
        <div class="space-y-5 xl:flex xl:h-full xl:flex-col xl:self-stretch">
          <section class="overflow-hidden rounded-[1.55rem] border border-white/10 bg-[linear-gradient(135deg,rgba(31,41,75,0.82),rgba(15,23,42,0.86)_45%,rgba(11,18,34,0.92))] px-5 pb-6 pt-5 shadow-[0_16px_42px_rgba(2,6,23,0.22)] ring-1 ring-white/[0.04] backdrop-blur-2xl">
            <div class="space-y-4">
              <div class="flex items-start gap-2.5">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[1rem] bg-sky-500/12 text-sky-100 ring-1 ring-sky-400/20">
                  <AppIcon class="h-4.5 w-4.5" name="mail" />
                </span>
                <div class="space-y-1">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-200/80">
                    Batch migration
                  </p>
                  <h1 class="text-[22px] font-bold tracking-tight text-white">
                    {{ job.name }}
                  </h1>
                  <p class="text-xs leading-5 text-slate-300">
                    Satu job ini menampung {{ job.itemCount }} mailbox pair dan akan dijalankan berurutan dalam satu run.
                  </p>
                </div>
              </div>

              <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-[1.15rem] border border-white/10 bg-slate-950/55 p-3">
                  <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Batch size</span>
                  <p class="mt-1.5 text-[13px] font-semibold text-white">
                    {{ job.itemCount }} mailbox pair{{ job.itemCount > 1 ? 's' : '' }}
                  </p>
                </div>
                <div class="rounded-[1.15rem] border border-white/10 bg-slate-950/55 p-3">
                  <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Mode</span>
                  <p class="mt-1.5 text-[13px] font-semibold text-white">
                    {{ job.dryRun ? 'Dry run' : 'Real sync' }}
                  </p>
                </div>
                <div class="rounded-[1.15rem] border border-white/10 bg-slate-950/55 p-3">
                  <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Source hosts</span>
                  <p class="mt-1.5 text-[13px] font-semibold text-white">
                    {{ batchSourceHostLabel }}
                  </p>
                </div>
                <div class="rounded-[1.15rem] border border-white/10 bg-slate-950/55 p-3">
                  <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Destination hosts</span>
                  <p class="mt-1.5 text-[13px] font-semibold text-white">
                    {{ batchDestinationHostLabel }}
                  </p>
                </div>
                <div class="rounded-[1.15rem] border border-white/10 bg-slate-950/55 p-3">
                  <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Continue on error</span>
                  <p class="mt-1.5 text-[13px] font-semibold text-white">
                    {{ job.continueOnError ? 'Enabled' : 'Disabled' }}
                  </p>
                </div>
                <div class="rounded-[1.15rem] border border-white/10 bg-slate-950/55 p-3">
                  <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Folders</span>
                  <p class="mt-1.5 text-[13px] font-semibold text-white break-words whitespace-pre-wrap">
                    {{ job.folderFilter ? job.folderFilter : 'All folders' }}
                  </p>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <NuxtLink
                  class="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/[0.07]"
                  to="/"
                >
                  <AppIcon class="h-4 w-4" name="arrow-left" />
                  Back
                </NuxtLink>
                <button
                  :disabled="running || pending"
                  class="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.28)] transition hover:-translate-y-0.5 hover:from-indigo-400 hover:to-violet-400 disabled:cursor-wait disabled:opacity-60"
                  type="button"
                  @click="handleRun"
                >
                  <AppIcon class="h-4 w-4" name="play" />
                  {{ running ? 'Queueing...' : 'Run now' }}
                </button>
                <button
                  :disabled="deleting || pending"
                  class="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:-translate-y-0.5 hover:bg-rose-500/15 disabled:cursor-wait disabled:opacity-60"
                  type="button"
                  @click="handleDelete"
                >
                  <AppIcon class="h-4 w-4" name="trash" />
                  {{ deleting ? 'Deleting...' : 'Delete job' }}
                </button>
              </div>
            </div>
          </section>

          <section class="rounded-[1.55rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.72),rgba(9,15,28,0.84))] p-4 shadow-[0_16px_42px_rgba(2,6,23,0.22)] ring-1 ring-white/[0.04] xl:flex xl:flex-1 xl:flex-col">
            <div class="flex items-start gap-2.5">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[1rem] bg-violet-500/10 text-violet-200 ring-1 ring-violet-400/15">
                <AppIcon class="h-4.5 w-4.5" name="folder" />
              </span>
              <div class="space-y-1">
                <h2 class="text-[17px] font-semibold text-white">
                  Mailbox pairs
                </h2>
                <p class="text-xs leading-5 text-slate-400">
                  Daftar akun yang akan diproses di dalam batch job ini.
                </p>
              </div>
            </div>

            <div class="mt-4 max-h-[560px] space-y-3 overflow-auto pr-1 xl:max-h-none xl:flex-1">
              <div
                v-for="item in job.items"
                :key="item.id"
                class="rounded-[1.15rem] border border-white/10 bg-slate-950/55 p-3"
              >
                <div class="flex items-center justify-between gap-3">
                  <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">#{{ item.sortOrder }}</span>
                  <span class="text-[11px] font-medium text-slate-500">{{ item.sourceHost }} -> {{ item.destinationHost }}</span>
                </div>
                <p class="mt-2 text-sm font-semibold text-white break-all">
                  {{ item.sourceUsername }}
                </p>
                <p class="mt-1 text-xs text-slate-400 break-all">
                  to {{ item.destinationUsername }}
                </p>
              </div>
            </div>
          </section>
        </div>

        <div class="min-w-0 xl:h-[calc(100dvh-4.5rem)] xl:self-stretch">
          <ClientOnly>
            <RunLogStream
              :run-id="selectedRunId"
              description="Live log agregat untuk batch job yang sedang dipilih. Setiap mailbox pair diproses berurutan dalam satu run."
              console-class="xl:flex-1 xl:min-h-0 xl:max-h-none"
              panel-class="xl:flex xl:h-full xl:min-h-0 xl:flex-col xl:overflow-hidden"
              title="Batch logs"
            />
          </ClientOnly>
        </div>

        <section class="h-fit rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.7),rgba(11,18,34,0.84))] px-5 pb-6 pt-5 shadow-[0_24px_70px_rgba(2,6,23,0.42)] ring-1 ring-white/5 backdrop-blur-2xl xl:self-start">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div class="flex items-start gap-3">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-violet-500/10 text-violet-200 ring-1 ring-violet-400/15">
                <AppIcon class="h-5 w-5" name="history" />
              </span>
              <div class="space-y-1">
                <h2 class="text-lg font-semibold text-white">
                  Run controls
                </h2>
                <p class="text-sm text-slate-400">
                  Pilih run batch yang ingin dipantau, retry, atau cancel.
                </p>
              </div>
            </div>

            <StatusBadge :status="selectedRun?.status || job.latestRun?.status || 'idle'" />
          </div>

          <div v-if="!job.runs.length" class="mt-5 rounded-3xl border border-dashed border-white/10 bg-slate-950/50 px-6 py-8 text-center text-sm text-slate-400">
            Belum ada run. Klik <strong class="text-slate-200">Run now</strong> untuk memulai batch migration.
          </div>

          <div v-else class="mt-5 space-y-4">
            <label class="block rounded-3xl border border-white/10 bg-slate-950/55 p-4">
              <span class="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Selected run</span>
              <select v-model="selectedRunId" class="block w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20">
                <option v-for="run in job.runs" :key="run.id" :value="run.id">
                  {{ formatDateTime(run.createdAt) }} | {{ run.status }} | {{ run.triggerType }}
                </option>
              </select>
            </label>

            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
              <button
                v-if="selectedRun"
                :disabled="busyRunId === selectedRun.id"
                class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/[0.07] disabled:cursor-wait disabled:opacity-60"
                type="button"
                @click="handleRetry(selectedRun.id)"
              >
                <AppIcon class="h-4 w-4" name="retry" />
                {{ busyRunId === selectedRun.id ? 'Processing...' : 'Retry selected run' }}
              </button>
              <button
                v-if="selectedRun && (selectedRun.status === 'queued' || selectedRun.status === 'running')"
                :disabled="busyRunId === selectedRun.id"
                class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:-translate-y-0.5 hover:bg-rose-500/15 disabled:cursor-wait disabled:opacity-60"
                type="button"
                @click="handleCancel(selectedRun.id)"
              >
                <AppIcon class="h-4 w-4" name="logout" />
                {{ busyRunId === selectedRun.id ? 'Processing...' : 'Cancel selected run' }}
              </button>
            </div>
          </div>

          <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
            <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <span class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3.5 w-3.5" name="history" />Latest run</span>
              <p class="mt-2 text-sm font-semibold text-white">
                {{ formatDateTime(job.latestRun?.createdAt) }}
              </p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <span class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3.5 w-3.5" name="refresh" />Updated</span>
              <p class="mt-2 text-sm font-semibold text-white">
                {{ formatDateTime(job.updatedAt) }}
              </p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <span class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3.5 w-3.5" name="folder" />Batch size</span>
              <p class="mt-2 text-sm font-semibold text-white">
                {{ job.itemCount }} mailbox pair{{ job.itemCount > 1 ? 's' : '' }}
              </p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <span class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3.5 w-3.5" name="terminal" />Progress</span>
              <p class="mt-2 text-sm font-semibold text-white">
                {{ selectedRun?.batchTotalItems ? `${selectedRun.batchCompletedItems}/${selectedRun.batchTotalItems} completed` : '-' }}
              </p>
              <p v-if="selectedRun?.batchFailedItems" class="mt-1 text-xs text-rose-200">
                {{ selectedRun.batchFailedItems }} failed
              </p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <span class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3.5 w-3.5" name="terminal" />Mode</span>
              <p class="mt-2 text-sm font-semibold text-white">
                {{ job.dryRun ? 'Dry run' : 'Real sync' }}
              </p>
            </div>
            <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <span class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3.5 w-3.5" name="alert" />Continue on error</span>
              <p class="mt-2 text-sm font-semibold text-white">
                {{ job.continueOnError ? 'Enabled' : 'Disabled' }}
              </p>
            </div>
          </div>
        </section>
      </div>

      <JobForm
        v-else
        :busy="saving"
        :initial-value="job"
        :layout="'detail'"
        :password1-saved="job.password1Saved"
        :password2-saved="job.password2Saved"
        :show-test-action="true"
        :show-detail-footer="false"
        :test-busy="testing"
        submit-label="Save changes"
        @submit="handleSave"
        @test-connection="handleTestConnection"
      >
        <template #left-extra="{ busy: formBusy, handleTestConnection: triggerTestConnection, testBusy: formTestBusy }">
          <section class="overflow-hidden rounded-[1.55rem] border border-white/10 bg-[linear-gradient(135deg,rgba(31,41,75,0.82),rgba(15,23,42,0.86)_45%,rgba(11,18,34,0.92))] p-4 shadow-[0_16px_42px_rgba(2,6,23,0.22)] ring-1 ring-white/[0.04] backdrop-blur-2xl">
            <div class="space-y-4">
              <div class="flex items-start gap-2.5">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[1rem] bg-sky-500/12 text-sky-100 ring-1 ring-sky-400/20">
                  <AppIcon class="h-4.5 w-4.5" name="mail" />
                </span>
                <div class="space-y-1">
                  <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-200/80">
                    Migration detail
                  </p>
                  <h1 class="text-[22px] font-bold tracking-tight text-white">
                    {{ job?.name || 'Migration job' }}
                  </h1>
                  <p class="text-xs leading-5 text-slate-300">
                    Update konfigurasi mailbox, jalankan imapsync, dan monitor log live untuk setiap run.
                  </p>
                </div>
              </div>

              <div v-if="job" class="flex flex-wrap gap-2">
                <span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-slate-200">
                  <AppIcon class="h-3.5 w-3.5" name="server" />
                  {{ job.sourceHost }}
                </span>
                <span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-slate-200">
                  <AppIcon class="h-3.5 w-3.5" name="download" />
                  {{ job.destinationHost }}
                </span>
                <span class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-medium text-slate-200">
                  <AppIcon class="h-3.5 w-3.5" name="terminal" />
                  {{ job.dryRun ? 'Dry run' : 'Real sync' }}
                </span>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <NuxtLink
                  class="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/[0.07]"
                  to="/"
                >
                  <AppIcon class="h-4 w-4" name="arrow-left" />
                  Back
                </NuxtLink>
                <button
                  :disabled="running || pending || !job"
                  class="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.28)] transition hover:-translate-y-0.5 hover:from-indigo-400 hover:to-violet-400 disabled:cursor-wait disabled:opacity-60"
                  type="button"
                  @click="handleRun"
                >
                  <AppIcon class="h-4 w-4" name="play" />
                  {{ running ? 'Queueing...' : 'Run now' }}
                </button>
                <button
                  :disabled="deleting || pending || !job"
                  class="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm font-semibold text-rose-100 transition hover:-translate-y-0.5 hover:bg-rose-500/15 disabled:cursor-wait disabled:opacity-60"
                  type="button"
                  @click="handleDelete"
                >
                  <AppIcon class="h-4 w-4" name="trash" />
                  {{ deleting ? 'Deleting...' : 'Delete job' }}
                </button>
              </div>

              <div class="grid gap-2 sm:grid-cols-2">
                <button
                  :disabled="formBusy || formTestBusy"
                  class="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/[0.07] disabled:cursor-wait disabled:opacity-60"
                  type="button"
                  @click="triggerTestConnection()"
                >
                  <AppIcon class="h-4 w-4" name="server" />
                  {{ formTestBusy ? 'Testing...' : 'Test connection' }}
                </button>

                <button
                  :disabled="formBusy"
                  class="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2.5 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.28)] transition hover:-translate-y-0.5 hover:from-indigo-400 hover:to-violet-400 disabled:cursor-wait disabled:opacity-60"
                  type="submit"
                >
                  <AppIcon class="h-4 w-4" name="refresh" />
                  {{ formBusy ? 'Saving...' : 'Save changes' }}
                </button>
              </div>
            </div>
          </section>
        </template>

        <template #middle>
          <ClientOnly>
            <RunLogStream
              :run-id="selectedRunId"
              description="Live log, status, dan metadata eksekusi untuk run yang sedang dipilih."
              title="Live logs"
            />
          </ClientOnly>
        </template>

        <template #right-extra>
          <section class="min-h-[372px] rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.7),rgba(11,18,34,0.84))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] ring-1 ring-white/5 backdrop-blur-2xl">
            <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div class="flex items-start gap-3">
                <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-violet-500/10 text-violet-200 ring-1 ring-violet-400/15">
                  <AppIcon class="h-5 w-5" name="history" />
                </span>
                <div class="space-y-1">
                  <h2 class="text-lg font-semibold text-white">
                    Logs
                  </h2>
                  <p class="text-sm text-slate-400">
                    Pilih run yang ingin dipantau, lalu lihat live log di kolom tengah.
                  </p>
                </div>
              </div>

              <StatusBadge :status="selectedRun?.status || job.latestRun?.status || 'idle'" />
            </div>

            <div v-if="!job.runs.length" class="mt-5 rounded-3xl border border-dashed border-white/10 bg-slate-950/50 px-6 py-8 text-center text-sm text-slate-400">
              Belum ada run. Klik <strong class="text-slate-200">Run now</strong> untuk memulai migrasi pertama.
            </div>

            <div v-else class="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
              <label class="block">
                <span class="mb-2 block text-sm font-medium text-slate-200">Selected run</span>
                <select v-model="selectedRunId" class="block w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20">
                  <option v-for="run in job.runs" :key="run.id" :value="run.id">
                    {{ formatDateTime(run.createdAt) }} | {{ run.status }} | {{ run.triggerType }}
                  </option>
                </select>
              </label>

              <div class="flex flex-wrap items-center gap-3 xl:justify-end">
                <button
                  v-if="selectedRun"
                  :disabled="busyRunId === selectedRun.id"
                  class="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/[0.07] disabled:cursor-wait disabled:opacity-60"
                  type="button"
                  @click="handleRetry(selectedRun.id)"
                >
                  <AppIcon class="h-4 w-4" name="retry" />
                  {{ busyRunId === selectedRun.id ? 'Processing...' : 'Retry selected run' }}
                </button>
                <button
                  v-if="selectedRun && (selectedRun.status === 'queued' || selectedRun.status === 'running')"
                  :disabled="busyRunId === selectedRun.id"
                  class="inline-flex items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-100 transition hover:-translate-y-0.5 hover:bg-rose-500/15 disabled:cursor-wait disabled:opacity-60"
                  type="button"
                  @click="handleCancel(selectedRun.id)"
                >
                  <AppIcon class="h-4 w-4" name="logout" />
                  {{ busyRunId === selectedRun.id ? 'Processing...' : 'Cancel selected run' }}
                </button>
              </div>
            </div>

            <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-2">
              <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <span class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3.5 w-3.5" name="history" />Latest run</span>
                <p class="mt-2 text-sm font-semibold text-white">
                  {{ formatDateTime(job.latestRun?.createdAt) }}
                </p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <span class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3.5 w-3.5" name="refresh" />Updated</span>
                <p class="mt-2 text-sm font-semibold text-white">
                  {{ formatDateTime(job.updatedAt) }}
                </p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <span class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3.5 w-3.5" name="folder" />Folders</span>
                <p class="mt-2 text-sm font-semibold text-white">
                  {{ job.folderFilter ? job.folderFilter.split('\n').length : 'All folders' }}
                </p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <span class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3.5 w-3.5" name="terminal" />Mode</span>
                <p class="mt-2 text-sm font-semibold text-white">
                  {{ job.dryRun ? 'Dry run' : 'Real sync' }}
                </p>
              </div>
            </div>
          </section>
        </template>
      </JobForm>
    </template>
  </div>
</template>
