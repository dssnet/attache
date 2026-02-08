<script setup lang="ts">
import { Bot } from "lucide-vue-next";
import Modal from "./Modal.vue";

defineProps<{
  content: string | null;
}>();

const emit = defineEmits<{
  close: [];
}>();
</script>

<template>
  <Modal :show="content !== null" title="Agent Message" @close="emit('close')">
    <template #title-icon>
      <Bot :size="18" class="text-text-primary" />
    </template>
    <pre
      class="bg-bg-input border border-border-primary rounded-lg p-4 overflow-x-auto font-mono text-[13px] text-text-primary m-0 whitespace-pre-wrap wrap-break-word"
      >{{ content }}</pre
    >
  </Modal>
</template>
