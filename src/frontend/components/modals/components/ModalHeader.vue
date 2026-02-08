<script setup lang="ts">
import { X } from "lucide-vue-next";
import Button from "../../ui/Button.vue";

defineProps<{
  title: string;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <div
    class="p-2 border-b border-border-primary flex justify-between items-center"
  >
    <div class="flex items-center gap-3 px-3">
      <slot name="icon" />
      <h2 class="text-xl font-semibold text-text-primary">{{ title }}</h2>
    </div>
    <Button
      variant="ghost"
      icon
      size="sm"
      class="text-2xl leading-none"
      @click="emit('close')"
      ><X :size="14"
    /></Button>
  </div>
</template>
