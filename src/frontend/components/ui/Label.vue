<script setup lang="ts">
defineProps<{
  for?: string;
}>();
</script>

<template>
  <label :for="for" class="text-sm font-medium text-text-primary">
    <slot />
  </label>
</template>
