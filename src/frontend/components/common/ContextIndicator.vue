<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  percent: number;
}>();

const radius = 13;
const circumference = 2 * Math.PI * radius;
const dashOffset = computed(
  () => circumference - (props.percent / 100) * circumference,
);
</script>

<template>
  <svg width="32" height="32" viewBox="0 0 32 32" class="shrink-0">
    <circle
      cx="16"
      cy="16"
      :r="radius"
      fill="none"
      stroke-width="2.5"
      class="stroke-bg-input"
    />
    <circle
      cx="16"
      cy="16"
      :r="radius"
      fill="none"
      stroke-width="2.5"
      stroke-linecap="round"
      :class="[
        'transition-all duration-300',
        percent >= 80 ? 'stroke-amber-500' : 'stroke-primary',
      ]"
      :stroke-dasharray="circumference"
      :stroke-dashoffset="dashOffset"
      transform="rotate(-90 16 16)"
    />
    <text
      x="16"
      y="16"
      text-anchor="middle"
      dominant-baseline="central"
      :class="[
        'text-[8px] font-medium select-none',
        percent >= 80 ? 'fill-amber-500' : 'fill-text-secondary',
      ]"
    >
      {{ percent }}
    </text>
  </svg>
</template>
