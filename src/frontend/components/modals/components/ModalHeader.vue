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
    class="pt-4 pb-2 px-5 md:p-2 border-b border-border-primary flex items-center gap-2 relative"
  >
    <slot name="left-action">
      <Button
        variant="ghost"
        icon
        size="sm"
        class="text-2xl leading-none"
        @click="emit('close')"
        ><X :size="14"
      /></Button>
    </slot>
    <div class="flex items-center gap-3 flex-1 justify-center">
      <slot name="icon" />
      <h2 class="text-sm font-semibold text-text-primary">{{ title }}</h2>
    </div>
    <!-- Spacer to balance the left button for centering -->
    <div class="w-8 h-8 shrink-0" />
  </div>
</template>
