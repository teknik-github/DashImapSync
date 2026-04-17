<script setup lang="ts">
import type { CsvImportResult } from '../../shared/imapsync'
import { useToast } from '../composables/useToast'

useHead({ title: 'Batch Migration — Dash ImapSync' })

const { showSuccess } = useToast()
const lastResult = ref<CsvImportResult | null>(null)

function handleImported(result: CsvImportResult) {
  lastResult.value = result
  showSuccess(`${result.importedCount} email berhasil diimport ke ${result.jobCount} batch job.`)
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <section class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-white">
          Batch Migration
        </h1>
        <p class="mt-1 text-sm text-slate-400">
          Import banyak migration job sekaligus dari file CSV, TXT, atau Excel.
        </p>
      </div>

      <NuxtLink
        class="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/[0.07]"
        to="/"
      >
        <AppIcon class="h-4 w-4" name="arrow-left" />
        Kembali ke Dashboard
      </NuxtLink>
    </section>

    <!-- Success result banner -->
    <div
      v-if="lastResult"
      class="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-5 py-4 ring-1 ring-emerald-400/10"
    >
      <div class="flex items-center gap-3">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
          <AppIcon class="h-4 w-4" name="check" />
        </span>
        <div>
          <p class="text-sm font-semibold text-emerald-100">
            Import berhasil
          </p>
          <p class="text-xs text-emerald-300/70">
            {{ lastResult.importedCount }} mailbox pair diimport ke dalam
            <span class="font-semibold">{{ lastResult.jobNames[0] }}</span>
          </p>
        </div>
      </div>
      <NuxtLink
        :to="`/jobs/${lastResult.jobIds[0]}`"
        class="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
      >
        Lihat Job
        <AppIcon class="h-4 w-4 rotate-180" name="arrow-left" />
      </NuxtLink>
    </div>

    <!-- Import panel -->
    <CsvImportPanel @imported="handleImported" />
  </div>
</template>
