<script setup lang="ts">
import { X } from "lucide-vue-next";

const props = defineProps<{
  queuedMessages: Array<{
    content: string;
    timestamp: number;
  }>;
}>();

const emit = defineEmits<{
  remove: [index: number];
}>();

</script>

<template>
  <div
    v-if="queuedMessages.length > 0"
    class="queue-indicator max-w-3xl mx-auto mb-3 bg-bg-secondary border border-border-primary rounded-3xl p-3 animate-slide-in"
  >
    <div class="flex items-center gap-2 mb-2 text-text-secondary ml-2">
      <span class="text-xs font-semibold uppercase">
        {{ queuedMessages.length }} message{{
          queuedMessages.length > 1 ? "s" : ""
        }}
        queued
      </span>
    </div>
    <div class="flex flex-col gap-1.5">
      <div
        v-for="(msg, idx) in queuedMessages"
        :key="idx"
        class="queue-item py-2 px-3 bg-bg-primary rounded-xl text-sm flex items-center gap-2"
      >
        <span
          class="text-text-primary overflow-hidden text-ellipsis whitespace-nowrap flex-1"
        >
          {{
            msg.content.length > 60
              ? msg.content.substring(0, 60) + "..."
              : msg.content
          }}
        </span>
        <button
          class="shrink-0 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
          @click="emit('remove', idx)"
        >
          <X :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>
