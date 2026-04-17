<script setup lang="ts">
import { ref } from 'vue'
import type { ConnectionTestResult, JobDraftPayload } from '../../../shared/imapsync'
import { formatDateTime } from '../../composables/useFormatters'
import { getRequestErrorMessage } from '../../composables/useRequestError'
import { useToast } from '../../composables/useToast'

useHead({ title: 'New migration job' })

const saving = ref(false)
const testing = ref(false)
const testResult = ref<ConnectionTestResult | null>(null)
const { showError, showSuccess } = useToast()

async function handleSubmit(payload: JobDraftPayload) {
  saving.value = true

  try {
    const response = await $fetch<{ job: { id: string } }>('/api/jobs', {
      method: 'POST',
      body: payload,
    })

    showSuccess('Migration job berhasil dibuat.')
    await navigateTo(`/jobs/${response.job.id}`)
  }
  catch (error) {
    showError(getRequestErrorMessage(error))
  }
  finally {
    saving.value = false
  }
}

async function handleTestConnection(payload: JobDraftPayload) {
  testing.value = true

  try {
    const response = await $fetch<{ result: ConnectionTestResult }>('/api/jobs/test-connection', {
      method: 'POST',
      body: payload,
    })

    testResult.value = response.result

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
</script>

<template>
  <div class="space-y-6">
    <div class="flex justify-start">
      <NuxtLink
        class="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/[0.07]"
        to="/"
      >
        <AppIcon class="h-4 w-4" name="arrow-left" />
        Back to dashboard
      </NuxtLink>
    </div>

    <JobForm
      :busy="saving"
      :layout="'detail'"
      :show-test-action="true"
      :test-busy="testing"
      submit-label="Create migration"
      @submit="handleSubmit"
      @test-connection="handleTestConnection"
    >
      <template #middle>
        <section class="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.7),rgba(11,18,34,0.84))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] ring-1 ring-white/5 backdrop-blur-2xl">
          <div class="flex items-start gap-3">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-violet-500/10 text-violet-200 ring-1 ring-violet-400/15">
              <AppIcon class="h-5 w-5" name="terminal" />
            </span>
            <div class="space-y-1">
              <h2 class="text-lg font-semibold text-white">
                Logs
              </h2>
              <p class="text-sm text-slate-400">
                Hasil `test connection` akan tampil di kolom tengah sebelum migration job disimpan.
              </p>
            </div>
          </div>

          <div v-if="!testResult" class="mt-5 rounded-3xl border border-dashed border-white/10 bg-slate-950/50 px-6 py-10 text-center text-sm text-slate-400">
            Jalankan <strong class="text-slate-200">Test connection</strong> untuk melihat output koneksi source dan destination di sini.
          </div>

          <template v-else>
            <div class="mt-5 grid gap-4 sm:grid-cols-2">
              <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <span class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3.5 w-3.5" name="alert" />Status</span>
                <p :class="['mt-2 text-sm font-semibold', testResult.ok ? 'text-emerald-200' : 'text-rose-200']">
                  {{ testResult.ok ? 'Connection successful' : 'Connection failed' }}
                </p>
              </div>

              <div class="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <span class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3.5 w-3.5" name="clock" />Checked at</span>
                <p class="mt-2 text-sm font-semibold text-white">
                  {{ formatDateTime(testResult.checkedAt) }}
                </p>
              </div>
            </div>

            <div :class="['mt-5 rounded-2xl border px-4 py-3 text-sm', testResult.ok ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100' : 'border-rose-400/20 bg-rose-500/10 text-rose-100']">
              {{ testResult.message }}
            </div>

            <div class="mt-5 rounded-3xl border border-white/10 bg-slate-950/60 p-4">
              <span class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"><AppIcon class="h-3.5 w-3.5" name="terminal" />Command preview</span>
              <code class="mt-3 block whitespace-pre-wrap break-words font-mono text-xs text-slate-300">
                {{ testResult.commandPreview }}
              </code>
            </div>

            <div class="mt-5 rounded-[1.7rem] border border-white/10 bg-slate-950/80 p-4">
              <div class="mb-3 flex items-center justify-between gap-3">
                <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Connection output</span>
                <span :class="['inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]', testResult.ok ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-200' : 'border-rose-400/20 bg-rose-400/10 text-rose-200']">
                  <span class="h-1.5 w-1.5 rounded-full bg-current" />
                  {{ testResult.ok ? 'Healthy' : 'Error' }}
                </span>
              </div>

              <div class="max-h-[680px] space-y-3 overflow-auto">
                <div v-if="!testResult.logs.length" class="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-8 text-center text-sm text-slate-400">
                  Tidak ada log tambahan dari test connection.
                </div>

                <div v-for="(line, index) in testResult.logs" :key="`${index}-${line}`" class="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <code class="whitespace-pre-wrap break-words font-mono text-xs text-slate-100">{{ line }}</code>
                </div>
              </div>
            </div>
          </template>
        </section>
      </template>
    </JobForm>
  </div>
</template>
