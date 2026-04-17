<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { JobDraftPayload } from '../../shared/imapsync'

const props = withDefaults(defineProps<{
  initialValue?: Partial<JobDraftPayload>
  submitLabel?: string
  busy?: boolean
  testBusy?: boolean
  showTestAction?: boolean
  password1Saved?: boolean
  password2Saved?: boolean
  layout?: 'stacked' | 'detail'
  migrationCaption?: string
  showDetailFooter?: boolean
}>(), {
  submitLabel: 'Save migration',
  busy: false,
  testBusy: false,
  showTestAction: false,
  password1Saved: false,
  password2Saved: false,
  layout: 'stacked',
  migrationCaption: '',
  showDetailFooter: true,
})

const emit = defineEmits<{
  submit: [payload: JobDraftPayload]
  testConnection: [payload: JobDraftPayload]
}>()

const defaultFormState: JobDraftPayload = {
  name: '',
  sourceHost: '',
  sourcePort: 993,
  sourceSecurity: 'ssl',
  sourceUsername: '',
  sourcePassword: '',
  destinationHost: '',
  destinationPort: 993,
  destinationSecurity: 'ssl',
  destinationUsername: '',
  destinationPassword: '',
  dryRun: false,
  deleteOnDestination: false,
  continueOnError: false,
  folderFilter: '',
}

const form = reactive<JobDraftPayload>({ ...defaultFormState })

const inputClass = 'block w-full rounded-[1.15rem] border border-white/10 bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20'
const selectClass = 'block w-full rounded-[1.15rem] border border-white/10 bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20'
const textareaClass = 'block min-h-28 w-full rounded-[1.15rem] border border-white/10 bg-slate-950/70 px-3.5 py-2.5 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20'
const sectionClass = 'rounded-[1.55rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.72),rgba(9,15,28,0.84))] p-4 shadow-[0_16px_42px_rgba(2,6,23,0.22)] ring-1 ring-white/[0.04]'
const footerClass = 'rounded-[1.55rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.62),rgba(9,15,28,0.9))] p-3.5 shadow-[0_16px_42px_rgba(2,6,23,0.18)] ring-1 ring-white/[0.04]'

const submitIcon = computed<'plus' | 'refresh'>(() => {
  return props.submitLabel.toLowerCase().includes('create') ? 'plus' : 'refresh'
})

const folderScopeLabel = computed(() => {
  const count = form.folderFilter
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .length

  if (count === 0) {
    return 'All folders'
  }

  return `${count} folder${count > 1 ? 's' : ''}`
})

const deleteBehaviorLabel = computed(() => {
  return form.deleteOnDestination ? 'Enabled' : 'Disabled'
})

const syncModeLabel = computed(() => {
  return form.dryRun ? 'Dry run' : 'Real sync'
})

const securityPathLabel = computed(() => {
  return `${form.sourceSecurity.toUpperCase()} -> ${form.destinationSecurity.toUpperCase()}`
})

watch(
  () => props.initialValue,
  (value) => {
    Object.assign(form, {
      ...defaultFormState,
      ...value,
      sourcePassword: '',
      destinationPassword: '',
    })
  },
  { immediate: true, deep: true },
)

function handleSubmit() {
  emit('submit', { ...form })
}

function handleTestConnection() {
  emit('testConnection', { ...form })
}
</script>

<template>
  <form @submit.prevent="handleSubmit">
    <div v-if="layout === 'detail'" class="grid gap-6 xl:grid-cols-[minmax(0,390px)_minmax(0,1fr)_minmax(0,390px)] 2xl:grid-cols-[minmax(0,430px)_minmax(0,1fr)_minmax(0,430px)]">
      <div class="space-y-5 xl:sticky xl:top-20 xl:self-start">
        <section :class="sectionClass">
          <div class="flex items-start gap-2.5">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[1rem] bg-sky-500/10 text-sky-200 ring-1 ring-sky-400/15">
              <AppIcon class="h-4.5 w-4.5" name="server" />
            </span>
            <div class="space-y-1">
              <h2 class="text-[17px] font-semibold text-white">
                Source mailbox
              </h2>
              <p class="text-xs leading-5 text-slate-400">
                Mailbox asal yang akan dibaca oleh `imapsync`.
              </p>
            </div>
          </div>

          <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-2">
            <label class="block xl:col-span-2">
              <span class="mb-1.5 block text-[13px] font-medium text-slate-200">Host</span>
              <input v-model="form.sourceHost" :class="inputClass" required placeholder="imap.source.tld" type="text">
            </label>

            <label class="block">
              <span class="mb-1.5 block text-[13px] font-medium text-slate-200">Port</span>
              <input v-model.number="form.sourcePort" :class="inputClass" max="65535" min="1" required type="number">
            </label>

            <label class="block">
              <span class="mb-1.5 block text-[13px] font-medium text-slate-200">Security</span>
              <select v-model="form.sourceSecurity" :class="selectClass">
                <option value="ssl">
                  SSL
                </option>
                <option value="tls">
                  TLS
                </option>
                <option value="none">
                  None
                </option>
              </select>
            </label>

            <label class="block xl:col-span-2">
              <span class="mb-1.5 block text-[13px] font-medium text-slate-200">Username</span>
              <input v-model="form.sourceUsername" :class="inputClass" required placeholder="user@source.tld" type="text">
            </label>

            <label class="block xl:col-span-2">
              <span class="mb-1.5 block text-[13px] font-medium text-slate-200">Password</span>
              <input
                v-model="form.sourcePassword"
                :class="inputClass"
                :required="!password1Saved"
                autocomplete="new-password"
                placeholder="App password or mailbox password"
                type="password"
              >
              <small v-if="password1Saved" class="mt-1.5 block text-[11px] text-slate-400">Kosongkan untuk memakai password source yang sudah tersimpan.</small>
            </label>
          </div>
        </section>

        <section :class="sectionClass">
          <div class="flex items-start gap-2.5">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[1rem] bg-violet-500/10 text-violet-200 ring-1 ring-violet-400/15">
              <AppIcon class="h-4.5 w-4.5" name="folder" />
            </span>
            <div class="space-y-1">
              <h2 class="text-[17px] font-semibold text-white">
                Migration
              </h2>
              <p class="text-xs leading-5 text-slate-400">
                Identitas job dan opsi sinkronisasi dasar.
              </p>
              <p v-if="migrationCaption" class="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-200/80">
                {{ migrationCaption }}
              </p>
            </div>
          </div>

          <div class="mt-4 grid gap-3 xl:grid-cols-2">
            <label class="block xl:col-span-2">
              <span class="mb-1.5 block text-[13px] font-medium text-slate-200">Job name</span>
              <input v-model="form.name" :class="inputClass" required maxlength="255" placeholder="Office365 batch A" type="text">
            </label>

            <label class="flex items-start gap-2.5 rounded-[1.15rem] border border-white/10 bg-slate-950/50 p-3 text-[13px] text-slate-300">
              <input v-model="form.dryRun" class="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-indigo-500 focus:ring-indigo-500/20" type="checkbox">
              <span>
                <span class="block font-medium text-slate-100">Dry run only</span>
                Jalankan validasi migrasi tanpa menyalin email.
              </span>
            </label>

            <label class="flex items-start gap-2.5 rounded-[1.15rem] border border-white/10 bg-slate-950/50 p-3 text-[13px] text-slate-300">
              <input v-model="form.deleteOnDestination" class="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-indigo-500 focus:ring-indigo-500/20" type="checkbox">
              <span>
                <span class="block font-medium text-slate-100">Delete messages missing on destination</span>
                Gunakan opsi `--delete2` saat sinkronisasi berjalan.
              </span>
            </label>

            <label class="block xl:col-span-2">
              <span class="mb-1.5 block text-[13px] font-medium text-slate-200">Folder filter</span>
              <textarea v-model="form.folderFilter" :class="textareaClass" placeholder="INBOX&#10;Sent Items"></textarea>
              <small class="mt-1.5 block text-[11px] text-slate-400">Opsional. Satu folder per baris.</small>
            </label>
          </div>
        </section>

        <slot name="left-extra" :busy="busy" :handle-test-connection="handleTestConnection" :submit-label="submitLabel" :test-busy="testBusy" />
      </div>

      <div class="min-w-0">
        <slot name="middle" />
      </div>

      <div class="grid gap-5 xl:sticky xl:top-20 xl:self-start">
        <section :class="`${sectionClass} min-h-[320px]`">
          <div class="flex items-start gap-2.5">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-[1rem] bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/15">
              <AppIcon class="h-4.5 w-4.5" name="download" />
            </span>
            <div class="space-y-1">
              <h2 class="text-[17px] font-semibold text-white">
                Destination mailbox
              </h2>
              <p class="text-xs leading-5 text-slate-400">
                Mailbox tujuan tempat email akan ditulis.
              </p>
            </div>
          </div>

          <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-2">
            <label class="block xl:col-span-2">
              <span class="mb-1.5 block text-[13px] font-medium text-slate-200">Host</span>
              <input v-model="form.destinationHost" :class="inputClass" required placeholder="imap.destination.tld" type="text">
            </label>

            <label class="block">
              <span class="mb-1.5 block text-[13px] font-medium text-slate-200">Port</span>
              <input v-model.number="form.destinationPort" :class="inputClass" max="65535" min="1" required type="number">
            </label>

            <label class="block">
              <span class="mb-1.5 block text-[13px] font-medium text-slate-200">Security</span>
              <select v-model="form.destinationSecurity" :class="selectClass">
                <option value="ssl">
                  SSL
                </option>
                <option value="tls">
                  TLS
                </option>
                <option value="none">
                  None
                </option>
              </select>
            </label>

            <label class="block xl:col-span-2">
              <span class="mb-1.5 block text-[13px] font-medium text-slate-200">Username</span>
              <input v-model="form.destinationUsername" :class="inputClass" required placeholder="user@destination.tld" type="text">
            </label>

            <label class="block xl:col-span-2">
              <span class="mb-1.5 block text-[13px] font-medium text-slate-200">Password</span>
              <input
                v-model="form.destinationPassword"
                :class="inputClass"
                :required="!password2Saved"
                autocomplete="new-password"
                placeholder="App password or mailbox password"
                type="password"
              >
              <small v-if="password2Saved" class="mt-1.5 block text-[11px] text-slate-400">Kosongkan untuk memakai password destination yang sudah tersimpan.</small>
            </label>
          </div>
        </section>

        <div v-if="showDetailFooter" :class="`${footerClass} min-h-[248px]`">
          <div class="flex min-h-full flex-col justify-between gap-4">
            <div class="space-y-1">
              <p class="text-[13px] font-medium text-white">
                Siap menyimpan konfigurasi migration
              </p>
              <p class="text-[11px] leading-5 text-slate-400">
                Uji koneksi dulu bila perlu, lalu simpan job untuk dipakai pada run berikutnya.
              </p>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-[1.15rem] border border-white/10 bg-slate-950/55 p-2.5">
                <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Mode</span>
                <p class="mt-1.5 text-[13px] font-semibold text-white">
                  {{ syncModeLabel }}
                </p>
              </div>
              <div class="rounded-[1.15rem] border border-white/10 bg-slate-950/55 p-2.5">
                <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Delete2</span>
                <p class="mt-1.5 text-[13px] font-semibold text-white">
                  {{ deleteBehaviorLabel }}
                </p>
              </div>
              <div class="rounded-[1.15rem] border border-white/10 bg-slate-950/55 p-2.5">
                <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Folders</span>
                <p class="mt-1.5 text-[13px] font-semibold text-white">
                  {{ folderScopeLabel }}
                </p>
              </div>
              <div class="rounded-[1.15rem] border border-white/10 bg-slate-950/55 p-2.5">
                <span class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Security</span>
                <p class="mt-1.5 text-[13px] font-semibold text-white">
                  {{ securityPathLabel }}
                </p>
              </div>
            </div>

            <div class="flex flex-wrap items-center justify-end gap-3 pt-1">
              <button
                v-if="showTestAction"
                :disabled="busy || testBusy"
                class="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/[0.07] disabled:cursor-wait disabled:opacity-60"
                type="button"
                @click="handleTestConnection"
              >
                <AppIcon class="h-4 w-4" name="server" />
                {{ testBusy ? 'Testing...' : 'Test connection' }}
              </button>

              <button
                :disabled="busy"
                class="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.28)] transition hover:-translate-y-0.5 hover:from-indigo-400 hover:to-violet-400 disabled:cursor-wait disabled:opacity-60"
                type="submit"
              >
                <AppIcon :name="submitIcon" class="h-4 w-4" />
                {{ busy ? 'Saving...' : submitLabel }}
              </button>
            </div>
          </div>
        </div>

        <slot name="right-extra" />
      </div>
    </div>

    <div v-else class="space-y-8">
      <section :class="sectionClass">
        <div class="flex items-start gap-3">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-violet-500/10 text-violet-200 ring-1 ring-violet-400/15">
            <AppIcon class="h-5 w-5" name="folder" />
          </span>
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-white">
              Migration
            </h2>
            <p class="text-sm text-slate-400">
              Identitas job dan opsi sinkronisasi dasar.
            </p>
            <p v-if="migrationCaption" class="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-200/80">
              {{ migrationCaption }}
            </p>
          </div>
        </div>

        <div class="mt-5 grid gap-4">
          <label class="block">
            <span class="mb-2 block text-sm font-medium text-slate-200">Job name</span>
            <input v-model="form.name" :class="inputClass" required maxlength="255" placeholder="Office365 batch A" type="text">
          </label>
        </div>

        <div class="mt-4 grid gap-4 lg:grid-cols-2">
          <label class="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
            <input v-model="form.dryRun" class="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-indigo-500 focus:ring-indigo-500/20" type="checkbox">
            <span>
              <span class="block font-medium text-slate-100">Dry run only</span>
              Jalankan validasi migrasi tanpa menyalin email.
            </span>
          </label>

          <label class="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
            <input v-model="form.deleteOnDestination" class="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-indigo-500 focus:ring-indigo-500/20" type="checkbox">
            <span>
              <span class="block font-medium text-slate-100">Delete messages missing on destination</span>
              Gunakan opsi `--delete2` saat sinkronisasi berjalan.
            </span>
          </label>
        </div>

        <label class="mt-4 block">
          <span class="mb-2 block text-sm font-medium text-slate-200">Folder filter</span>
          <textarea v-model="form.folderFilter" :class="textareaClass" placeholder="INBOX&#10;Sent Items"></textarea>
          <small class="mt-2 block text-xs text-slate-400">Opsional. Satu folder per baris.</small>
        </label>
      </section>

      <section :class="sectionClass">
        <div class="flex items-start gap-3">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-sky-500/10 text-sky-200 ring-1 ring-sky-400/15">
            <AppIcon class="h-5 w-5" name="server" />
          </span>
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-white">
              Source mailbox
            </h2>
            <p class="text-sm text-slate-400">
              Mailbox asal yang akan dibaca oleh `imapsync`.
            </p>
          </div>
        </div>

        <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label class="block xl:col-span-2">
            <span class="mb-2 block text-sm font-medium text-slate-200">Host</span>
            <input v-model="form.sourceHost" :class="inputClass" required placeholder="imap.source.tld" type="text">
          </label>

          <label class="block">
            <span class="mb-2 block text-sm font-medium text-slate-200">Port</span>
            <input v-model.number="form.sourcePort" :class="inputClass" max="65535" min="1" required type="number">
          </label>

          <label class="block">
            <span class="mb-2 block text-sm font-medium text-slate-200">Security</span>
            <select v-model="form.sourceSecurity" :class="selectClass">
              <option value="ssl">
                SSL
              </option>
              <option value="tls">
                TLS
              </option>
              <option value="none">
                None
              </option>
            </select>
          </label>

          <label class="block xl:col-span-2">
            <span class="mb-2 block text-sm font-medium text-slate-200">Username</span>
            <input v-model="form.sourceUsername" :class="inputClass" required placeholder="user@source.tld" type="text">
          </label>

          <label class="block xl:col-span-2">
            <span class="mb-2 block text-sm font-medium text-slate-200">Password</span>
            <input
              v-model="form.sourcePassword"
              :class="inputClass"
              :required="!password1Saved"
              autocomplete="new-password"
              placeholder="App password or mailbox password"
              type="password"
            >
            <small v-if="password1Saved" class="mt-2 block text-xs text-slate-400">Kosongkan untuk memakai password source yang sudah tersimpan.</small>
          </label>
        </div>
      </section>

      <section :class="sectionClass">
        <div class="flex items-start gap-3">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-emerald-500/10 text-emerald-200 ring-1 ring-emerald-400/15">
            <AppIcon class="h-5 w-5" name="download" />
          </span>
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-white">
              Destination mailbox
            </h2>
            <p class="text-sm text-slate-400">
              Mailbox tujuan tempat email akan ditulis.
            </p>
          </div>
        </div>

        <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label class="block xl:col-span-2">
            <span class="mb-2 block text-sm font-medium text-slate-200">Host</span>
            <input v-model="form.destinationHost" :class="inputClass" required placeholder="imap.destination.tld" type="text">
          </label>

          <label class="block">
            <span class="mb-2 block text-sm font-medium text-slate-200">Port</span>
            <input v-model.number="form.destinationPort" :class="inputClass" max="65535" min="1" required type="number">
          </label>

          <label class="block">
            <span class="mb-2 block text-sm font-medium text-slate-200">Security</span>
            <select v-model="form.destinationSecurity" :class="selectClass">
              <option value="ssl">
                SSL
              </option>
              <option value="tls">
                TLS
              </option>
              <option value="none">
                None
              </option>
            </select>
          </label>

          <label class="block xl:col-span-2">
            <span class="mb-2 block text-sm font-medium text-slate-200">Username</span>
            <input v-model="form.destinationUsername" :class="inputClass" required placeholder="user@destination.tld" type="text">
          </label>

          <label class="block xl:col-span-2">
            <span class="mb-2 block text-sm font-medium text-slate-200">Password</span>
            <input
              v-model="form.destinationPassword"
              :class="inputClass"
              :required="!password2Saved"
              autocomplete="new-password"
              placeholder="App password or mailbox password"
              type="password"
            >
            <small v-if="password2Saved" class="mt-2 block text-xs text-slate-400">Kosongkan untuk memakai password destination yang sudah tersimpan.</small>
          </label>
        </div>
      </section>

      <div :class="footerClass">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="space-y-1">
            <p class="text-sm font-medium text-white">
              Siap menyimpan konfigurasi migration
            </p>
            <p class="text-xs text-slate-400">
              Uji koneksi dulu bila perlu, lalu simpan job untuk dipakai pada run berikutnya.
            </p>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-3">
            <button
              v-if="showTestAction"
              :disabled="busy || testBusy"
              class="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/[0.07] disabled:cursor-wait disabled:opacity-60"
              type="button"
              @click="handleTestConnection"
            >
              <AppIcon class="h-4 w-4" name="server" />
              {{ testBusy ? 'Testing...' : 'Test connection' }}
            </button>

            <button
              :disabled="busy"
              class="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.28)] transition hover:-translate-y-0.5 hover:from-indigo-400 hover:to-violet-400 disabled:cursor-wait disabled:opacity-60"
              type="submit"
            >
              <AppIcon :name="submitIcon" class="h-4 w-4" />
              {{ busy ? 'Saving...' : submitLabel }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </form>
</template>
