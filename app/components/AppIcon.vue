<script setup lang="ts">
import { computed } from 'vue'

type IconName =
  | 'alert'
  | 'arrow-left'
  | 'chart'
  | 'chevron-right'
  | 'check'
  | 'clock'
  | 'download'
  | 'folder'
  | 'history'
  | 'logout'
  | 'mail'
  | 'play'
  | 'plus'
  | 'refresh'
  | 'retry'
  | 'server'
  | 'terminal'
  | 'trash'
  | 'upload'
  | 'user'

const props = withDefaults(defineProps<{
  name: IconName
  class?: string | string[]
}>(), {
  class: '',
})

const paths = computed(() => {
  switch (props.name) {
    case 'chart':
      return [
        { d: 'M3 3v18h18', type: 'path' },
        { d: 'M7 16V10', type: 'path' },
        { d: 'M11 16V4', type: 'path' },
        { d: 'M15 16V8', type: 'path' },
        { d: 'M19 16v-3', type: 'path' },
      ]
    case 'alert':
      return [
        { d: 'M12 9v4', type: 'path' },
        { d: 'M12 17h.01', type: 'path' },
        { d: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z', type: 'path' },
      ]
    case 'arrow-left':
      return [
        { d: 'm12 19-7-7 7-7', type: 'path' },
        { d: 'M19 12H5', type: 'path' },
      ]
    case 'chevron-right':
      return [{ d: 'm9 18 6-6-6-6', type: 'path' }]
    case 'check':
      return [{ d: 'm5 13 4 4L19 7', type: 'path' }]
    case 'clock':
      return [
        { d: 'M12 6v6l4 2', type: 'path' },
        { cx: '12', cy: '12', r: '9', type: 'circle' },
      ]
    case 'download':
      return [
        { d: 'M12 3v12', type: 'path' },
        { d: 'm7 10 5 5 5-5', type: 'path' },
        { d: 'M5 21h14', type: 'path' },
      ]
    case 'folder':
      return [{ d: 'M20 19a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16Z', type: 'path' }]
    case 'history':
      return [
        { d: 'M3 3v5h5', type: 'path' },
        { d: 'M3.05 13A9 9 0 1 0 6 5.3L3 8', type: 'path' },
        { d: 'M12 7v5l3 3', type: 'path' },
      ]
    case 'logout':
      return [
        { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', type: 'path' },
        { d: 'M16 17l5-5-5-5', type: 'path' },
        { d: 'M21 12H9', type: 'path' },
      ]
    case 'mail':
      return [
        { d: 'M4 4h16v16H4z', type: 'path' },
        { d: 'm22 6-10 7L2 6', type: 'path' },
      ]
    case 'play':
      return [{ d: 'M8 5v14l11-7z', type: 'path' }]
    case 'plus':
      return [
        { d: 'M12 5v14', type: 'path' },
        { d: 'M5 12h14', type: 'path' },
      ]
    case 'refresh':
      return [
        { d: 'M21 2v6h-6', type: 'path' },
        { d: 'M3 12a9 9 0 0 1 15.55-6.36L21 8', type: 'path' },
        { d: 'M3 22v-6h6', type: 'path' },
        { d: 'M21 12a9 9 0 0 1-15.55 6.36L3 16', type: 'path' },
      ]
    case 'retry':
      return [
        { d: 'M3 2v6h6', type: 'path' },
        { d: 'M3.05 13A9 9 0 1 0 6 5.3L3 8', type: 'path' },
      ]
    case 'server':
      return [
        { d: 'M3 4h18v6H3z', type: 'path' },
        { d: 'M3 14h18v6H3z', type: 'path' },
        { d: 'M7 7h.01', type: 'path' },
        { d: 'M7 17h.01', type: 'path' },
      ]
    case 'terminal':
      return [
        { d: 'm4 17 6-6-6-6', type: 'path' },
        { d: 'M12 19h8', type: 'path' },
      ]
    case 'trash':
      return [
        { d: 'M3 6h18', type: 'path' },
        { d: 'M8 6V4h8v2', type: 'path' },
        { d: 'M19 6l-1 14H6L5 6', type: 'path' },
        { d: 'M10 11v6', type: 'path' },
        { d: 'M14 11v6', type: 'path' },
      ]
    case 'upload':
      return [
        { d: 'M12 21V9', type: 'path' },
        { d: 'm7 14 5-5 5 5', type: 'path' },
        { d: 'M5 3h14', type: 'path' },
      ]
    case 'user':
      return [
        { d: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', type: 'path' },
        { cx: '10', cy: '7', r: '4', type: 'circle' },
        { d: 'M19 8v6', type: 'path' },
        { d: 'M22 11h-6', type: 'path' },
      ]
    default:
      return []
  }
})
</script>

<template>
  <svg
    :class="props.class"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <template v-for="(shape, index) in paths" :key="`${props.name}-${index}`">
      <path v-if="shape.type === 'path'" :d="shape.d" />
      <circle v-else :cx="shape.cx" :cy="shape.cy" :r="shape.r" />
    </template>
  </svg>
</template>
