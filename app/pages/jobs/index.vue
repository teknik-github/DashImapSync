<script setup lang="ts">
import { computed, ref } from 'vue'
import type { DashboardSummary, MigrationJobSummary } from '../../../shared/imapsync'
import { formatDateTime } from '../../composables/useFormatters'

useHead({ title: 'Job Migration — Dash ImapSync' })

const { data, pending, error, refresh } = await useFetch<{ jobs: MigrationJobSummary[], summary: DashboardSummary }>('/api/jobs', {
  default: () => ({ jobs: [], summary: { totalJobs: 0, queuedRuns: 0, runningRuns: 0, succeededRuns: 0, failedRuns: 0 } }),
})

const searchQuery = ref('')

const jobs = computed(() => data.value?.jobs ?? [])

const filteredJobs = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return jobs.value
  return jobs.value.filter(job =>
    job.name.toLowerCase().includes(q)
    || job.sourceHost.toLowerCase().includes(q)
    || job.destinationHost.toLowerCase().includes(q)
    || job.sourceUsername.toLowerCase().includes(q)
    || job.destinationUsername.toLowerCase().includes(q),
  )
})

function getJobSubtitle(job: MigrationJobSummary) {
  if (job.isBatch) {
    return `${job.itemCount} mailbox pair${job.itemCount > 1 ? 's' : ''} in one batch job`
  }
  return `${job.sourceUsername} @ ${job.sourceHost} -> ${job.destinationUsername} @ ${job.destinationHost}`
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <section class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-white">
          Job Migration
        </h1>
        <p class="mt-1 text-sm text-slate-400">
          Daftar semua migration job yang telah dibuat.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <div class="flex w-64 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 transition focus-within:border-indigo-400/40 focus-within:ring-2 focus-within:ring-indigo-500/20">
          <AppIcon class="h-4 w-4 shrink-0 text-slate-500" name="server" />
          <input
            v-model="searchQuery"
            class="min-w-0 flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none"
            placeholder="Cari job..."
            type="search"
          >
        </div>
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
          New job
        </NuxtLink>
      </div>
    </section>

    <!-- Loading -->
    <div
      v-if="pending"
      class="rounded-3xl border border-dashed border-white/10 bg-slate-950/50 px-6 py-10 text-center text-sm text-slate-400"
    >
      Memuat daftar migration job...
    </div>

    <!-- Error -->
    <div v-else-if="error" class="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
      {{ error.statusMessage || 'Gagal memuat daftar job.' }}
    </div>

    <template v-else>
      <!-- Empty: no jobs at all -->
      <div
        v-if="!jobs.length"
        class="rounded-3xl border border-dashed border-white/10 bg-slate-950/50 px-6 py-10 text-center"
      >
        <p class="text-sm text-slate-400">Belum ada migration job.</p>
        <NuxtLink
          class="mt-4 inline-flex items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.28)] transition hover:-translate-y-0.5 hover:from-indigo-400 hover:to-violet-400"
          to="/jobs/new"
        >
          Buat job pertama
        </NuxtLink>
      </div>

      <!-- Empty: no search results -->
      <div
        v-else-if="!filteredJobs.length"
        class="rounded-3xl border border-dashed border-white/10 bg-slate-950/50 px-6 py-10 text-center text-sm text-slate-400"
      >
        Tidak ada job yang cocok dengan "<span class="font-semibold text-white">{{ searchQuery }}</span>".
      </div>

      <!-- Cards -->
      <div v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
