<script setup lang="ts">
defineProps<{
  disabled?: boolean;
}>();

const modelValue = defineModel<boolean>({ required: true });
</script>

<template>
  <div
    class="relative cursor-pointer"
    :class="{ 'opacity-50 cursor-not-allowed': disabled }"
    @click="!disabled && (modelValue = !modelValue)"
  >
    <div
      class="w-9 h-5 rounded-full transition-colors"
      :class="modelValue ? 'bg-primary' : 'bg-border-primary'"
    ></div>
    <div
      class="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform"
      :class="modelValue ? 'translate-x-4' : ''"
    ></div>
  </div>
</template>
