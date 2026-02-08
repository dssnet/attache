<script setup lang="ts">
defineProps<{
  label: string;
}>();
</script>

<template>
  <div class="flex flex-col gap-1.5 py-2">
    <label class="text-sm font-medium text-text-primary">{{ label }}</label>
    <slot />
  </div>
</template>
