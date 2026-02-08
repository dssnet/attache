<script setup lang="ts">
defineProps<{
  name: string;
  description: string;
}>();
</script>

<template>
  <div class="flex items-center justify-between gap-6 py-3">
    <div class="flex flex-col gap-0.5">
      <h3 class="text-sm font-medium text-text-primary">{{ name }}</h3>
      <p class="text-xs text-text-secondary">{{ description }}</p>
    </div>
    <div class="shrink-0">
      <slot />
    </div>
  </div>
</template>
