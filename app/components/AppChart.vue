<script setup lang="ts">
import { type ChartData, type ChartOptions, type ChartType, Chart, registerables } from 'chart.js'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

Chart.register(...registerables)

const props = defineProps<{
  type: ChartType
  data: ChartData
  options?: ChartOptions
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

function buildChart() {
  if (!canvasRef.value) return
  chart?.destroy()
  chart = new Chart(canvasRef.value, {
    type: props.type,
    data: props.data,
    options: props.options ?? {},
  })
}

onMounted(() => buildChart())

watch(
  () => props.data,
  (data) => {
    if (!chart) return
    chart.data = data
    chart.update()
  },
  { deep: true },
)

onBeforeUnmount(() => chart?.destroy())
</script>

<template>
  <canvas ref="canvasRef" />
</template>
