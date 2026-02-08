<script setup lang="ts">
import { Wrench } from "lucide-vue-next";
import Modal from "./Modal.vue";

defineProps<{
  toolCall: {
    toolName: string;
    toolInput: Record<string, any>;
  } | null;
}>();

const emit = defineEmits<{
  close: [];
}>();

function formatToolName(toolName: string): string {
  return toolName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
</script>

<template>
  <Modal :show="toolCall !== null" title="Tool Call Details" @close="emit('close')">
    <template #title-icon>
      <Wrench :size="18" class="text-text-primary" />
    </template>
    <template v-if="toolCall">
      <div class="mb-6">
        <h3 class="text-sm uppercase text-text-secondary mb-3 font-semibold">
          Tool
        </h3>
        <p
          class="inline-block py-2 px-3 bg-tool-badge-bg border border-tool-badge-border rounded-md text-tool-badge-text font-medium m-0"
        >
          {{ formatToolName(toolCall.toolName) }}
        </p>
      </div>
      <div>
        <h3 class="text-sm uppercase text-text-secondary mb-3 font-semibold">
          Input
        </h3>
        <pre
          class="bg-bg-input border border-border-primary rounded-lg p-4 overflow-x-auto font-mono text-[13px] text-text-primary m-0 whitespace-pre-wrap wrap-break-word"
          >{{ JSON.stringify(toolCall.toolInput, null, 2) }}</pre
        >
      </div>
    </template>
  </Modal>
</template>
