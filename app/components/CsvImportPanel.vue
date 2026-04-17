<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { CsvImportResult } from '../../shared/imapsync'
import { getRequestErrorMessage } from '../composables/useRequestError'
import { useToast } from '../composables/useToast'

const emit = defineEmits<{
  imported: [result: CsvImportResult]
}>()

const selectedFile = ref<File | null>(null)
const busy = ref(false)
const sourceHost = ref('')
const destinationHost = ref('')
const continueOnError = ref(false)
const templateMenuOpen = ref(false)
const templateMenuRoot = ref<HTMLElement | null>(null)
const { showError, showSuccess } = useToast()

const csvTemplate = `sourceUsername,sourcePassword,destinationUsername,destinationPassword
user1@source.tld,app-password-src,user1@destination.tld,app-password-dst`
const txtTemplate = `user1@source.tld app-password-src user1@destination.tld app-password-dst`
const spreadsheetTemplateRows = [
  ['sourceUsername', 'sourcePassword', 'destinationUsername', 'destinationPassword'],
  ['user1@source.tld', 'app-password-src', 'user1@destination.tld', 'app-password-dst'],
]

function closeTemplateMenu() {
  templateMenuOpen.value = false
}

function toggleTemplateMenu() {
  templateMenuOpen.value = !templateMenuOpen.value
}

function handleDocumentClick(event: MouseEvent) {
  if (!templateMenuOpen.value) {
    return
  }

  const target = event.target

  if (!(target instanceof Node)) {
    return
  }

  if (templateMenuRoot.value?.contains(target)) {
    return
  }

  closeTemplateMenu()
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeTemplateMenu()
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick)
  document.addEventListener('keydown', handleDocumentKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocumentClick)
  document.removeEventListener('keydown', handleDocumentKeydown)
})

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  selectedFile.value = target.files?.[0] ?? null
}

function triggerDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

async function downloadTemplate(format: 'csv' | 'txt' | 'xlsx' | 'xls') {
  closeTemplateMenu()

  try {
    if (format === 'csv') {
      const blob = new Blob([csvTemplate], { type: 'text/csv;charset=utf-8' })
      triggerDownload(blob, 'dash-imapsync-template.csv')
      return
    }

    if (format === 'txt') {
      const blob = new Blob([txtTemplate], { type: 'text/plain;charset=utf-8' })
      triggerDownload(blob, 'dash-imapsync-template.txt')
      return
    }

    const XLSX = await import('xlsx')
    const worksheet = XLSX.utils.aoa_to_sheet(spreadsheetTemplateRows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template')

    const buffer = XLSX.write(workbook, {
      bookType: format,
      type: 'array',
    })

    const mimeType = format === 'xlsx'
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.ms-excel'

    const blob = new Blob([buffer], { type: mimeType })
    triggerDownload(blob, `dash-imapsync-template.${format}`)
  }
  catch (error) {
    showError(error instanceof Error ? error.message : 'Gagal membuat template file.')
  }
}

function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase()
  const parts = normalized.split('.')

  return parts.length > 1 ? parts[parts.length - 1] ?? '' : ''
}

function buildCsvFromText(content: string) {
  const rows = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const tokens = line.split(/\s+/).filter(Boolean)

      if (tokens.length !== 4) {
        throw new Error(`TXT line ${index + 1} must contain exactly 4 values separated by spaces.`)
      }

      return tokens
    })

  if (!rows.length) {
    throw new Error('TXT file does not contain any rows.')
  }

  return [
    'sourceUsername,sourcePassword,destinationUsername,destinationPassword',
    ...rows.map((row) => row.map((value) => JSON.stringify(value)).join(',')),
  ].join('\n')
}

async function buildImportContent(file: File) {
  const extension = getFileExtension(file.name)

  if (extension === 'csv') {
    return file.text()
  }

  if (extension === 'txt') {
    const content = await file.text()
    return buildCsvFromText(content)
  }

  if (extension === 'xlsx' || extension === 'xls') {
    const XLSX = await import('xlsx')
    const buffer = await file.arrayBuffer()
    const workbook = XLSX.read(buffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]

    if (!firstSheetName) {
      throw new Error('Excel file does not contain any sheet.')
    }

    const worksheet = workbook.Sheets[firstSheetName]

    if (!worksheet) {
      throw new Error('Excel worksheet could not be read.')
    }

    return XLSX.utils.sheet_to_csv(worksheet, { blankrows: false }).trim()
  }

  throw new Error('Unsupported file format. Use CSV, TXT, XLSX, or XLS.')
}

async function handleImport() {
  if (!selectedFile.value) {
    showError('Pilih file import terlebih dahulu.')
    return
  }

  busy.value = true

  try {
    const content = await buildImportContent(selectedFile.value)
    const response = await $fetch<{ result: CsvImportResult }>('/api/jobs/import', {
      method: 'POST',
      body: {
        content,
        sourceHost: sourceHost.value,
        destinationHost: destinationHost.value,
        fileName: selectedFile.value.name,
        continueOnError: continueOnError.value,
      },
    })

    showSuccess(`1 batch job berisi ${response.result.importedCount} email berhasil diimport.`)
    emit('imported', response.result)
    selectedFile.value = null
  }
  catch (error) {
    showError(getRequestErrorMessage(error))
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
    <section class="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.7),rgba(11,18,34,0.84))] p-6 shadow-[0_24px_70px_rgba(2,6,23,0.42)] ring-1 ring-white/5 backdrop-blur-2xl">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div class="flex items-start gap-3">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1.2rem] bg-violet-500/10 text-violet-200 ring-1 ring-violet-400/15">
            <AppIcon class="h-5 w-5" name="upload" />
          </span>
          <div class="space-y-1">
            <h2 class="text-lg font-semibold text-white">
              Batch import file
            </h2>
            <p class="max-w-2xl text-sm text-slate-400">
              Import banyak migration job sekaligus dari CSV, TXT, atau Excel. Host tetap diisi sekali untuk seluruh batch.
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
        <div ref="templateMenuRoot" class="relative">
          <button
            class="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:bg-white/[0.07]"
            type="button"
            @click="toggleTemplateMenu"
          >
            <AppIcon class="h-4 w-4" name="download" />
            Download template
            <AppIcon :class="['h-4 w-4 transition-transform', templateMenuOpen ? 'rotate-90' : '']" name="chevron-right" />
          </button>

          <Transition
            enter-active-class="transition duration-200 ease-out"
            enter-from-class="translate-y-1 scale-[0.98] opacity-0"
            enter-to-class="translate-y-0 scale-100 opacity-100"
            leave-active-class="transition duration-150 ease-in"
            leave-from-class="translate-y-0 scale-100 opacity-100"
            leave-to-class="translate-y-1 scale-[0.98] opacity-0"
          >
            <div
              v-if="templateMenuOpen"
              class="absolute right-0 top-[calc(100%+0.65rem)] z-20 w-44 rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.96),rgba(11,18,34,0.98))] p-2 shadow-[0_18px_40px_rgba(2,6,23,0.35)] ring-1 ring-white/8 backdrop-blur-2xl"
            >
              <button class="flex w-full items-center justify-between rounded-[1rem] px-3 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/[0.06]" type="button" @click="downloadTemplate('csv')">
                <span>CSV</span>
                <AppIcon class="h-4 w-4 text-slate-400" name="download" />
              </button>
              <button class="mt-1 flex w-full items-center justify-between rounded-[1rem] px-3 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/[0.06]" type="button" @click="downloadTemplate('txt')">
                <span>TXT</span>
                <AppIcon class="h-4 w-4 text-slate-400" name="download" />
              </button>
              <button class="mt-1 flex w-full items-center justify-between rounded-[1rem] px-3 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/[0.06]" type="button" @click="downloadTemplate('xlsx')">
                <span>XLSX</span>
                <AppIcon class="h-4 w-4 text-slate-400" name="download" />
              </button>
              <button class="mt-1 flex w-full items-center justify-between rounded-[1rem] px-3 py-2.5 text-sm font-medium text-slate-100 transition hover:bg-white/[0.06]" type="button" @click="downloadTemplate('xls')">
                <span>XLS</span>
                <AppIcon class="h-4 w-4 text-slate-400" name="download" />
              </button>
            </div>
          </Transition>
        </div>

          <button
            :disabled="busy"
            class="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_18px_45px_rgba(79,70,229,0.28)] transition hover:-translate-y-0.5 hover:from-indigo-400 hover:to-violet-400 disabled:cursor-wait disabled:opacity-60"
            type="button"
            @click="handleImport"
          >
            <AppIcon class="h-4 w-4" name="upload" />
            {{ busy ? 'Importing...' : 'Import file' }}
          </button>
        </div>
      </div>

      <div class="mt-5 grid gap-4 md:grid-cols-2">
        <label class="block rounded-[1.7rem] border border-white/10 bg-slate-950/45 p-5">
          <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
            <AppIcon class="h-4 w-4" name="server" />
            Source host
          </span>
          <input
            v-model="sourceHost"
            class="block w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
            placeholder="imap.source.tld"
            type="text"
          >
          <small class="mt-3 block text-xs leading-5 text-slate-400">
            Diterapkan ke semua row bila kolom `sourceHost` tidak ada di CSV.
          </small>
        </label>

        <label class="block rounded-[1.7rem] border border-white/10 bg-slate-950/45 p-5">
          <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
            <AppIcon class="h-4 w-4" name="download" />
            Destination host
          </span>
          <input
            v-model="destinationHost"
            class="block w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
            placeholder="imap.destination.tld"
            type="text"
          >
          <small class="mt-3 block text-xs leading-5 text-slate-400">
            Diterapkan ke semua row bila kolom `destinationHost` tidak ada di CSV.
          </small>
        </label>
      </div>

      <label class="mt-4 block rounded-[1.7rem] border border-dashed border-white/10 bg-slate-950/45 p-5">
        <span class="mb-2 flex items-center gap-2 text-sm font-medium text-slate-200">
          <AppIcon class="h-4 w-4" name="upload" />
          Import file
        </span>
        <input
          accept=".csv,.txt,.xlsx,.xls,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
          class="block w-full text-sm text-slate-300 file:mr-4 file:rounded-full file:border-0 file:bg-indigo-500/15 file:px-4 file:py-2 file:font-semibold file:text-indigo-100 hover:file:bg-indigo-500/20"
          type="file"
          @change="handleFileChange"
        >
        <small class="mt-3 block text-xs leading-5 text-slate-400">
          Format yang didukung: CSV, TXT, XLSX, dan XLS. Jika kolom `name` tidak ada, nama job akan dibuat otomatis dari nama file upload.
        </small>
        <p v-if="selectedFile" class="mt-3 text-sm font-medium text-slate-200">
          {{ selectedFile.name }}
        </p>
      </label>

      <label class="mt-4 flex items-start gap-3 rounded-[1.7rem] border border-white/10 bg-slate-950/45 p-5 text-sm text-slate-300">
        <input v-model="continueOnError" class="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-indigo-500 focus:ring-indigo-500/20" type="checkbox">
        <span>
          <span class="block font-medium text-slate-100">Continue on error</span>
          Jika satu mailbox pair gagal, batch tetap lanjut ke pair berikutnya. Run selesai dengan status gagal bila ada item yang error.
        </span>
      </label>

    </section>

    <section class="rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(18,28,49,0.7),rgba(11,18,34,0.84))] p-5 shadow-[0_24px_70px_rgba(2,6,23,0.42)] ring-1 ring-white/5 backdrop-blur-2xl">
        <p class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
          <AppIcon class="h-3.5 w-3.5" name="terminal" />
          Required columns
        </p>
        <code class="mt-3 block whitespace-pre-wrap break-words rounded-2xl bg-slate-950/70 px-4 py-3 font-mono text-xs text-slate-300">
          sourceUsername, sourcePassword, destinationUsername, destinationPassword
        </code>
        <p class="mt-3 text-sm text-slate-400">
          Untuk CSV/Excel, kolom `name`, `sourceHost`, dan `destinationHost` sekarang opsional. Jika `name` tidak ada, sistem akan membuat nama batch job otomatis dari nama file upload.
        </p>
        <p class="mt-3 text-sm text-slate-400">
          Kolom port dan security tetap boleh ditambahkan bila ingin override default per row.
        </p>
        <div class="mt-4 rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            TXT example
          </p>
          <code class="mt-3 block whitespace-pre-wrap break-words font-mono text-xs text-slate-300">
            {{ txtTemplate }}
          </code>
          <p class="mt-3 text-sm text-slate-400">
            Setiap baris TXT harus berisi 4 nilai dipisahkan spasi: `sourceUsername sourcePassword destinationUsername destinationPassword`.
          </p>
        </div>
    </section>
  </div>
</template>
