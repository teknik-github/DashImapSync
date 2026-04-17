<script setup lang="ts">
import { computed } from 'vue'
import type { ChartData, ChartOptions } from 'chart.js'
import type { StatsResponse } from '../../shared/imapsync'

useHead({ title: 'Statistik — Dash ImapSync' })

const { data, pending, error, refresh } = await useFetch<StatsResponse>('/api/stats', {
  default: () => ({
    overview: { totalJobs: 0, totalRuns: 0, succeededRuns: 0, failedRuns: 0, canceledRuns: 0, successRate: 0, avgDurationSeconds: null },
    dailyRuns: [],
    topJobs: [],
  }),
})

const overview = computed(() => data.value!.overview)
const dailyRuns = computed(() => data.value!.dailyRuns)
const topJobs = computed(() => data.value!.topJobs)

const avgDurationLabel = computed(() => {
  const sec = overview.value.avgDurationSeconds
  if (sec === null) return '—'
  if (sec < 60) return `${sec}s`
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
})

const dailyChartData = computed<ChartData<'bar'>>(() => ({
  labels: dailyRuns.value.map(d => d.date.slice(5)),
  datasets: [
    {
      label: 'Succeeded',
      data: dailyRuns.value.map(d => d.succeeded),
      backgroundColor: 'rgba(16,185,129,0.75)',
      borderRadius: 4,
      stack: 'runs',
    },
    {
      label: 'Failed',
      data: dailyRuns.value.map(d => d.failed),
      backgroundColor: 'rgba(244,63,94,0.75)',
      borderRadius: 4,
      stack: 'runs',
    },
    {
      label: 'Canceled',
      data: dailyRuns.value.map(d => d.canceled),
      backgroundColor: 'rgba(100,116,139,0.6)',
      borderRadius: 4,
      stack: 'runs',
    },
  ],
}))

const dailyChartOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#94a3b8', boxRadius: 4, padding: 16 } },
    tooltip: { mode: 'index', intersect: false },
  },
  scales: {
    x: {
      stacked: true,
      ticks: { color: '#64748b', maxRotation: 45 },
      grid: { color: 'rgba(255,255,255,0.05)' },
    },
    y: {
      stacked: true,
      beginAtZero: true,
      ticks: { color: '#64748b', precision: 0 },
      grid: { color: 'rgba(255,255,255,0.05)' },
    },
  },
}))

const donutChartData = computed<ChartData<'doughnut'>>(() => ({
  labels: ['Succeeded', 'Failed', 'Canceled'],
  datasets: [{
    data: [
      overview.value.succeededRuns,
      overview.value.failedRuns,
      overview.value.canceledRuns,
    ],
    backgroundColor: [
      'rgba(16,185,129,0.8)',
      'rgba(244,63,94,0.8)',
      'rgba(100,116,139,0.7)',
    ],
    borderColor: 'rgba(9,16,29,0.9)',
    borderWidth: 2,
    hoverOffset: 6,
  }],
}))

const donutChartOptions = computed<ChartOptions<'doughnut'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  cutout: '70%',
  plugins: {
    legend: {
      position: 'bottom',
      labels: { color: '#94a3b8', boxRadius: 4, padding: 16 },
    },
  },
}))

const overviewCards = computed(() => [
  {
    title: 'Total Jobs',
    value: overview.value.totalJobs,
    icon: 'mail' as const,
    tone: 'bg-sky-500/10 text-sky-200 ring-sky-400/15',
  },
  {
    title: 'Total Runs',
    value: overview.value.totalRuns,
    icon: 'history' as const,
    tone: 'bg-indigo-500/10 text-indigo-200 ring-indigo-400/15',
  },
  {
    title: 'Success Rate',
    value: `${overview.value.successRate}%`,
    icon: 'check' as const,
    tone: 'bg-emerald-500/10 text-emerald-200 ring-emerald-400/15',
  },
  {
    title: 'Avg Duration',
    value: avgDurationLabel.value,
    icon: 'clock' as const,
    tone: 'bg-amber-500/10 text-amber-200 ring-amber-400/15',
  },
])
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <section class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-white">
          Statistik
        </h1>
        <p class="mt-1 text-sm text-slate-400">
          Ringkasan dan grafik performa migration job.
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

    <!-- Loading -->
    <div
      v-if="pending"
      class="rounded-3xl border border-dashed border-white/10 bg-slate-950/50 px-6 py-12 text-center text-sm text-slate-400"
    >
      Memuat statistik...
    </div>

    <!-- Error -->
    <div
      v-else-if="error"
      class="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
    >
      {{ error.statusMessage || 'Gagal memuat statistik.' }}
    </div>

    <template v-else>
      <!-- Overview cards -->
      <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div
          v-for="card in overviewCards"
          :key="card.title"
          class="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.7),rgba(12,19,35,0.78))] p-5 shadow-[0_18px_55px_rgba(2,6,23,0.38)] ring-1 ring-white/5 backdrop-blur-2xl"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{{ card.title }}</span>
              <strong class="mt-3 block text-4xl font-semibold tracking-tight text-white">{{ card.value }}</strong>
            </div>
            <span :class="['flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.25rem] ring-1', card.tone]">
              <AppIcon :name="card.icon" class="h-5 w-5" />
            </span>
          </div>
        </div>
      </section>

      <!-- Charts row -->
      <section class="grid gap-6 xl:grid-cols-[1fr_340px]">
        <!-- Daily bar chart -->
        <div class="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.7),rgba(11,18,34,0.84))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] ring-1 ring-white/5 backdrop-blur-2xl">
          <div class="mb-5 flex items-center gap-3">
            <span class="flex h-9 w-9 items-center justify-center rounded-[1rem] bg-indigo-500/10 text-indigo-300 ring-1 ring-indigo-400/15">
              <AppIcon class="h-4 w-4" name="chart" />
            </span>
            <div>
              <h2 class="text-base font-semibold text-white">
                Runs per hari
              </h2>
              <p class="text-xs text-slate-400">
                30 hari terakhir
              </p>
            </div>
          </div>
          <div v-if="!dailyRuns.length" class="flex h-52 items-center justify-center text-sm text-slate-500">
            Belum ada data run.
          </div>
          <div v-else class="h-64">
            <ClientOnly>
              <AppChart type="bar" :data="dailyChartData" :options="dailyChartOptions" />
            </ClientOnly>
          </div>
        </div>

        <!-- Donut chart -->
        <div class="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.7),rgba(11,18,34,0.84))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] ring-1 ring-white/5 backdrop-blur-2xl">
          <div class="mb-5 flex items-center gap-3">
            <span class="flex h-9 w-9 items-center justify-center rounded-[1rem] bg-violet-500/10 text-violet-300 ring-1 ring-violet-400/15">
              <AppIcon class="h-4 w-4" name="chart" />
            </span>
            <div>
              <h2 class="text-base font-semibold text-white">
                Distribusi status
              </h2>
              <p class="text-xs text-slate-400">
                Semua waktu
              </p>
            </div>
          </div>
          <div v-if="!overview.totalRuns" class="flex h-52 items-center justify-center text-sm text-slate-500">
            Belum ada data run.
          </div>
          <div v-else class="h-64">
            <ClientOnly>
              <AppChart type="doughnut" :data="donutChartData" :options="donutChartOptions" />
            </ClientOnly>
          </div>
        </div>
      </section>

      <!-- Top jobs -->
      <section class="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.7),rgba(11,18,34,0.84))] shadow-[0_24px_70px_rgba(2,6,23,0.42)] ring-1 ring-white/5 backdrop-blur-2xl">
        <div class="flex items-center gap-3 border-b border-white/8 px-6 py-4">
          <span class="flex h-9 w-9 items-center justify-center rounded-[1rem] bg-amber-500/10 text-amber-300 ring-1 ring-amber-400/15">
            <AppIcon class="h-4 w-4" name="terminal" />
          </span>
          <div>
            <h2 class="text-base font-semibold text-white">
              Top jobs
            </h2>
            <p class="text-xs text-slate-400">
              5 job dengan run terbanyak
            </p>
          </div>
        </div>

        <div v-if="!topJobs.length" class="px-6 py-10 text-center text-sm text-slate-500">
          Belum ada data.
        </div>

        <ul v-else class="divide-y divide-white/[0.05]">
          <li
            v-for="(job, index) in topJobs"
            :key="job.jobId"
            class="flex items-center gap-4 px-6 py-4"
          >
            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-xs font-bold text-slate-400">
              {{ index + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold text-white">
                {{ job.jobName }}
              </p>
              <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  class="h-full rounded-full bg-emerald-500/70"
                  :style="{ width: job.totalRuns > 0 ? `${Math.round((job.succeededRuns / job.totalRuns) * 100)}%` : '0%' }"
                />
              </div>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-sm font-semibold text-white">
                {{ job.totalRuns }} run
              </p>
              <p class="text-xs text-slate-400">
                {{ job.totalRuns > 0 ? Math.round((job.succeededRuns / job.totalRuns) * 100) : 0 }}% success
              </p>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
