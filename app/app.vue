<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { AdminSessionResponse } from '../shared/imapsync'
import { getDefaultAdminSession, useAdminSession } from './composables/useAdminSession'
import { getRequestErrorMessage } from './composables/useRequestError'

const route = useRoute()
const session = useAdminSession()
const isLoginPage = computed(() => route.path === '/login')
const logoutBusy = ref(false)
const logoutError = ref<string | null>(null)

const { data: sessionData } = await useFetch<AdminSessionResponse>('/api/auth/session', {
  default: () => getDefaultAdminSession(),
})

watch(
  () => sessionData.value,
  (value) => {
    session.value = value
  },
  { immediate: true, deep: true },
)

function isNavActive(path: string) {
  if (path === '/') {
    return route.path === '/'
  }
  return route.path.startsWith(path)
}

async function handleLogout() {
  logoutBusy.value = true
  logoutError.value = null

  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    session.value = getDefaultAdminSession()
    await navigateTo('/login')
  }
  catch (error) {
    logoutError.value = getRequestErrorMessage(error)
  }
  finally {
    logoutBusy.value = false
  }
}
</script>

<template>
  <div class="relative min-h-screen bg-slate-950 text-slate-100 antialiased">
    <NuxtLoadingIndicator color="#8b5cf6" />
    <NuxtRouteAnnouncer />

    <div aria-hidden="true" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div class="absolute right-0 top-0 h-80 w-80 rounded-full bg-indigo-500/20 blur-3xl" />
      <div class="absolute -left-24 top-40 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
      <div class="absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.16),transparent_26%),radial-gradient(circle_at_left,rgba(14,165,233,0.12),transparent_28%)]" />
    </div>

    <div class="flex min-h-screen">
      <!-- Sidebar -->
      <aside
        v-if="!isLoginPage"
        class="fixed inset-y-0 left-0 z-20 flex w-60 flex-col border-r border-white/10 bg-slate-950/90 backdrop-blur-xl"
      >
        <!-- Brand -->
        <div class="border-b border-white/8 px-5 py-5">
          <NuxtLink class="block" to="/">
            <p class="text-sm font-extrabold tracking-tight text-white transition hover:text-indigo-200">
              Dash ImapSync
            </p>
            <p class="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-500">
              IMAP migration dashboard
            </p>
          </NuxtLink>
        </div>

        <!-- Navigation -->
        <nav class="flex-1 overflow-y-auto px-3 py-4">
          <!-- Dashboard -->
          <ul class="space-y-1">
            <li>
              <NuxtLink
                to="/"
                :class="[
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isNavActive('/') ? 'bg-white/[0.07] text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                ]"
              >
                <span
                  :class="[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition',
                    isNavActive('/') ? 'bg-indigo-500/15 text-indigo-300' : 'bg-white/[0.04] text-slate-500',
                  ]"
                >
                  <AppIcon class="h-4 w-4" name="server" />
                </span>
                Dashboard
              </NuxtLink>
            </li>
          </ul>

          <!-- Migration section -->
          <p class="mb-2 mt-6 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
            Migration
          </p>
          <ul class="space-y-1">
            <li>
              <NuxtLink
                to="/jobs/new"
                :class="[
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isNavActive('/jobs/new') ? 'bg-white/[0.07] text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                ]"
              >
                <span
                  :class="[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition',
                    isNavActive('/jobs/new') ? 'bg-indigo-500/15 text-indigo-300' : 'bg-white/[0.04] text-slate-500',
                  ]"
                >
                  <AppIcon class="h-4 w-4" name="plus" />
                </span>
                Single Migration
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/batch-migration"
                :class="[
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isNavActive('/batch-migration') ? 'bg-white/[0.07] text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                ]"
              >
                <span
                  :class="[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition',
                    isNavActive('/batch-migration') ? 'bg-indigo-500/15 text-indigo-300' : 'bg-white/[0.04] text-slate-500',
                  ]"
                >
                  <AppIcon class="h-4 w-4" name="upload" />
                </span>
                Batch Migration
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/jobs"
                :class="[
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  route.path.startsWith('/jobs') && !route.path.startsWith('/jobs/new') ? 'bg-white/[0.07] text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                ]"
              >
                <span
                  :class="[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition',
                    route.path.startsWith('/jobs') && !route.path.startsWith('/jobs/new') ? 'bg-indigo-500/15 text-indigo-300' : 'bg-white/[0.04] text-slate-500',
                  ]"
                >
                  <AppIcon class="h-4 w-4" name="mail" />
                </span>
                Job Migration
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/logs"
                :class="[
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isNavActive('/logs') ? 'bg-white/[0.07] text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                ]"
              >
                <span
                  :class="[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition',
                    isNavActive('/logs') ? 'bg-indigo-500/15 text-indigo-300' : 'bg-white/[0.04] text-slate-500',
                  ]"
                >
                  <AppIcon class="h-4 w-4" name="history" />
                </span>
                Logs
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/stats"
                :class="[
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                  isNavActive('/stats') ? 'bg-white/[0.07] text-white' : 'text-slate-400 hover:bg-white/[0.04] hover:text-white',
                ]"
              >
                <span
                  :class="[
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition',
                    isNavActive('/stats') ? 'bg-indigo-500/15 text-indigo-300' : 'bg-white/[0.04] text-slate-500',
                  ]"
                >
                  <AppIcon class="h-4 w-4" name="chart" />
                </span>
                Statistik
              </NuxtLink>
            </li>
          </ul>
        </nav>

        <!-- Bottom: user info + logout -->
        <div class="space-y-1 border-t border-white/8 p-3">
          <div
            v-if="session.user"
            class="flex items-center gap-2.5 rounded-xl bg-white/[0.03] px-3 py-2.5 ring-1 ring-white/[0.05]"
          >
            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-300">
              <AppIcon class="h-4 w-4" name="user" />
            </span>
            <span class="truncate text-xs font-semibold text-slate-200">{{ session.user.username }}</span>
          </div>

          <button
            :disabled="logoutBusy"
            class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-wait disabled:opacity-60"
            type="button"
            @click="handleLogout"
          >
            <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-slate-500 transition">
              <AppIcon class="h-4 w-4" name="logout" />
            </span>
            {{ logoutBusy ? 'Logging out...' : 'Logout' }}
          </button>
        </div>
      </aside>

      <!-- Main content -->
      <div :class="!isLoginPage ? 'ml-60 min-w-0 flex-1' : 'w-full'">
        <main class="mx-auto w-full px-4 py-6 sm:px-6 xl:px-10 2xl:px-14">
          <div
            v-if="logoutError"
            class="mb-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 shadow-[0_20px_40px_rgba(127,29,29,0.2)]"
          >
            {{ logoutError }}
          </div>
          <NuxtPage />
        </main>
      </div>
    </div>

    <AppToastViewport />
  </div>
</template>
