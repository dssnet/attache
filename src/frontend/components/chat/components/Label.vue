<script setup lang="ts">
import { ChevronRight } from "lucide-vue-next";

defineProps<{
  label: string;
}>();

const emit = defineEmits<{
  click: [];
}>();
</script>

<template>
  <div
    class="relative flex items-center text-text-secondary text-base hover:opacity-60 cursor-default gap-3 w-fit max-w-xs my-1 transition-opacity"
    @click="emit('click')"
  >
    <slot />
    <span class="truncate">{{ label }}</span>
    <ChevronRight class="size-4 shrink-0" />
  </div>
</template>
