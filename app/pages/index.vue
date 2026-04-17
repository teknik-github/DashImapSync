<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DashboardSummary, MigrationJobSummary, MigrationRunStatus } from '../../shared/imapsync'
import { formatDateTime } from '../composables/useFormatters'

useHead({ title: 'Dashboard imapsync' })

type FilterStatus = MigrationRunStatus | null

const defaultSummary: DashboardSummary = {
  totalJobs: 0,
  queuedRuns: 0,
  runningRuns: 0,
  succeededRuns: 0,
  failedRuns: 0,
}

const { data, pending, error, refresh } = await useFetch<{ jobs: MigrationJobSummary[], summary: DashboardSummary }>('/api/jobs', {
  default: () => ({
    jobs: [],
    summary: defaultSummary,
  }),
})

const activeFilter = ref<FilterStatus>(null)

const jobs = computed(() => data.value?.jobs ?? [])
const summary = computed(() => data.value?.summary ?? defaultSummary)

const filteredJobs = computed(() => {
  if (!activeFilter.value) return jobs.value
  return jobs.value.filter(job => job.latestRun?.status === activeFilter.value)
})

const summaryCards = computed(() => [
  {
    filter: 'queued' as FilterStatus,
    title: 'Queued runs',
    value: summary.value.queuedRuns,
    icon: 'clock' as const,
    baseTone: 'border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.7),rgba(12,19,35,0.78))] ring-white/5',
    activeTone: 'border-amber-400/30 bg-[linear-gradient(180deg,rgba(40,30,10,0.75),rgba(22,16,6,0.88))] ring-amber-400/15',
    iconTone: 'bg-amber-400/10 text-amber-200 ring-amber-400/15',
    textTone: 'text-white',
  },
  {
    filter: 'running' as FilterStatus,
    title: 'Running runs',
    value: summary.value.runningRuns,
    icon: 'play' as const,
    baseTone: 'border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.7),rgba(12,19,35,0.78))] ring-white/5',
    activeTone: 'border-sky-400/30 bg-[linear-gradient(180deg,rgba(8,30,50,0.75),rgba(5,18,34,0.88))] ring-sky-400/15',
    iconTone: 'bg-sky-400/10 text-sky-200 ring-sky-400/15',
    textTone: 'text-white',
  },
  {
    filter: 'succeeded' as FilterStatus,
    title: 'Success',
    value: summary.value.succeededRuns,
    icon: 'check' as const,
    baseTone: 'border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.7),rgba(12,19,35,0.78))] ring-white/5',
    activeTone: 'border-emerald-400/30 bg-[linear-gradient(180deg,rgba(8,35,22,0.75),rgba(5,20,14,0.88))] ring-emerald-400/15',
    iconTone: 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/15',
    textTone: 'text-white',
  },
  {
    filter: 'failed' as FilterStatus,
    title: 'Latest failed',
    value: summary.value.failedRuns,
    icon: 'alert' as const,
    baseTone: 'border-rose-400/10 bg-[linear-gradient(180deg,rgba(76,12,27,0.22),rgba(18,19,33,0.82))] ring-rose-400/10',
    activeTone: 'border-rose-400/35 bg-[linear-gradient(180deg,rgba(100,15,30,0.45),rgba(22,8,18,0.92))] ring-rose-400/20',
    iconTone: 'bg-rose-400/10 text-rose-200 ring-rose-400/15',
    textTone: 'text-rose-100',
  },
])

function toggleFilter(status: FilterStatus) {
  activeFilter.value = activeFilter.value === status ? null : status
}

function getJobSubtitle(job: MigrationJobSummary) {
  if (job.isBatch) {
    return `${job.itemCount} mailbox pair${job.itemCount > 1 ? 's' : ''} in one batch job`
  }
  return `${job.sourceUsername} @ ${job.sourceHost} -> ${job.destinationUsername} @ ${job.destinationHost}`
}
</script>

<template>
  <div class="space-y-6">
    <section class="flex justify-end">
      <div class="flex flex-wrap items-center gap-3">
        <button
          class="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/[0.07]"
          type="button"
          @click="refresh()"
        >
          <AppIcon class="h-4 w-4" name="refresh" />
          Refresh
        </button>
        <NuxtLink
          class="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.28)] transition hover:-translate-y-0.5 hover:from-indigo-400 hover:to-violet-400"
          to="/jobs/new"
        >
          <AppIcon class="h-4 w-4" name="plus" />
          Create job
        </NuxtLink>
      </div>
    </section>

    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <button
        v-for="card in summaryCards"
        :key="card.title"
        type="button"
        :class="[
          'group relative rounded-[2rem] border p-5 text-left shadow-[0_18px_55px_rgba(2,6,23,0.38)] ring-1 backdrop-blur-2xl transition hover:-translate-y-1',
          activeFilter === card.filter ? card.activeTone : card.baseTone,
          card.textTone,
        ]"
        @click="toggleFilter(card.filter)"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{{ card.title }}</span>
            <strong class="mt-3 block text-4xl font-semibold tracking-tight">{{ card.value }}</strong>
          </div>
          <span :class="['flex h-11 w-11 items-center justify-center rounded-[1.25rem] ring-1', card.iconTone]">
            <AppIcon :name="card.icon" class="h-5 w-5" />
          </span>
        </div>
        <span
          v-if="activeFilter === card.filter"
          class="absolute bottom-3 right-4 text-[10px] font-semibold uppercase tracking-widest text-slate-400"
        >
          Filtered ✕
        </span>
      </button>
    </section>

    <div
      v-if="pending"
      class="rounded-3xl border border-dashed border-white/10 bg-slate-950/50 px-6 py-10 text-center text-sm text-slate-400"
    >
      Memuat daftar migration job...
    </div>

    <div v-else-if="error" class="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
      {{ error.statusMessage || 'Gagal memuat dashboard.' }}
    </div>

    <template v-else>
      <!-- Filter label -->
      <div v-if="activeFilter" class="flex items-center gap-3">
        <span class="text-sm text-slate-400">
          Menampilkan <span class="font-semibold text-white">{{ filteredJobs.length }}</span> job dengan status
          <span class="font-semibold capitalize text-white">{{ activeFilter }}</span>
        </span>
        <button
          class="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-semibold text-slate-300 transition hover:bg-white/[0.08]"
          type="button"
          @click="activeFilter = null"
        >
          Reset filter
        </button>
      </div>

      <div
        v-if="!filteredJobs.length"
        class="rounded-3xl border border-dashed border-white/10 bg-slate-950/50 px-6 py-10 text-center"
      >
        <p class="text-sm text-slate-400">
          {{ activeFilter ? `Tidak ada job dengan status "${activeFilter}".` : 'Belum ada migration job.' }}
        </p>
        <NuxtLink
          v-if="!activeFilter"
          class="mt-4 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.28)] transition hover:-translate-y-0.5 hover:from-indigo-400 hover:to-violet-400"
          to="/jobs/new"
        >
          Buat job pertama
        </NuxtLink>
      </div>

    <div v-else class="grid gap-4 xl:grid-cols-2">
      <article
        v-for="job in filteredJobs"
        :key="job.id"
        class="group flex h-full flex-col gap-5 rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(19,29,48,0.86),rgba(9,16,29,0.9))] p-5 shadow-[0_16px_44px_rgba(2,6,23,0.28)] ring-1 ring-white/[0.04] transition hover:-translate-y-1.5 hover:border-white/12 hover:shadow-[0_26px_60px_rgba(2,6,23,0.38)]"
      >
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div class="flex min-w-0 items-start gap-3">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-sky-500/10 text-sky-200 ring-1 ring-sky-400/15">
              <AppIcon class="h-5 w-5" name="mail" />
            </span>
            <div class="min-w-0 space-y-1">
              <h3 class="truncate text-lg font-semibold text-white">
                {{ job.name }}
              </h3>
              <p class="text-sm text-slate-400">
                {{ getJobSubtitle(job) }}
              </p>
            </div>
          </div>
          <StatusBadge :status="job.latestRun?.status || 'idle'" />
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="rounded-[1.45rem] border border-white/8 bg-white/[0.03] p-4">
            <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              <AppIcon class="h-3.5 w-3.5" name="server" />
              <span>Source</span>
            </div>
            <p class="mt-2 text-sm font-semibold text-white">
              {{ job.sourceHost }}:{{ job.sourcePort }}
            </p>
          </div>
          <div class="rounded-[1.45rem] border border-white/8 bg-white/[0.03] p-4">
            <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              <AppIcon class="h-3.5 w-3.5" name="download" />
              <span>Destination</span>
            </div>
            <p class="mt-2 text-sm font-semibold text-white">
              {{ job.destinationHost }}:{{ job.destinationPort }}
            </p>
          </div>
          <div class="rounded-[1.45rem] border border-white/8 bg-white/[0.03] p-4">
            <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              <AppIcon class="h-3.5 w-3.5" name="refresh" />
              <span>Updated</span>
            </div>
            <p class="mt-2 text-sm font-semibold text-white">
              {{ formatDateTime(job.updatedAt) }}
            </p>
          </div>
          <div class="rounded-[1.45rem] border border-white/8 bg-white/[0.03] p-4">
            <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              <AppIcon class="h-3.5 w-3.5" name="terminal" />
              <span>{{ job.isBatch ? 'Batch size' : 'Mode' }}</span>
            </div>
            <p class="mt-2 text-sm font-semibold text-white">
              {{ job.isBatch ? `${job.itemCount} mailbox pair${job.itemCount > 1 ? 's' : ''}` : job.dryRun ? 'Dry run' : 'Real sync' }}
            </p>
          </div>
        </div>

        <div class="mt-auto flex flex-col gap-4 border-t border-white/10 pt-4 sm:flex-row sm:items-end sm:justify-between">
          <div class="space-y-1">
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Latest run
            </p>
            <p class="text-sm font-semibold text-white">
              {{ job.latestRun ? formatDateTime(job.latestRun.createdAt) : 'Belum pernah dijalankan' }}
            </p>
            <p v-if="job.latestRun?.lastLogLine" class="text-sm text-slate-400">
              {{ job.latestRun.lastLogLine }}
            </p>
          </div>
          <NuxtLink
            :to="`/jobs/${job.id}`"
            class="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/[0.07] group-hover:border-white/14"
          >
            <AppIcon class="h-4 w-4" name="chevron-right" />
            Open detail
          </NuxtLink>
        </div>
      </article>
    </div>
    </template>
  </div>
</template>
