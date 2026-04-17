<script setup lang="ts">
import { ref } from 'vue'
import { useAdminSession } from '../composables/useAdminSession'
import { getRequestErrorMessage } from '../composables/useRequestError'
import { useToast } from '../composables/useToast'

useHead({ title: 'Admin login' })

const session = useAdminSession()
const username = ref('')
const password = ref('')
const busy = ref(false)
const { showError, showSuccess } = useToast()

async function handleSubmit() {
  busy.value = true

  try {
    const response = await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        username: username.value,
        password: password.value,
      },
    })

    session.value = response
    showSuccess('Login berhasil.')
    await navigateTo('/')
  }
  catch (error) {
    showError(getRequestErrorMessage(error), 'Login failed')
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="grid min-h-[calc(100vh-9rem)] place-items-center">
    <section class="w-full max-w-md rounded-[32px] border border-white/10 bg-slate-900/75 p-7 shadow-[0_28px_80px_rgba(2,6,23,0.45)] ring-1 ring-white/5 backdrop-blur-xl">
      <p class="text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-200/80">
        Admin access
      </p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-white">
        Login dashboard
      </h1>
      <p class="mt-3 text-sm leading-6 text-slate-400">
        Masuk dengan akun admin tunggal untuk mengelola migration jobs, live run, dan batch import CSV.
      </p>

      <form class="mt-6 space-y-4" @submit.prevent="handleSubmit">
        <label class="block">
          <span class="mb-2 block text-sm font-medium text-slate-200">Username</span>
          <input
            v-model="username"
            autocomplete="username"
            class="block w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
            required
            type="text"
          >
        </label>

        <label class="block">
          <span class="mb-2 block text-sm font-medium text-slate-200">Password</span>
          <input
            v-model="password"
            autocomplete="current-password"
            class="block w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
            required
            type="password"
          >
        </label>

        <button
          :disabled="busy"
          class="inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.28)] transition hover:-translate-y-0.5 hover:from-indigo-400 hover:to-violet-400 disabled:cursor-wait disabled:opacity-60"
          type="submit"
        >
          {{ busy ? 'Logging in...' : 'Login' }}
        </button>
      </form>
    </section>
  </div>
</template>
